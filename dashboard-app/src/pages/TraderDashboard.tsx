import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { mcpClient } from '../api/mcpClient';
import { fetchWPIData } from '../api/wpiService';
import { ThemeToggle } from '../components/ThemeToggle';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface MandiPrice {
  mandi_id: string;
  mandi_name: string;
  price_per_quintal: number;
  updated: string;
}

interface PriceTrend {
  date: string;
  price: number;
}

interface WeatherAlert {
  alert_type: string;
  severity: string;
  district: string;
  message: string;
}

export function TraderDashboard() {
  const navigate = useNavigate();
  const [traderName, setTraderName] = useState('');
  const [traderMandi, setTraderMandi] = useState('');
  const [prices, setPrices] = useState<Record<string, MandiPrice[]>>({});
  const [trends, setTrends] = useState<PriceTrend[]>([]);
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [wpiData, setWpiData] = useState<any[]>([]);
  const [wpiDataSource, setWpiDataSource] = useState<'live' | 'demo'>('demo');
  const [loading, setLoading] = useState(true);
  const [selectedCrop, setSelectedCrop] = useState('Rice');
  const [rbacModal, setRbacModal] = useState<{ show: boolean; title: string; message: string }>({
    show: false, title: '', message: ''
  });

  const crops = ['Rice', 'Wheat', 'Tomato', 'Maize', 'Cotton'];

  useEffect(() => {
    const storedFarmer = localStorage.getItem('farmer');
    if (!storedFarmer) {
      navigate('/');
      return;
    }

    try {
      const trader = JSON.parse(storedFarmer);
      if (trader.role !== 'trader') {
        navigate('/dashboard');
        return;
      }
      setTraderName(trader.name || 'Trader');
      setTraderMandi(trader.mandi || trader.location?.district || 'Dharwad APMC');
    } catch {
      navigate('/');
      return;
    }

    loadData();
  }, [navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [riceResult, wheatResult, tomatoResult, alertsResult, trendResult, wpiResult] = await Promise.all([
        mcpClient.getMandiPrices('Rice'),
        mcpClient.getMandiPrices('Wheat'),
        mcpClient.getMandiPrices('Tomato'),
        mcpClient.getWeatherAlerts('Dharwad'),
        mcpClient.getPriceTrend('Rice', 'dharwad_apmc'),
        // Direct API call to MOSPI (no MCP layer)
        fetchWPIData(['Rice', 'Wheat', 'Pulses', 'Vegetables', 'Fruits', 'Oilseeds']),
      ]);

      const priceMap: Record<string, MandiPrice[]> = {};
      if (riceResult.prices) priceMap['Rice'] = riceResult.prices;
      if (wheatResult.prices) priceMap['Wheat'] = wheatResult.prices;
      if (tomatoResult.prices) priceMap['Tomato'] = tomatoResult.prices;
      setPrices(priceMap);

      if (trendResult.trend) setTrends(trendResult.trend);
      if (alertsResult.alerts) setAlerts(alertsResult.alerts);

      // Process WPI data from direct API
      if (wpiResult.success && wpiResult.data && wpiResult.data.length > 0) {
        // Transform WPI data to chart format
        const chartData = wpiResult.data.map((item) => ({
          commodity: item.commodity,
          wpi: item.wpi_index,
          change: item.change_percent || 0,
        }));

        setWpiData(chartData);
        setWpiDataSource('live');
      } else {
        setWpiDataSource('demo');
      }
    } catch (error) {
      console.error('Error loading trader data:', error);
      setWpiDataSource('demo');
    } finally {
      setLoading(false);
    }
  };

  const handleBlockedAccess = (feature: string) => {
    const messages: Record<string, string> = {
      'Crop Health': 'Access Denied: Crop diagnosis tools require Farmer or Officer role. [Archestra RBAC Policy]',
      'Financial Schemes': 'Access Denied: Financial tools require Farmer or Officer role. [Archestra RBAC Policy]',
      'Farmer Profiles': 'Access Denied: Individual farmer data is restricted. [Archestra RBAC Policy]',
    };
    setRbacModal({ show: true, title: feature, message: messages[feature] || 'Access Denied' });
  };

  const handleLogout = () => {
    // Preserve theme preference
    const theme = localStorage.getItem('agribot-theme');

    // Clear all localStorage (removes farmer, farmerId, and any cached session data)
    localStorage.clear();

    // Restore theme
    if (theme) {
      localStorage.setItem('agribot-theme', theme);
    }

    navigate('/');
  };

  const getTopPrices = () => {
    const topCrops = [
      { crop: 'Rice', price: prices['Rice']?.[0]?.price_per_quintal || 3200, change: 12 },
      { crop: 'Wheat', price: prices['Wheat']?.[0]?.price_per_quintal || 2400, change: -3 },
      { crop: 'Tomato', price: prices['Tomato']?.[0]?.price_per_quintal || 4200, change: 31 },
    ];
    return topCrops;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-amber-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
          <p className="mt-4 text-gray-600 dark:text-slate-400 dark:text-slate-400">Loading market data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50 dark:bg-slate-900 pb-20">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-40 border-b-2 border-amber-400 dark:border-amber-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-amber-800 dark:text-amber-400">
              AgriBot Trader Portal
            </h1>
            <p className="text-sm text-gray-600 dark:text-slate-400 dark:text-slate-400">
              Welcome, {traderName} ({traderMandi})
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              to="/trader/chat"
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
            >
              Chat with Archestra
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Price Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {getTopPrices().map((item) => (
            <div key={item.crop} className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 border-l-4 border-amber-400 dark:border-amber-600">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500 dark:text-slate-500 dark:text-slate-400 font-medium">{item.crop}</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-slate-100 dark:text-slate-100 mt-1">
                    ₹{item.price.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-500 dark:text-slate-400 mt-1">per quintal</p>
                </div>
                <span className={`px-2 py-1 rounded text-sm font-semibold ${
                  item.change > 0
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {item.change > 0 ? '▲' : '▼'} {Math.abs(item.change)}%
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Price Comparison Table + Crop Selector */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-200">
              Market Prices by Mandi
            </h2>
            <div className="flex gap-2">
              {crops.map((crop) => (
                <button
                  key={crop}
                  onClick={() => setSelectedCrop(crop)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    selectedCrop === crop
                      ? 'bg-amber-600 text-white'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {crop}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-gray-600 dark:text-slate-400 font-medium">Mandi</th>
                  <th className="text-right py-3 px-4 text-gray-600 dark:text-slate-400 font-medium">Price (₹/quintal)</th>
                  <th className="text-right py-3 px-4 text-gray-600 dark:text-slate-400 font-medium">vs MSP</th>
                  <th className="text-right py-3 px-4 text-gray-600 dark:text-slate-400 font-medium">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {(prices[selectedCrop] || [
                  { mandi_id: 'dharwad', mandi_name: 'Dharwad APMC', price_per_quintal: 3200, updated: '2 hrs ago' },
                  { mandi_id: 'belgaum', mandi_name: 'Belgaum APMC', price_per_quintal: 3150, updated: '3 hrs ago' },
                  { mandi_id: 'hubli', mandi_name: 'Hubli APMC', price_per_quintal: 3280, updated: '1 hr ago' },
                  { mandi_id: 'gadag', mandi_name: 'Gadag APMC', price_per_quintal: 3100, updated: '4 hrs ago' },
                  { mandi_id: 'bellary', mandi_name: 'Bellary APMC', price_per_quintal: 3350, updated: '2 hrs ago' },
                ]).map((mandi) => (
                  <tr key={mandi.mandi_id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-amber-50 dark:hover:bg-slate-700/50">
                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-slate-100">{mandi.mandi_name}</td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-slate-100">
                      ₹{mandi.price_per_quintal.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`${mandi.price_per_quintal > 2300 ? 'text-green-600' : 'text-red-600'}`}>
                        {mandi.price_per_quintal > 2300 ? '+' : ''}{Math.round(((mandi.price_per_quintal - 2300) / 2300) * 100)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-500 dark:text-slate-500">{mandi.updated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Middle Row: Price Trends + Weather/RBAC */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Price Trend Chart */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-200 mb-4">
              Price Trends (7-day)
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trends.length > 0 ? trends : [
                { date: 'Mon', price: 3100 },
                { date: 'Tue', price: 3150 },
                { date: 'Wed', price: 3080 },
                { date: 'Thu', price: 3200 },
                { date: 'Fri', price: 3250 },
                { date: 'Sat', price: 3180 },
                { date: 'Sun', price: 3320 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={['dataMin - 100', 'dataMax + 100']} />
                <Tooltip formatter={(value: number) => [`₹${value}`, 'Price']} />
                <Line type="monotone" dataKey="price" stroke="#d97706" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Weather Alerts + RBAC Blocked Cards */}
          <div className="space-y-4">
            {/* Weather Alerts */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-200 mb-3">
                Weather Alerts
              </h2>
              <div className="space-y-2">
                {(alerts.length > 0 ? alerts : [
                  { alert_type: 'HEAVY_RAIN', severity: 'HIGH', district: 'Dharwad', message: 'Heavy rain expected - may affect supply chains' },
                  { alert_type: 'HIGH_HUMIDITY', severity: 'MEDIUM', district: 'Belgaum', message: 'High humidity - stored produce at risk' },
                  { alert_type: 'TEMPERATURE', severity: 'LOW', district: 'Hubli', message: 'Temperature dropping - cold storage advisory' },
                ]).map((alert, i) => (
                  <div key={i} className={`p-3 rounded-lg border text-sm ${
                    alert.severity === 'HIGH' ? 'bg-red-50 border-red-200 text-red-700' :
                    alert.severity === 'MEDIUM' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                    'bg-blue-50 border-blue-200 text-blue-700'
                  }`}>
                    <span className="font-medium">{alert.district}:</span> {alert.message}
                  </div>
                ))}
              </div>
            </div>

            {/* RBAC Blocked Cards */}
            <div className="grid grid-cols-1 gap-3">
              {[
                { title: 'Crop Health', icon: '🔒' },
                { title: 'Financial Schemes', icon: '🔒' },
                { title: 'Farmer Profiles', icon: '🔒' },
              ].map((blocked) => (
                <button
                  key={blocked.title}
                  onClick={() => handleBlockedAccess(blocked.title)}
                  className="bg-gray-100 dark:bg-slate-700 rounded-lg p-4 text-left border border-gray-200 dark:border-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors cursor-pointer opacity-60"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-500 dark:text-slate-500">
                      {blocked.icon} {blocked.title}
                    </span>
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded font-medium">
                      RESTRICTED
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Requires Farmer or Officer role</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* WPI National Trends Section */}
        <div className="bg-white rounded-lg shadow p-6 border-t-4 border-blue-500">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-200">
              WPI National Trends
            </h2>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
              Powered by NSO India
            </span>
            {wpiDataSource === 'live' && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-semibold">
                🟢 LIVE
              </span>
            )}
            {wpiDataSource === 'demo' && (
              <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded font-semibold">
                🔴 DEMO
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
            Wholesale Price Index for agricultural commodities — sourced directly from India's National Statistics Office eSankhyiki API
          </p>
          {wpiData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={wpiData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="commodity" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => [value.toFixed(1), 'WPI Index']} />
                <Bar dataKey="wpi" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[
                { commodity: 'Rice', wpi: 178.2, change: 5.2 },
                { commodity: 'Wheat', wpi: 165.4, change: -1.8 },
                { commodity: 'Pulses', wpi: 192.1, change: 8.4 },
                { commodity: 'Vegetables', wpi: 210.5, change: 15.3 },
                { commodity: 'Fruits', wpi: 188.7, change: 3.9 },
                { commodity: 'Oilseeds', wpi: 171.3, change: -2.1 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="commodity" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => [value.toFixed(1), 'WPI Index']} />
                <Bar dataKey="wpi" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="text-xs text-gray-400 mt-2">
            Base year: 2011-12 = 100. Data from eSankhyiki API (NSO India).
          </p>
        </div>
      </main>

      {/* RBAC Denial Modal */}
      {rbacModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setRbacModal({ show: false, title: '', message: '' })}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-red-600 px-6 py-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Access Denied
              </h3>
            </div>
            <div className="p-6">
              <p className="text-gray-800 dark:text-slate-200 font-medium mb-2">{rbacModal.title}</p>
              <p className="text-gray-600 dark:text-slate-400 text-sm mb-4">{rbacModal.message}</p>
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-500 dark:text-slate-500">
                  <span className="font-medium">Your Role:</span> Trader
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-500">
                  <span className="font-medium">Required Role:</span> Farmer or Officer
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                  <span className="font-medium">Policy:</span> Archestra RBAC v1.0
                </p>
              </div>
              <button
                onClick={() => setRbacModal({ show: false, title: '', message: '' })}
                className="w-full bg-gray-100 dark:bg-slate-700 text-gray-700 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors font-medium text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
