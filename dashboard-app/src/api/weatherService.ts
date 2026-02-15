// Direct OpenMeteo API Integration
// Eliminates MCP layer for faster, simpler weather data fetching

export interface DailyForecast {
  date: string;
  temp_max: number;
  temp_min: number;
  rainfall_mm: number;
  humidity_mean: number;
  wind_speed_max: number;
}

export interface WeatherForecast {
  location: { lat: number; lon: number };
  forecast_days: number;
  daily_data: DailyForecast[];
  summary: {
    total_rainfall_mm: number;
    heavy_rain_days: number;
    dry_spell_detected: boolean;
    irrigation_recommended: boolean;
  };
}

/**
 * Fetch weather forecast directly from OpenMeteo API
 * @param latitude - Location latitude
 * @param longitude - Location longitude
 * @param days - Number of forecast days (default: 7)
 * @returns Weather forecast data
 */
export async function fetchWeatherForecast(
  latitude: number,
  longitude: number,
  days: number = 7
): Promise<WeatherForecast> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');

  // Set query parameters for OpenMeteo API
  url.searchParams.append('latitude', latitude.toString());
  url.searchParams.append('longitude', longitude.toString());
  url.searchParams.append(
    'daily',
    'temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_mean,wind_speed_10m_max'
  );
  url.searchParams.append('timezone', 'Asia/Kolkata');
  url.searchParams.append('forecast_days', days.toString());

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`OpenMeteo API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Transform OpenMeteo response to our format
  const daily_data: DailyForecast[] = data.daily.time.map((date: string, i: number) => ({
    date,
    temp_max: Math.round(data.daily.temperature_2m_max[i] * 10) / 10,
    temp_min: Math.round(data.daily.temperature_2m_min[i] * 10) / 10,
    rainfall_mm: Math.round((data.daily.precipitation_sum[i] || 0) * 10) / 10,
    humidity_mean: Math.round(data.daily.relative_humidity_2m_mean[i] || 0),
    wind_speed_max: Math.round((data.daily.wind_speed_10m_max[i] || 0) * 10) / 10,
  }));

  // Calculate summary statistics
  const total_rainfall_mm = daily_data.reduce((sum, day) => sum + day.rainfall_mm, 0);
  const heavy_rain_days = daily_data.filter((day) => day.rainfall_mm > 30).length;
  const consecutive_dry_days = calculateMaxConsecutiveDryDays(daily_data);

  return {
    location: { lat: latitude, lon: longitude },
    forecast_days: days,
    daily_data,
    summary: {
      total_rainfall_mm: Math.round(total_rainfall_mm * 10) / 10,
      heavy_rain_days,
      dry_spell_detected: consecutive_dry_days >= 3,
      irrigation_recommended: consecutive_dry_days >= 3 || total_rainfall_mm < 10,
    },
  };
}

/**
 * Calculate maximum consecutive dry days in the forecast
 * @param dailyData - Array of daily forecast data
 * @returns Maximum number of consecutive dry days
 */
function calculateMaxConsecutiveDryDays(dailyData: DailyForecast[]): number {
  let maxDry = 0;
  let currentDry = 0;

  for (const day of dailyData) {
    if (day.rainfall_mm < 2) {
      currentDry++;
      maxDry = Math.max(maxDry, currentDry);
    } else {
      currentDry = 0;
    }
  }

  return maxDry;
}
