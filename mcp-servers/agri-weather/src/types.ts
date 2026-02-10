export interface Location {
  lat: number;
  lon: number;
}

export interface DailyForecast {
  date: string;
  temp_max: number;
  temp_min: number;
  rainfall_mm: number;
  humidity_mean: number;
  wind_speed_max: number;
}

export interface ForecastSummary {
  total_rainfall_mm: number;
  heavy_rain_days: number;
  dry_spell_detected: boolean;
  irrigation_recommended: boolean;
}

export interface WeatherForecast {
  location: Location;
  forecast_days: number;
  daily_data: DailyForecast[];
  summary: ForecastSummary;
}

export interface WeatherAlert {
  id: string;
  type: 'HEAVY_RAIN' | 'HIGH_HUMIDITY' | 'DRY_SPELL' | 'FROST' | 'HEATWAVE';
  severity: 'Yellow' | 'Orange' | 'Red';
  issued_at: string;
  valid_until: string;
  message: string;
  advice: string;
}

export interface AlertsResponse {
  district: string;
  active_alerts: WeatherAlert[];
}

export interface OptimalMoistureRange {
  min: number;
  max: number;
}

export interface SoilMoisture {
  location: Location;
  moisture_percent: number;
  timestamp: string;
  crop_type?: string;
  optimal_range: OptimalMoistureRange;
  status: 'LOW' | 'ADEQUATE' | 'HIGH';
  recommendation: string;
}
