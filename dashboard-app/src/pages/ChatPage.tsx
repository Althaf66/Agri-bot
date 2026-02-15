import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildArchestraUrl, getUserRole } from '../utils/archestraUrl';

export function ChatPage() {
  const navigate = useNavigate();
  const [farmerId, setFarmerId] = useState<string | null>(null);
  const [farmerName, setFarmerName] = useState('');
  const [userRole, setUserRole] = useState<'farmer' | 'trader' | undefined>();

  useEffect(() => {
    const storedFarmer = localStorage.getItem('farmer');
    const id = localStorage.getItem('farmerId');

    if (!storedFarmer || !id) {
      navigate('/');
      return;
    }

    try {
      const farmer = JSON.parse(storedFarmer);
      setFarmerId(id);
      setFarmerName(farmer.name || '');
      setUserRole(farmer.role); // NEW: Store role
    } catch {
      navigate('/');
    }
  }, [navigate]);

  if (!farmerId) return null;

  const archestraUrl = buildArchestraUrl(farmerId, userRole);

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 shadow-lg sticky top-0 z-40 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(userRole === 'trader' ? '/trader' : '/dashboard')}
              className="text-slate-400 hover:text-emerald-400 transition-colors"
              title="Back to Dashboard"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-emerald-400">💬 Chat with Archestra</h1>
              <p className="text-sm text-slate-400">Hi {farmerName} — Powered by Archestra AI</p>
            </div>
          </div>
          <button
            onClick={() => navigate(userRole === 'trader' ? '/trader' : '/dashboard')}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>
      </header>

      {/* Full-page iframe */}
      <iframe
        key={`archestra-chat-${farmerId}-${userRole || 'default'}`}
        src={archestraUrl}
        title="Archestra Chat"
        className="flex-1 w-full border-none"
        allow="microphone"
      />
    </div>
  );
}
