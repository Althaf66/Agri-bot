import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { mcpClient } from '../api/mcpClient';
import { PhaseTimeline } from '../components/PhaseTimeline';
import { WeatherWidget } from '../components/WeatherWidget';
import { SchemeStatus } from '../components/SchemeStatus';
import { ThemeToggle } from '../components/ThemeToggle';

interface Farmer {
  id: string;
  name: string;
  location: {
    district: string;
    state: string;
    lat: number;
    lon: number;
  };
  land_acres: number;
  crops: Array<{
    name: string;
    variety: string;
    phase: string;
    sown_date: string;
    current_market_price?: number;
  }>;
  income_category?: string;
  bank_account: boolean;
  aadhaar_linked: boolean;
  current_phase_context?: {
    display_name: string;
    context_prompt: string;
  };
}

export function Dashboard() {
  const navigate = useNavigate();
  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFarmerData = async () => {
      const storedFarmer = localStorage.getItem('farmer');
      const farmerId = localStorage.getItem('farmerId');

      if (!storedFarmer || !farmerId) {
        navigate('/');
        return;
      }

      try {
        const farmerData = JSON.parse(storedFarmer) as Farmer;
        setFarmer(farmerData);
      } catch (error) {
        console.error('Error loading farmer data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFarmerData();
  }, [navigate]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!farmer) {
    return null;
  }

  const currentCrop = farmer.crops && farmer.crops.length > 0 ? farmer.crops[0] : null;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 pb-20">
      {/* Header */}
      <header className="bg-slate-100 dark:bg-slate-800 shadow-lg sticky top-0 z-40 border-b border-slate-300 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              🌾 AgriBot Dashboard
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Welcome back, {farmer.name}!
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              to="/chat"
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 dark:hover:bg-emerald-700 transition-colors"
            >
              💬 Chat with Archestra
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600/80 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top Row: Farmer Profile, Current Crop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Farmer Profile Card */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
              👤 Farmer Profile
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Farmer ID</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">{farmer.id}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Location</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {farmer.location.district}, {farmer.location.state}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Land Size</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">{farmer.land_acres} acres</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Category</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {farmer.income_category
                    ? farmer.income_category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
                    : 'Not specified'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Bank Account</p>
                <p className={`font-medium ${farmer.bank_account ? 'text-green-600' : 'text-red-600'}`}>
                  {farmer.bank_account ? '✓ Linked' : '✗ Not Linked'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Aadhaar</p>
                <p className={`font-medium ${farmer.aadhaar_linked ? 'text-green-600' : 'text-red-600'}`}>
                  {farmer.aadhaar_linked ? '✓ Linked' : '✗ Not Linked'}
                </p>
              </div>
            </div>
          </div>

          {/* Current Crop Card */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
              🌾 Current Crop
            </h2>
            {currentCrop ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Crop Name</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{currentCrop.name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Variety</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{currentCrop.variety}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Current Phase</p>
                  <p className="font-medium text-green-600">
                    {currentCrop.phase.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Sown Date</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {new Date(currentCrop.sown_date).toLocaleDateString()}
                  </p>
                </div>
                {farmer.current_phase_context && (
                  <div className="mt-4 p-3 bg-green-50 rounded-lg">
                    <p className="text-sm font-medium text-green-800 mb-1">
                      Phase: {farmer.current_phase_context.display_name}
                    </p>
                    <p className="text-xs text-green-700">
                      {farmer.current_phase_context.context_prompt}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-400">No crop information available</p>
            )}
          </div>
        </div>

        {/* Phase Timeline */}
        {currentCrop && (
          <PhaseTimeline
            currentPhase={currentCrop.phase}
            sownDate={currentCrop.sown_date}
            cropName={currentCrop.name}
          />
        )}

        {/* Weather Widget */}
        <WeatherWidget
          location={farmer.location}
          cropPhase={currentCrop?.phase || 'growing'}
        />

        {/* Government Schemes */}
        <SchemeStatus
          farmer={{
            id: farmer.id,
            land_acres: farmer.land_acres,
            income_category: farmer.income_category,
            bank_account: farmer.bank_account,
            aadhaar_linked: farmer.aadhaar_linked,
          }}
          cropPhase={currentCrop?.phase || 'growing'}
        />
      </main>

    </div>
  );
}
