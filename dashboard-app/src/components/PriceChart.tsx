import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { mcpClient } from '../api/mcpClient';

interface PriceChartProps {
  cropName: string;
  mandiName?: string;
  currentPrice?: number;
}

export function PriceChart({ cropName, mandiName = 'Dharwad APMC', currentPrice = 3200 }: PriceChartProps) {
  const [wpiPrediction7Day, setWpiPrediction7Day] = useState<any>(null);
  const [wpiPrediction14Day, setWpiPrediction14Day] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWPIPredictions = async () => {
      try {
        setLoading(true);
        // Fetch WPI predictions from the agri-price-prediction server
        const pred7 = await mcpClient.getWPIPrediction(cropName.toLowerCase(), 7);
        const pred14 = await mcpClient.getWPIPrediction(cropName.toLowerCase(), 14);

        setWpiPrediction7Day(pred7);
        setWpiPrediction14Day(pred14);
      } catch (error) {
        console.error('Error loading WPI predictions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadWPIPredictions();
  }, [cropName]);

  // Calculate predicted prices from WPI % change
  const predicted7DayPrice = wpiPrediction7Day && wpiPrediction7Day.percent_change
    ? Math.round(currentPrice * (1 + wpiPrediction7Day.percent_change / 100))
    : null;

  const predicted14DayPrice = wpiPrediction14Day && wpiPrediction14Day.percent_change
    ? Math.round(currentPrice * (1 + wpiPrediction14Day.percent_change / 100))
    : null;

  const isIncreasing = wpiPrediction7Day && wpiPrediction7Day.percent_change > 0;

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="animate-pulse">
          <div className="h-4 bg-slate-700 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="h-20 bg-slate-700 rounded"></div>
            <div className="h-20 bg-slate-700 rounded"></div>
            <div className="h-20 bg-slate-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <h2 className="text-lg font-semibold text-slate-200 mb-4">
        📈 Price Intelligence (WPI-Based)
      </h2>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-700/50 p-3 rounded-lg">
          <p className="text-xs text-slate-400">Current Price</p>
          <p className="text-xl font-bold text-slate-100">₹{currentPrice.toLocaleString()}</p>
          <p className="text-xs text-slate-500">per quintal</p>
        </div>

        {wpiPrediction7Day && (
          <div className="bg-emerald-900/20 p-3 rounded-lg border border-emerald-600/30">
            <p className="text-xs text-slate-400">7-Day Forecast</p>
            <p className="text-xl font-bold text-emerald-400">
              ₹{predicted7DayPrice?.toLocaleString()}
            </p>
            <p className="text-xs text-emerald-500 flex items-center gap-1">
              {wpiPrediction7Day.percent_change > 0 ? '↑' : '↓'}{' '}
              {Math.abs(wpiPrediction7Day.percent_change).toFixed(1)}%
              <span className={`ml-1 px-1 rounded text-[10px] ${
                wpiPrediction7Day.confidence_score === 'HIGH' ? 'bg-green-600/30' :
                wpiPrediction7Day.confidence_score === 'MEDIUM' ? 'bg-amber-600/30' :
                'bg-red-600/30'
              }`}>
                {wpiPrediction7Day.confidence_score}
              </span>
            </p>
          </div>
        )}

        {wpiPrediction14Day && (
          <div className="bg-amber-900/20 p-3 rounded-lg border border-amber-600/30">
            <p className="text-xs text-slate-400">14-Day Forecast</p>
            <p className="text-xl font-bold text-amber-400">
              ₹{predicted14DayPrice?.toLocaleString()}
            </p>
            <p className="text-xs text-amber-500 flex items-center gap-1">
              {wpiPrediction14Day.percent_change > 0 ? '↑' : '↓'}{' '}
              {Math.abs(wpiPrediction14Day.percent_change).toFixed(1)}%
              <span className={`ml-1 px-1 rounded text-[10px] ${
                wpiPrediction14Day.confidence_score === 'HIGH' ? 'bg-green-600/30' :
                wpiPrediction14Day.confidence_score === 'MEDIUM' ? 'bg-amber-600/30' :
                'bg-red-600/30'
              }`}>
                {wpiPrediction14Day.confidence_score}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* WPI Source indicator */}
      <div className="mt-4 p-3 bg-blue-900/20 border border-blue-600/30 rounded-lg">
        <p className="text-sm text-blue-300">
          📊 <strong>Data Source:</strong> National Statistics Office (NSO) India — Wholesale Price Index (WPI)
        </p>
        <p className="text-xs text-blue-400 mt-1">
          Predictions based on 90-day WPI historical trends using linear regression
        </p>
      </div>

      {/* WPI Trend Summary */}
      {wpiPrediction7Day && (
        <div className="mt-4 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
          <div className="text-sm font-semibold text-slate-300 mb-2">
            📈 National WPI Trend
          </div>
          <p className="text-sm text-slate-400">
            {wpiPrediction7Day.trend_direction === 'RISING' ? (
              <>
                Wholesale prices are <span className="font-semibold text-emerald-400">trending upward</span> by{' '}
                <span className="font-semibold text-emerald-400">{wpiPrediction7Day.percent_change.toFixed(1)}%</span>{' '}
                over the next 7 days (NSO India).
              </>
            ) : wpiPrediction7Day.trend_direction === 'FALLING' ? (
              <>
                Wholesale prices are <span className="font-semibold text-red-400">declining</span> by{' '}
                <span className="font-semibold text-red-400">{Math.abs(wpiPrediction7Day.percent_change).toFixed(1)}%</span>{' '}
                over the next 7 days (NSO India).
              </>
            ) : (
              <>
                Wholesale prices are <span className="font-semibold text-slate-300">stable</span> with minimal change expected.
              </>
            )}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Current WPI: {wpiPrediction7Day.current_wpi} → Predicted: {wpiPrediction7Day.predicted_wpi} (variance: {wpiPrediction7Day.variance?.toFixed(2)})
          </p>
        </div>
      )}
    </div>
  );
}
