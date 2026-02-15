import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mcpClient } from '../api/mcpClient';

type UserRole = 'farmer' | 'trader';

export function Login() {
  const [role, setRole] = useState<UserRole>('farmer');
  const [isRegister, setIsRegister] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Registration form state
  const [regData, setRegData] = useState({
    name: '',
    city: '',
    crop_name: '',
    crop_variety: '',
    crop_phase: 'pre_sowing',
    land_acres: 0,
    income_category: 'small_farmer',
    bank_account: false,
    aadhaar_linked: false,
    phone: '',
    password: ''
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (role === 'trader') {
        // Trader login logic
        const traders: Record<string, { name: string; mandi: string; password: string }> = {
          'T001': { name: 'Ravi Traders', mandi: 'Dharwad APMC', password: 'trader123' },
          'T002': { name: 'Kumar Trading Co.', mandi: 'Belgaum APMC', password: 'trader123' },
        };

        await new Promise(resolve => setTimeout(resolve, 500));
        const id = identifier.toUpperCase();
        const trader = traders[id] || Object.entries(traders).find(
          ([, t]) => t.name.toLowerCase() === identifier.toLowerCase()
        )?.[1];

        if (!trader) {
          setError('Invalid Trader ID or name. Try T001 or "Ravi Traders".');
          return;
        }

        if (password !== trader.password) {
          setError('Invalid password. Default: trader123');
          return;
        }

        localStorage.setItem('farmer', JSON.stringify({
          id: id.startsWith('T') ? id : 'T001',
          name: trader.name,
          mandi: trader.mandi,
          role: 'trader',
          location: { district: trader.mandi.replace(' APMC', ''), state: 'Karnataka' },
        }));
        localStorage.setItem('farmerId', id.startsWith('T') ? id : 'T001');
        navigate('/trader');
      } else {
        // Farmer login logic
        const result = await mcpClient.loginFarmer(identifier, password);

        if (result.success && result.farmer) {
          localStorage.setItem('farmer', JSON.stringify(result.farmer));
          localStorage.setItem('farmerId', result.farmer.id);
          navigate('/dashboard');
        } else {
          setError(result.error || 'Login failed');
        }
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await mcpClient.registerFarmer(regData);

      if (result.success) {
        alert(result.message);
        setIsRegister(false);
        setIdentifier(result.farmer_id);
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (err) {
      setError('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-block p-3 bg-slate-800 rounded-2xl shadow-lg mb-4 border border-slate-700">
            <span className="text-5xl">{role === 'farmer' ? '🌾' : '🏪'}</span>
          </div>
          <h1 className="text-3xl font-light text-white mb-1">
            AgriBot {role === 'trader' ? 'Trader' : ''}
          </h1>
          <p className="text-sm text-slate-400">
            {isRegister ? 'Create your account' : 'Sign in to your account'}
          </p>
        </div>

        {/* Role Selector - Always visible */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-1">
            <button
              type="button"
              onClick={() => {
                setRole('farmer');
                setIsRegister(false);
                setError('');
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                role === 'farmer'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-700'
              }`}
            >
              🌾 Farmer
            </button>
            <button
              type="button"
              onClick={() => {
                setRole('trader');
                setIsRegister(false);
                setError('');
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                role === 'trader'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-amber-400 hover:bg-slate-700'
              }`}
            >
              🏪 Trader
            </button>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-slate-800 rounded-3xl shadow-lg border border-slate-700 overflow-hidden">
          <div className="p-8">
            {isRegister ? (
              <form onSubmit={handleRegister} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={regData.name}
                    onChange={(e) => setRegData({...regData, name: e.target.value})}
                    required
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm text-white placeholder-slate-400"
                  />
                </div>

                {/* City & Crop */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-2">
                      City
                    </label>
                    <select
                      value={regData.city}
                      onChange={(e) => setRegData({...regData, city: e.target.value})}
                      required
                      className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm text-white"
                    >
                      <option value="">Select</option>
                      <option value="Dharwad">Dharwad</option>
                      <option value="Belgaum">Belgaum</option>
                      <option value="Hubli">Hubli</option>
                      <option value="Gadag">Gadag</option>
                      <option value="Bagalkot">Bagalkot</option>
                      <option value="Bellary">Bellary</option>
                      <option value="Bijapur">Bijapur</option>
                      <option value="Raichur">Raichur</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-2">
                      Crop
                    </label>
                    <input
                      type="text"
                      placeholder="Rice, Wheat..."
                      value={regData.crop_name}
                      onChange={(e) => setRegData({...regData, crop_name: e.target.value})}
                      required
                      className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm text-white placeholder-slate-400"
                    />
                  </div>
                </div>

                {/* Phase & Land */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-2">
                      Phase
                    </label>
                    <select
                      value={regData.crop_phase}
                      onChange={(e) => setRegData({...regData, crop_phase: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm text-white placeholder-slate-400"
                    >
                      <option value="pre_sowing">Pre-Sowing</option>
                      <option value="sowing">Sowing</option>
                      <option value="growing">Growing</option>
                      <option value="pest_watch">Pest Watch</option>
                      <option value="harvest">Harvest</option>
                      <option value="post_harvest">Post-Harvest</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-2">
                      Land (acres)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      placeholder="2.5"
                      value={regData.land_acres || ''}
                      onChange={(e) => setRegData({...regData, land_acres: parseFloat(e.target.value) || 0})}
                      required
                      className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm text-white placeholder-slate-400"
                    />
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">
                    Category
                  </label>
                  <select
                    value={regData.income_category}
                    onChange={(e) => setRegData({...regData, income_category: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm text-white placeholder-slate-400"
                  >
                    <option value="marginal_farmer">Marginal (&lt;1 ha)</option>
                    <option value="small_farmer">Small (1-2 ha)</option>
                    <option value="medium_farmer">Medium (2-10 ha)</option>
                    <option value="large_farmer">Large (&gt;10 ha)</option>
                  </select>
                </div>

                {/* Checkboxes */}
                <div className="flex items-center gap-6 py-2">
                  <label className="flex items-center cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={regData.bank_account}
                      onChange={(e) => setRegData({...regData, bank_account: e.target.checked})}
                      className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 focus:ring-2"
                    />
                    <span className="ml-2 text-sm text-slate-400 group-hover:text-slate-900 transition-colors">Bank Account</span>
                  </label>

                  <label className="flex items-center cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={regData.aadhaar_linked}
                      onChange={(e) => setRegData({...regData, aadhaar_linked: e.target.checked})}
                      className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 focus:ring-2"
                    />
                    <span className="ml-2 text-sm text-slate-400 group-hover:text-slate-900 transition-colors">Aadhaar</span>
                  </label>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder="Min 6 characters"
                    value={regData.password}
                    onChange={(e) => setRegData({...regData, password: e.target.value})}
                    required
                    minLength={6}
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm text-white placeholder-slate-400"
                  />
                </div>

                {error && (
                  <div className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 text-white py-3 rounded-xl hover:bg-emerald-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow"
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-5">
                {/* Demo credentials banner for trader */}
                {role === 'trader' && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                    <p className="text-xs text-amber-400 font-medium mb-1.5">🔑 Demo Credentials</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Trader ID:</span>
                      <code className="bg-slate-700 px-2 py-1 rounded text-amber-300 font-mono">T001</code>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1.5">
                      <span className="text-slate-400">Password:</span>
                      <code className="bg-slate-700 px-2 py-1 rounded text-amber-300 font-mono">trader123</code>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">
                    {role === 'farmer' ? 'Farmer ID or Name' : 'Trader ID or Company'}
                  </label>
                  <input
                    type="text"
                    placeholder={role === 'farmer' ? 'F001 or Ramesh Patil' : 'T001 or Ravi Traders'}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm text-white placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm text-white placeholder-slate-400"
                  />
                </div>

                {error && (
                  <div className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 rounded-xl transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow ${
                    role === 'farmer'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                  }`}
                >
                  {loading ? 'Signing in...' : `Sign In as ${role === 'farmer' ? 'Farmer' : 'Trader'}`}
                </button>
              </form>
            )}
          </div>

          {/* Toggle - Only show for farmers */}
          {role === 'farmer' && (
            <div className="px-8 py-4 bg-slate-900 border-t border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError('');
                }}
                className="text-sm text-slate-400 hover:text-emerald-400 transition-colors"
              >
                {isRegister ? (
                  <>Already have an account? <span className="font-medium">Sign in</span></>
                ) : (
                  <>New farmer? <span className="font-medium">Create account</span></>
                )}
              </button>
            </div>
          )}
          {role === 'trader' && (
            <div className="px-8 py-4 bg-slate-900 border-t border-slate-700">
              <p className="text-xs text-amber-400/70 text-center">
                Trader accounts are pre-configured. Contact admin to create new accounts.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Powered by Archestra AI
        </p>
      </div>
    </div>
  );
}
