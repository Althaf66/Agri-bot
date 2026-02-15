import { useState, useEffect } from 'react';
import { fetchWeatherForecast } from '../api/weatherService';

interface WeatherWidgetProps {
  location: {
    district: string;
    lat: number;
    lon: number;
  };
  cropPhase: string;
}

// Transform OpenMeteo API response to UI format
const transformOpenMeteoToUI = (dailyData: any[]) => {
  const today = new Date();

  return dailyData.map((day, i) => {
    const date = new Date(day.date);
    const rainfall = day.rainfall_mm || 0;
    const humidity = day.humidity_mean || 65;
    const tempMax = day.temp_max || 30;

    // Determine weather condition based on rainfall and temperature
    let condition;
    if (rainfall > 30) {
      condition = { icon: '⛈️', label: 'Thunderstorm' };
    } else if (rainfall > 10) {
      condition = { icon: '🌧️', label: 'Rainy' };
    } else if (rainfall > 2) {
      condition = { icon: '🌤️', label: 'Partly Cloudy' };
    } else if (humidity > 75) {
      condition = { icon: '☁️', label: 'Cloudy' };
    } else {
      condition = { icon: '☀️', label: 'Sunny' };
    }

    return {
      date: date,
      dayLabel: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short' }),
      fullDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      condition: condition,
      tempMin: Math.round(day.temp_min || 20),
      tempMax: Math.round(tempMax),
      rainfall: Math.round(rainfall),
      humidity: Math.round(humidity),
    };
  });
};

// Fallback mock weather data (only used if API fails)
const generateMockWeather = () => {
  const conditions = [
    { icon: '☀️', label: 'Sunny', temp: [28, 35] },
    { icon: '🌤️', label: 'Partly Cloudy', temp: [25, 32] },
    { icon: '☁️', label: 'Cloudy', temp: [23, 28] },
    { icon: '🌧️', label: 'Rainy', temp: [20, 26] },
    { icon: '⛈️', label: 'Thunderstorm', temp: [19, 24] },
  ];

  const today = new Date();
  const forecast = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);

    // More likely to be sunny/partly cloudy
    const conditionIndex = Math.random() < 0.7 ? Math.floor(Math.random() * 2) : Math.floor(Math.random() * 5);
    const condition = conditions[conditionIndex];

    const tempMin = condition.temp[0] + Math.floor(Math.random() * 3);
    const tempMax = condition.temp[1] + Math.floor(Math.random() * 3);
    const rainfall = condition.label.includes('Rain') || condition.label.includes('Thunder')
      ? Math.floor(Math.random() * 50) + 20
      : 0;

    forecast.push({
      date: date,
      dayLabel: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short' }),
      fullDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      condition: condition,
      tempMin,
      tempMax,
      rainfall,
      humidity: Math.floor(Math.random() * 30) + 50,
    });
  }

  return forecast;
};

