import fetch from 'node-fetch';
import Database from 'better-sqlite3';
import type {
  WeatherForecast,
  DailyForecast,
  ForecastSummary,
  AlertsResponse,
  WeatherAlert,
  SoilMoisture,
  OptimalMoistureRange,
  Location
} from './types.js';

// Calculate distance between two coordinates using Haversine formula
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Fetch real weather forecast from OpenMeteo API
export async function fetchOpenMeteoForecast(latitude: number, longitude: number): Promise<WeatherForecast> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,relative_humidity_2m_mean,wind_speed_10m_max&timezone=Asia/Kolkata&forecast_days=7`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OpenMeteo API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      daily: {
        time: string[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_sum: number[];
        relative_humidity_2m_mean: number[];
        wind_speed_10m_max: number[];
      };
    };

    // Process daily data
    const daily_data: DailyForecast[] = [];
    let total_rainfall = 0;
    let heavy_rain_days = 0;
    let consecutive_dry_days = 0;
    let max_consecutive_dry_days = 0;

    for (let i = 0; i < data.daily.time.length; i++) {
      const rainfall = data.daily.precipitation_sum[i] || 0;

      daily_data.push({
        date: data.daily.time[i] ?? '',
        temp_max: Math.round((data.daily.temperature_2m_max[i] ?? 0) * 10) / 10,
        temp_min: Math.round((data.daily.temperature_2m_min[i] ?? 0) * 10) / 10,
        rainfall_mm: Math.round(rainfall * 10) / 10,
        humidity_mean: Math.round(data.daily.relative_humidity_2m_mean[i] ?? 0),
        wind_speed_max: Math.round((data.daily.wind_speed_10m_max[i] ?? 0) * 10) / 10
      });

      total_rainfall += rainfall;

      // Check for heavy rain (>30mm)
      if (rainfall > 30) {
        heavy_rain_days++;
      }

      // Track consecutive dry days (<2mm)
      if (rainfall < 2) {
        consecutive_dry_days++;
        max_consecutive_dry_days = Math.max(max_consecutive_dry_days, consecutive_dry_days);
      } else {
        consecutive_dry_days = 0;
      }
    }

    // Calculate summary
    const summary: ForecastSummary = {
      total_rainfall_mm: Math.round(total_rainfall * 10) / 10,
      heavy_rain_days,
      dry_spell_detected: max_consecutive_dry_days >= 3,
      irrigation_recommended: max_consecutive_dry_days >= 3 || total_rainfall < 10
    };

    return {
      location: { lat: latitude, lon: longitude },
      forecast_days: 7,
      daily_data,
      summary
    };

  } catch (error) {
    console.error('Error fetching OpenMeteo forecast:', error);

    // Return fallback data if API fails
    const todayDate = new Date().toISOString().split('T')[0];
    if (!todayDate) {
      throw new Error('Failed to generate date');
    }

    return {
      location: { lat: latitude, lon: longitude },
      forecast_days: 7,
      daily_data: [
        {
          date: todayDate,
          temp_max: 32,
          temp_min: 20,
          rainfall_mm: 0,
          humidity_mean: 65,
          wind_speed_max: 12
        }
      ],
      summary: {
        total_rainfall_mm: 0,
        heavy_rain_days: 0,
        dry_spell_detected: true,
        irrigation_recommended: true
      }
    };
  }
}

// Get active weather alerts from database
export function getAlertsFromDB(db: Database.Database, district: string): AlertsResponse {
  try {
    const alerts = db.prepare(`
      SELECT * FROM weather_alerts
      WHERE district = ? AND valid_until >= date('now')
      ORDER BY
        CASE severity
          WHEN 'Red' THEN 1
          WHEN 'Orange' THEN 2
          WHEN 'Yellow' THEN 3
        END,
        issued_at DESC
    `).all(district) as WeatherAlert[];

    return {
      district,
      active_alerts: alerts
    };
  } catch (error) {
    console.error('Error querying weather alerts:', error);
    return {
      district,
      active_alerts: []
    };
  }
}

// Get soil moisture reading from nearest sensor
export function getSoilMoistureFromDB(
  db: Database.Database,
  latitude: number,
  longitude: number,
  crop_type?: string
): SoilMoisture | null {
  try {
    // Get all sensors with their latest readings
    const sensors = db.prepare(`
      SELECT
        sensor_id,
        latitude,
        longitude,
        moisture_percent,
        timestamp
      FROM soil_moisture_readings
      WHERE timestamp = (
        SELECT MAX(timestamp)
        FROM soil_moisture_readings AS smr2
        WHERE smr2.sensor_id = soil_moisture_readings.sensor_id
      )
      ORDER BY timestamp DESC
    `).all() as Array<{
      sensor_id: string;
      latitude: number;
      longitude: number;
      moisture_percent: number;
      timestamp: string;
    }>;

    // Find nearest sensor within 1km
    let nearestSensor: typeof sensors[0] | null = null;
    let minDistance = 1.0; // 1km threshold

    for (const sensor of sensors) {
      const distance = calculateDistance(latitude, longitude, sensor.latitude, sensor.longitude);
      if (distance < minDistance) {
        minDistance = distance;
        nearestSensor = sensor;
      }
    }

    if (!nearestSensor) {
      return null; // No sensor found within 1km
    }

    // Get optimal moisture range for crop
    const cropToQuery = crop_type || 'Default';
    let dbRange = db.prepare(`
      SELECT min_percent, max_percent
      FROM crop_moisture_ranges
      WHERE crop_type = ?
    `).get(cropToQuery) as { min_percent: number; max_percent: number } | undefined;

    // Fallback to Default if crop not found
    if (!dbRange && crop_type) {
      dbRange = db.prepare(`
        SELECT min_percent, max_percent
        FROM crop_moisture_ranges
        WHERE crop_type = 'Default'
      `).get() as { min_percent: number; max_percent: number } | undefined;
    }

    // Convert to OptimalMoistureRange format
    const optimalRange: OptimalMoistureRange = dbRange
      ? { min: dbRange.min_percent, max: dbRange.max_percent }
      : { min: 50, max: 70 }; // Hard-coded fallback

    // Determine status and recommendation
    const moisture = nearestSensor.moisture_percent;
    let status: 'LOW' | 'ADEQUATE' | 'HIGH';
    let recommendation: string;

    if (moisture < optimalRange.min) {
      status = 'LOW';
      const deficit = optimalRange.min - moisture;
      recommendation = `Irrigation needed. Current moisture (${moisture}%) is below optimal range for ${crop_type || 'crops'} (${optimalRange.min}-${optimalRange.max}%). Deficit: ${Math.round(deficit)}%. Water within 24 hours.`;
    } else if (moisture > optimalRange.max) {
      status = 'HIGH';
      const excess = moisture - optimalRange.max;
      recommendation = `Moisture level (${moisture}%) is above optimal range for ${crop_type || 'crops'} (${optimalRange.min}-${optimalRange.max}%). Excess: ${Math.round(excess)}%. Ensure proper drainage. Delay irrigation.`;
    } else {
      status = 'ADEQUATE';
      recommendation = `Soil moisture (${moisture}%) is within optimal range for ${crop_type || 'crops'} (${optimalRange.min}-${optimalRange.max}%). No immediate irrigation needed. Continue monitoring.`;
    }

    const result: SoilMoisture = {
      location: {
        lat: nearestSensor.latitude,
        lon: nearestSensor.longitude
      },
      moisture_percent: nearestSensor.moisture_percent,
      timestamp: nearestSensor.timestamp,
      optimal_range: optimalRange,
      status,
      recommendation
    };

    // Only add crop_type if it's provided
    if (crop_type !== undefined) {
      result.crop_type = crop_type;
    }

    return result;

  } catch (error) {
    console.error('Error querying soil moisture:', error);
    return null;
  }
}
