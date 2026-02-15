import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function TraderLogin() {
  const [traderId, setTraderId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Known trader accounts
  const traders: Record<string, { name: string; mandi: string; password: string; role: string }> = {
    'T001': { name: 'Ravi Traders', mandi: 'Dharwad APMC', password: 'trader123', role: 'trader' },
    'T002': { name: 'Kumar Trading Co.', mandi: 'Belgaum APMC', password: 'trader123', role: 'trader' },
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Simulate slight delay
      await new Promise(resolve => setTimeout(resolve, 500));

      const id = traderId.toUpperCase();
      const trader = traders[id];

      if (!trader) {
        // Also check by name
        const byName = Object.entries(traders).find(
          ([, t]) => t.name.toLowerCase() === traderId.toLowerCase()
        );
        if (byName) {
          const [tId, tData] = byName;
          if (password === tData.password) {
            localStorage.setItem('farmer', JSON.stringify({
              id: tId,
              name: tData.name,
              mandi: tData.mandi,
              role: 'trader',
              location: { district: tData.mandi.replace(' APMC', ''), state: 'Karnataka' },
            }));
            localStorage.setItem('farmerId', tId);
            navigate('/trader');
            return;
          }
        }
        setError('Invalid Trader ID or name. Try T001 or "Ravi Traders".');
        return;
      }

      if (password !== trader.password) {
        setError('Invalid password. Default: trader123');
        return;
      }

      localStorage.setItem('farmer', JSON.stringify({
        id,
        name: trader.name,
        mandi: trader.mandi,
        role: 'trader',
        location: { district: trader.mandi.replace(' APMC', ''), state: 'Karnataka' },
      }));
      localStorage.setItem('farmerId', id);
      navigate('/trader');
    } catch {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-block p-3 bg-white rounded-2xl shadow-sm mb-4">
            <span className="text-5xl">🏪</span>
          </div>
          <h1 className="text-3xl font-light text-amber-800 mb-1">
            AgriBot Trader
          </h1>
          <p className="text-sm text-slate-500">
            Market intelligence for agricultural traders
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-amber-100 overflow-hidden">
          <div className="p-8">
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">
                  Trader ID or Name
                </label>
                <input
                  type="text"
                  placeholder="T001 or Ravi Traders"
                  value={traderId}
                  onChange={(e) => setTraderId(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all text-sm"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-600 text-white py-3 rounded-xl hover:bg-amber-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow"
              >
                {loading ? 'Signing in...' : 'Sign In as Trader'}
              </button>
            </form>
          </div>

          {/* Demo hint */}
          <div className="px-8 py-4 bg-amber-50 border-t border-amber-100">
            <p className="text-xs text-amber-700">
              Demo: Use <span className="font-mono font-medium">T001</span> / <span className="font-mono font-medium">trader123</span>
            </p>
          </div>
        </div>

        {/* Back to farmer login */}
        <div className="text-center mt-4">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-slate-500 hover:text-amber-600 transition-colors"
          >
            Are you a farmer? <span className="font-medium">Sign in here</span>
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Powered by Archestra AI
        </p>
      </div>
    </div>
  );
}
