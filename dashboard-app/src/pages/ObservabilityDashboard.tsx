import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import metricsClient from '../api/metricsClient';
import type { ObservabilityData } from '../api/metricsClient';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';

const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

export function ObservabilityDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<ObservabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = async () => {
    try {
      setError(null);
      const metrics = await metricsClient.getObservabilityData();
      setData(metrics);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to load observability data:', error);
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to connect to Prometheus. Ensure it is running at http://localhost:9090'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleBack = () => {
    const storedFarmer = localStorage.getItem('farmer');
    if (storedFarmer) {
      try {
        const farmer = JSON.parse(storedFarmer);
        navigate(farmer.role === 'trader' ? '/trader' : '/dashboard');
        return;
      } catch { /* fall through */ }
    }
    navigate('/');
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
          <p className="mt-4 text-slate-400">Loading metrics...</p>
        </div>
      </div>
    );
  }

  // Error state UI
  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-3xl w-full">
          <div className="bg-slate-800 rounded-xl shadow-2xl p-8">
            {/* Error Icon */}
            <div className="flex justify-center mb-6">
              <div className="bg-red-900/30 p-4 rounded-full">
                <svg className="w-16 h-16 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>

            {/* Error Title */}
            <h2 className="text-2xl font-bold text-red-400 text-center mb-3">
              Observability Connection Failed
            </h2>

            {/* Error Message */}
            <p className="text-slate-300 text-center text-lg mb-8 leading-relaxed">
              {error}
            </p>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-center mb-8">
              <button
                onClick={loadMetrics}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retry Connection
              </button>
              <button
                onClick={handleBack}
                className="px-6 py-3 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-all font-medium"
              >
                Back to Dashboard
              </button>
            </div>

            {/* Troubleshooting Guide */}
            <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-700">
              <h3 className="text-slate-300 font-semibold mb-4 flex items-center text-lg">
                <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Troubleshooting Steps
              </h3>
              <ol className="text-slate-400 space-y-3 text-sm">
                <li className="flex items-start">
                  <span className="text-blue-400 font-bold mr-3 mt-0.5">1.</span>
                  <div>
                    <strong className="text-slate-300">Verify Archestra Platform is running:</strong>
                    <code className="block bg-slate-800 px-3 py-2 rounded mt-2 text-blue-300 text-xs">
                      curl http://localhost:9090/metrics | grep llm_
                    </code>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-400 font-bold mr-3 mt-0.5">2.</span>
                  <div>
                    <strong className="text-slate-300">Check Prometheus is running and scraping:</strong>
                    <code className="block bg-slate-800 px-3 py-2 rounded mt-2 text-blue-300 text-xs">
                      curl http://localhost:9090/api/v1/query?query=up
                    </code>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-400 font-bold mr-3 mt-0.5">3.</span>
                  <div>
                    <strong className="text-slate-300">Verify prometheus.yml includes Archestra Platform target:</strong>
                    <p className="text-slate-500 text-xs mt-1">Check for job_name: 'archestra-platform' with target localhost:9090</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-400 font-bold mr-3 mt-0.5">4.</span>
                  <div>
                    <strong className="text-slate-300">Check browser console for CORS errors:</strong>
                    <p className="text-slate-500 text-xs mt-1">Press F12 → Console tab to see network errors</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-400 font-bold mr-3 mt-0.5">5.</span>
                  <div>
                    <strong className="text-slate-300">Restart Prometheus after config changes:</strong>
                    <code className="block bg-slate-800 px-3 py-2 rounded mt-2 text-blue-300 text-xs">
                      docker restart prometheus
                    </code>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-12">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-blue-400">
              AgriBot Observability
            </h1>
            <p className="text-sm text-slate-400">
              Real-time metrics — Last refresh: {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm text-green-400">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              Live
            </span>
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total Tool Calls', value: data.summary.total_tool_calls.toLocaleString(), color: 'text-blue-400' },
            { label: 'Avg Response', value: `${data.summary.avg_response_time_ms}ms`, color: 'text-green-400' },
            { label: 'Error Rate', value: `${data.summary.error_rate_percent.toFixed(1)}%`, color: data.summary.error_rate_percent > 5 ? 'text-red-400' : 'text-green-400' },
            { label: 'Security Events', value: data.summary.security_events.toString(), color: 'text-amber-400' },
            { label: 'Active Sessions', value: data.summary.active_sessions.toString(), color: 'text-purple-400' },
            { label: 'Uptime', value: `${data.summary.uptime_hours}h`, color: 'text-emerald-400' },
          ].map((card) => (
            <div key={card.label} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <p className="text-xs text-slate-400 mb-1">{card.label}</p>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Tool Call Frequency + Response Time */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tool Call Frequency */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-slate-200 mb-4">Tool Call Frequency</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.tool_calls.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis dataKey="tool_name" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} width={140} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                  labelStyle={{ color: '#e2e8f0' }}
                  itemStyle={{ color: '#93c5fd' }}
                />
                <Bar dataKey="total_calls" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Response Time */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-slate-200 mb-4">Avg Response Time (ms)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.tool_calls.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis dataKey="tool_name" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} width={140} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                  labelStyle={{ color: '#e2e8f0' }}
                  itemStyle={{ color: '#fbbf24' }}
                />
                <Bar dataKey="avg_latency_ms" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cost + Security */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cost Tracking */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-slate-200 mb-4">Cost Tracking (USD)</h2>
            <div className="space-y-3 mb-4">
              <div className="flex justify-between">
                <span className="text-slate-400">Today</span>
                <span className="text-green-400 font-semibold">${data.cost.today_usd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">This Week</span>
                <span className="text-blue-400 font-semibold">${data.cost.week_usd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">This Month</span>
                <span className="text-purple-400 font-semibold">${data.cost.month_usd.toFixed(2)}</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={data.cost.by_model}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  dataKey="cost_usd"
                  nameKey="model"
                  label={({ model, cost_usd }) => `${model}: $${cost_usd.toFixed(2)}`}
                >
                  {data.cost.by_model.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Dual LLM Security */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-slate-200 mb-4">Dual LLM Security</h2>
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                  <span className="text-slate-300">Safe</span>
                </div>
                <span className="text-green-400 font-bold text-xl">{data.security.total_safe}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-amber-500 rounded-full"></span>
                  <span className="text-slate-300">Suspicious</span>
                </div>
                <span className="text-amber-400 font-bold text-xl">{data.security.total_suspicious}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                  <span className="text-slate-300">Dangerous</span>
                </div>
                <span className="text-red-400 font-bold text-xl">{data.security.total_dangerous}</span>
              </div>
            </div>
            {/* Safety bar */}
            <div className="mt-4">
              <div className="flex h-4 rounded-full overflow-hidden">
                <div className="bg-green-500" style={{ width: `${(data.security.total_safe / (data.security.total_safe + data.security.total_suspicious + data.security.total_dangerous)) * 100}%` }}></div>
                <div className="bg-amber-500" style={{ width: `${(data.security.total_suspicious / (data.security.total_safe + data.security.total_suspicious + data.security.total_dangerous)) * 100}%` }}></div>
                <div className="bg-red-500" style={{ width: `${(data.security.total_dangerous / (data.security.total_safe + data.security.total_suspicious + data.security.total_dangerous)) * 100}%` }}></div>
              </div>
              <p className="text-xs text-slate-500 mt-1">Quarantine inspection results across all external APIs</p>
            </div>
          </div>

          {/* RBAC Denials */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-slate-200 mb-4">
              RBAC Denials
              <span className="ml-2 text-sm font-normal text-red-400">({data.rbac.total_denials} total)</span>
            </h2>
            <div className="space-y-3">
              {data.rbac.denials.map((denial, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mr-2 ${
                      denial.role === 'trader' ? 'bg-amber-900 text-amber-300' : 'bg-green-900 text-green-300'
                    }`}>
                      {denial.role}
                    </span>
                    <span className="text-slate-300 font-mono text-xs">{denial.tool_name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-red-400 font-semibold">{denial.denial_count}</span>
                    {denial.last_denied && (
                      <p className="text-xs text-slate-500">{denial.last_denied}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Error Rate + Token Usage */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Error Rate */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-slate-200 mb-4">Error Rate (5-min rolling)</h2>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.error_rate_history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="timestamp" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[0, 5]} unit="%" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                  labelStyle={{ color: '#e2e8f0' }}
                  formatter={(value: number) => [`${value.toFixed(2)}%`, 'Error Rate']}
                />
                <Line type="monotone" dataKey="rate" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Token Usage */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-slate-200 mb-4">Token Usage by Model</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.token_usage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="model" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Legend wrapperStyle={{ color: '#94a3b8' }} />
                <Bar dataKey="input_tokens" fill="#3b82f6" name="Input" radius={[4, 4, 0, 0]} />
                <Bar dataKey="output_tokens" fill="#10b981" name="Output" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 pt-4">
          AgriBot Observability — Archestra Platform (9090) + AgriBot Metrics — Auto-refresh 15s
        </div>
      </main>
    </div>
  );
}