export function WeatherWidget({ location, cropPhase }: WeatherWidgetProps) {
  const [forecast, setForecast] = useState<any[]>(generateMockWeather());
  const [dataSource, setDataSource] = useState<'live' | 'demo'>('demo');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadWeatherData();
  }, [location.lat, location.lon]);

  const loadWeatherData = async () => {
    setIsLoading(true);
    try {
      // Direct API call to OpenMeteo (no MCP layer)
      const result = await fetchWeatherForecast(location.lat, location.lon, 7);

      if (result.daily_data && result.daily_data.length > 0) {
        setForecast(transformOpenMeteoToUI(result.daily_data));
        setDataSource('live');
      } else {
        // Fallback to demo data if API returns no data
        setForecast(generateMockWeather());
        setDataSource('demo');
      }
    } catch (error) {
      console.error('Failed to load weather data:', error);
      // Fallback to demo data on error
      setForecast(generateMockWeather());
      setDataSource('demo');
    } finally {
      setIsLoading(false);
    }
  };

  const todayWeather = forecast[0];

  // Calculate total rainfall for next 7 days
  const totalRainfall = forecast.reduce((sum, day) => sum + day.rainfall, 0);
  const rainyDays = forecast.filter(day => day.rainfall > 0).length;

  // Generate irrigation advice based on weather and crop phase
  const getIrrigationAdvice = () => {
    if (totalRainfall > 100) {
      return {
        type: 'warning',
        message: '⚠️ Heavy rainfall expected (>100mm). Skip irrigation for next 3-4 days. Ensure proper drainage.',
        color: 'from-red-50 to-red-100 border-red-200',
        textColor: 'text-red-800',
      };
    } else if (totalRainfall > 50) {
      return {
        type: 'info',
        message: '🌧️ Moderate rainfall expected (50-100mm). Reduce irrigation frequency. Monitor soil moisture.',
        color: 'from-orange-50 to-orange-100 border-orange-200',
        textColor: 'text-orange-800',
      };
    } else if (totalRainfall === 0) {
      return {
        type: 'action',
        message: '☀️ No rainfall expected. Continue regular irrigation schedule. Monitor soil moisture daily.',
        color: 'from-blue-50 to-blue-100 border-blue-200',
        textColor: 'text-blue-800',
      };
    } else {
      return {
        type: 'success',
        message: '✅ Light rainfall expected. Maintain irrigation schedule but adjust based on actual rain received.',
        color: 'from-green-50 to-green-100 border-green-200',
        textColor: 'text-green-800',
      };
    }
  };

  const advice = getIrrigationAdvice();

  // Phase-specific weather alerts
  const getPhaseAlert = () => {
    if (cropPhase === 'sowing' && totalRainfall > 50) {
      return '🌱 Sowing Phase: Heavy rain may affect seed germination. Consider delaying sowing if possible.';
    }
    if (cropPhase === 'growing' && totalRainfall === 0 && forecast[0].tempMax > 35) {
      return '🌿 Growing Phase: High temperatures and no rain. Increase irrigation frequency.';
    }
    if (cropPhase === 'harvest' && totalRainfall > 20) {
      return '✂️ Harvest Phase: Rain expected. Harvest immediately before rain or wait until fields dry.';
    }
    if (cropPhase === 'pest_watch' && forecast[0].humidity > 75 && totalRainfall > 30) {
      return '🔍 Pest Watch: High humidity + rain creates disease-favorable conditions. Apply preventive sprays.';
    }
    return null;
  };

  const phaseAlert = getPhaseAlert();

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-semibold text-gray-800">
              🌤️ Weather Forecast
            </h2>
            {dataSource === 'live' && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-semibold">
                🟢 LIVE
              </span>
            )}
            {dataSource === 'demo' && (
              <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded font-semibold">
                🔴 DEMO
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">
            {location.district} ({location.lat.toFixed(2)}°N, {location.lon.toFixed(2)}°E)
          </p>
        </div>
        <div className="text-right">
          <div className="text-4xl">{todayWeather?.condition.icon}</div>
          <div className="text-sm text-gray-600 mt-1">{todayWeather?.condition.label}</div>
        </div>
      </div>

      {/* Today's Highlight */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-sm text-gray-600">Temperature</div>
            <div className="text-2xl font-bold text-gray-900">
              {todayWeather?.tempMin}° - {todayWeather?.tempMax}°C
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">Rainfall</div>
            <div className="text-2xl font-bold text-blue-600">
              {todayWeather?.rainfall}mm
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">Humidity</div>
            <div className="text-2xl font-bold text-green-600">
              {todayWeather?.humidity}%
            </div>
          </div>
        </div>
      </div>

      {/* 7-Day Forecast */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">7-Day Forecast</h3>
        <div className="grid grid-cols-7 gap-2">
          {forecast.map((day, index) => (
            <div
              key={index}
              className={`text-center p-3 rounded-lg border-2 transition-all ${
                index === 0
                  ? 'bg-blue-50 border-blue-300 shadow-md'
                  : 'bg-gray-50 border-gray-200 hover:border-blue-300 hover:shadow'
              }`}
            >
              <div className={`text-xs font-semibold mb-1 ${index === 0 ? 'text-blue-600' : 'text-gray-600'}`}>
                {day.dayLabel}
              </div>
              <div className="text-xs text-gray-500 mb-2">{day.fullDate}</div>
              <div className="text-2xl mb-2">{day.condition.icon}</div>
              <div className="text-xs font-semibold text-gray-900 mb-1">
                {day.tempMax}°/{day.tempMin}°
              </div>
              {day.rainfall > 0 && (
                <div className="text-xs text-blue-600 font-semibold">
                  💧 {day.rainfall}mm
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Irrigation Advice */}
      <div className={`p-4 bg-gradient-to-r ${advice.color} border rounded-lg mb-4`}>
        <div className={`text-sm font-semibold mb-2 ${advice.textColor}`}>
          💧 Irrigation Advice (Next 7 Days)
        </div>
        <p className={`text-sm ${advice.textColor}`}>
          {advice.message}
        </p>
        <div className="flex justify-between mt-3 text-xs text-gray-600">
          <span>Total Rainfall: <span className="font-semibold">{totalRainfall}mm</span></span>
          <span>Rainy Days: <span className="font-semibold">{rainyDays} of 7</span></span>
        </div>
      </div>

      {/* Phase-Specific Alert */}
      {phaseAlert && (
        <div className="p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 border border-yellow-200 rounded-lg">
          <div className="text-sm font-semibold text-yellow-800 mb-2">
            ⚠️ Phase-Specific Weather Alert
          </div>
          <p className="text-sm text-yellow-900">{phaseAlert}</p>
        </div>
      )}

      {/* Weather Summary */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <div className="text-xs font-semibold text-gray-700 mb-2">
          📊 Weekly Summary
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
          <div>
            <span>Avg Temperature:</span>
            <span className="float-right font-semibold text-gray-900">
              {Math.round(forecast.reduce((sum, d) => sum + d.tempMax, 0) / 7)}°C
            </span>
          </div>
          <div>
            <span>Total Rainfall:</span>
            <span className="float-right font-semibold text-blue-600">
              {totalRainfall}mm
            </span>
          </div>
          <div>
            <span>Sunny Days:</span>
            <span className="float-right font-semibold text-yellow-600">
              {forecast.filter(d => d.condition.label === 'Sunny').length} days
            </span>
          </div>
          <div>
            <span>Rainy Days:</span>
            <span className="float-right font-semibold text-blue-600">
              {rainyDays} days
            </span>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-3 text-center">
        Weather data powered by OpenMeteo API • Updated hourly
      </p>
    </div>
  );
}
