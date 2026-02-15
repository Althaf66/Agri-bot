import { useEffect, useState } from 'react';
import { mcpClient } from '../api/mcpClient';

interface Scenario {
  action: string;
  price_per_quintal: number;
  revenue: number;
  costs: number;
  net_profit: number;
  profit_vs_now?: number;
  risk: string;
  confidence?: string;
  wpi_change_percent?: number;
}

interface ProfitAnalysisResult {
  crop: string;
  quantity_quintals: number;
  current_market_price: number;
  scenarios: Scenario[];
  recommendation: string;
  weather_forecast: string;
  wpi_source: string;
  note: string;
}

export interface ProfitAnalysisProps {
  cropName: string;
  quantity: number;
  currentPrice: number;
}

export function ProfitAnalysis({
  cropName,
  quantity,
  currentPrice
}: ProfitAnalysisProps) {
  const [result, setResult] = useState<ProfitAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAnalysis = async () => {
      if (currentPrice <= 0 || quantity <= 0) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const analysisResult = await mcpClient.analyzeProfitScenarios(
          cropName,
          quantity,
          currentPrice
        );
        setResult(analysisResult);
      } catch (err: any) {
        console.error('Error loading profit analysis:', err);
        setError(err.message || 'Failed to load profit analysis');
      } finally {
        setLoading(false);
      }
    };

    loadAnalysis();
  }, [cropName, quantity, currentPrice]);

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="animate-pulse">
          <div className="h-4 bg-slate-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-slate-700 rounded"></div>
            <div className="h-20 bg-slate-700 rounded"></div>
            <div className="h-20 bg-slate-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-red-600/50">
        <h2 className="text-lg font-semibold text-slate-200 mb-2">
          💰 Profit Analysis
        </h2>
        <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-4">
          <p className="text-sm text-red-300">⚠️ {error}</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-slate-200 mb-2">
          💰 Profit Analysis
        </h2>
        <p className="text-sm text-slate-400">
          Enter crop details to see profit scenarios
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <h2 className="text-lg font-semibold text-slate-200 mb-4">
        💰 Profit Analysis ({quantity} quintals)
      </h2>

      <div className="space-y-3">
        {result.scenarios.map((scenario, index) => {
          const isRecommended = scenario.action.toLowerCase().includes(
            result.recommendation.toLowerCase().split(' ').slice(0, 2).join(' ')
          );
          const profitChange = scenario.profit_vs_now || 0;

          // Determine confidence badge color
          const confidenceBgColor =
            scenario.confidence === 'HIGH'
              ? 'bg-green-600/30 text-green-400'
              : scenario.confidence === 'MEDIUM'
              ? 'bg-amber-600/30 text-amber-400'
              : scenario.confidence === 'LOW'
              ? 'bg-red-600/30 text-red-400'
              : 'bg-slate-600/30 text-slate-400';

          return (
            <div
              key={index}
              className={`p-4 rounded-lg border transition-all ${
                isRecommended
                  ? 'bg-emerald-900/30 border-emerald-600/50 shadow-lg shadow-emerald-900/20'
                  : 'bg-slate-700/30 border-slate-600'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-slate-200">{scenario.action}</p>
                    {scenario.confidence && scenario.confidence !== 'CERTAIN' && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-semibold ${confidenceBgColor}`}
                      >
                        {scenario.confidence}
                      </span>
                    )}
                    {scenario.wpi_change_percent !== undefined && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          scenario.wpi_change_percent > 0
                            ? 'bg-blue-600/30 text-blue-400'
                            : 'bg-orange-600/30 text-orange-400'
                        }`}
                      >
                        WPI {scenario.wpi_change_percent > 0 ? '+' : ''}
                        {scenario.wpi_change_percent.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  {isRecommended && (
                    <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded mt-2 inline-block font-semibold">
                      ✅ RECOMMENDED
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-emerald-400">
                    ₹{scenario.net_profit.toLocaleString()}
                  </p>
                  {profitChange !== 0 && (
                    <p
                      className={`text-sm font-semibold ${
                        profitChange > 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {profitChange > 0 ? '+' : ''}₹{profitChange.toLocaleString()}{' '}
                      vs now
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm text-slate-400">
                <div>
                  <p className="text-xs text-slate-500">Price per quintal</p>
                  <p className="font-semibold text-slate-300">
                    ₹{scenario.price_per_quintal.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Revenue</p>
                  <p className="font-semibold text-slate-300">
                    ₹{scenario.revenue.toLocaleString()}
                  </p>
                </div>
                {scenario.costs > 0 && (
                  <div>
                    <p className="text-xs text-slate-500">Storage costs</p>
                    <p className="font-semibold text-red-400">
                      -₹{scenario.costs.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {scenario.risk && (
                <div className="mt-3 pt-3 border-t border-slate-600">
                  <p className="text-xs text-amber-400 flex items-start gap-1">
                    <span>⚠️</span>
                    <span>{scenario.risk}</span>
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recommendation */}
      <div className="mt-4 p-3 bg-emerald-900/20 border border-emerald-600/30 rounded-lg">
        <p className="text-sm text-emerald-300">
          <strong className="font-semibold">💡 Recommendation:</strong>{' '}
          {result.recommendation}
        </p>
        {result.weather_forecast && (
          <p className="text-xs text-emerald-400 mt-1">
            🌤️ Weather: {result.weather_forecast}
          </p>
        )}
      </div>

      {/* Data source footer */}
      <div className="mt-3 pt-3 border-t border-slate-700">
        <p className="text-xs text-slate-500">
          📊 <strong>Data Source:</strong> {result.wpi_source}
        </p>
        <p className="text-xs text-slate-500 mt-1">{result.note}</p>
      </div>
    </div>
  );
}
