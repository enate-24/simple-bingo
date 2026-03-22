import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, DollarSign, Power, Package, RotateCcw, Sparkles, Trophy, Award, Star } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface User {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
  balance: string | number;
  is_active: boolean;
  created_at: string;
}

interface CartelaStock {
  total_cartelas: number;
  sold_cartelas: number;
  remaining: number;
}

const WINNER_LABELS = ['1st Place', '2nd Place', '3rd Place'];
const WINNER_COLORS = [
  'from-amber-400 via-yellow-400 to-orange-400',
  'from-slate-300 via-slate-200 to-slate-400',
  'from-orange-500 via-amber-600 to-yellow-700',
];

export default function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '', role: 'user', balance: 0 });
  const [cartelaStock, setCartelaStock] = useState<CartelaStock | null>(null);
  const [newTotal, setNewTotal] = useState('');
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [soldNumbers, setSoldNumbers] = useState<number[]>([]);

  const { token } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const fetchUsers = useCallback(async () => {
    const res = await fetch(`${API_URL}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setUsers(await res.json());
  }, [API_URL, token]);

  const fetchCartelaStock = useCallback(async () => {
    if (document.visibilityState === 'hidden') return;
    const res = await fetch(`${API_URL}/api/cartelas/stock`);
    if (res.ok) {
      const data = await res.json();
      setCartelaStock(data);
      setSoldNumbers(data.sold_numbers ?? []);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchUsers();
    fetchCartelaStock();
    const interval = setInterval(fetchCartelaStock, 5000);
    const onVisibility = () => { if (document.visibilityState === 'visible') fetchCartelaStock(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchUsers, fetchCartelaStock]);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(newUser)
    });
    if (res.ok) { setShowCreateUser(false); setNewUser({ email: '', password: '', full_name: '', role: 'user', balance: 0 }); fetchUsers(); }
  };

  const addBalance = async (userId: number) => {
    const amount = prompt('Enter amount to add:');
    if (!amount) return;
    const res = await fetch(`${API_URL}/api/admin/users/${userId}/balance`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount: parseFloat(amount), description: 'Admin credit' })
    });
    if (res.ok) fetchUsers();
  };

  const toggleStatus = async (userId: number, current: boolean) => {
    const res = await fetch(`${API_URL}/api/admin/users/${userId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ is_active: !current })
    });
    if (res.ok) fetchUsers();
  };

  const resetCartelaStock = async () => {
    const total = parseInt(newTotal) || 20;
    const res = await fetch(`${API_URL}/api/admin/cartelas/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ total_cartelas: total })
    });
    if (res.ok) { setNewTotal(''); setDrawnNumbers([]); fetchCartelaStock(); }
  };

  const playShuffleSound = (): Promise<void> =>
    new Promise(resolve => {
      const audio = new Audio('/shuffle.mp3');
      audio.play().catch(() => {});
      setTimeout(() => { audio.pause(); audio.currentTime = 0; resolve(); }, 4000);
    });

  const handleDraw = async () => {
    if (isDrawing || drawnNumbers.length >= 3 || soldNumbers.length === 0) return;
    const available = soldNumbers.filter(n => !drawnNumbers.includes(n));
    if (available.length === 0) return;
    const drawn = available[Math.floor(Math.random() * available.length)];
    setIsDrawing(true);
    await playShuffleSound();
    const newDrawn = [...drawnNumbers, drawn];
    setDrawnNumbers(newDrawn);
    try {
      await fetch(`${API_URL}/api/admin/rounds/winners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ winners: newDrawn.map((n, i) => ({ place: i + 1, cartela_number: n })) })
      });
    } catch (e) { console.error('Failed to save winner', e); }
    setIsDrawing(false);
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <Users className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" />
          <h2 className="text-xl sm:text-3xl font-bold text-slate-800">User Management</h2>
        </div>
        <button
          onClick={() => setShowCreateUser(true)}
          className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-lg flex items-center gap-2 hover:from-indigo-600 hover:to-purple-700 text-sm sm:text-base"
        >
          <Plus size={16} />
          Create User
        </button>
      </div>

      {/* Create User Form */}
      {showCreateUser && (
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-slate-200">
          <h3 className="text-lg sm:text-xl font-bold text-slate-800 mb-4">Create New User</h3>
          <form onSubmit={createUser} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {[
                { label: 'Email', type: 'email', key: 'email' },
                { label: 'Password', type: 'password', key: 'password' },
                { label: 'Full Name', type: 'text', key: 'full_name' },
              ].map(({ label, type, key }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                  <input
                    type={type}
                    value={(newUser as any)[key]}
                    onChange={(e) => setNewUser({ ...newUser, [key]: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    required={key !== 'full_name'}
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Initial Balance</label>
                <input type="number" step="0.01" value={newUser.balance}
                  onChange={(e) => setNewUser({ ...newUser, balance: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex gap-2 sm:gap-3">
              <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm">Create</button>
              <button type="button" onClick={() => setShowCreateUser(false)} className="bg-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-400 text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Draw Section */}
      {cartelaStock && cartelaStock.remaining === 0 && (
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl shadow-2xl p-4 sm:p-6 border border-indigo-800/50">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-2 rounded-xl shadow-lg shrink-0">
              <Award className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-xl font-bold text-white">Draw Winners</h3>
              <p className="text-indigo-300 text-xs sm:text-sm">All {cartelaStock.total_cartelas} cartelas sold!</p>
            </div>
            <div className="ml-auto bg-indigo-900/60 border border-indigo-700 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl shrink-0">
              <p className="text-indigo-300 text-xs text-center">Winners</p>
              <p className="text-white font-bold text-base sm:text-lg text-center">{drawnNumbers.length}/3</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
            {Array.from({ length: 3 }).map((_, idx) => {
              const winner = drawnNumbers[idx];
              const isDrawingThis = isDrawing && idx === drawnNumbers.length;
              return (
                <div key={idx} className={`flex flex-col items-center justify-center rounded-xl sm:rounded-2xl border-2 p-2 sm:p-4 transition-all duration-500 ${
                  winner ? `bg-gradient-to-br ${WINNER_COLORS[idx]} border-transparent shadow-2xl`
                    : isDrawingThis ? 'bg-indigo-900/60 border-indigo-500 animate-pulse'
                    : 'bg-indigo-950/40 border-indigo-800/50'
                }`}>
                  <p className={`text-xs font-bold mb-1 sm:mb-2 ${winner ? 'text-black/70' : 'text-indigo-400'}`}>
                    {WINNER_LABELS[idx]}
                  </p>
                  {winner ? (
                    <>
                      <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-white/20 flex items-center justify-center ring-2 sm:ring-4 ring-white/40 shadow-xl">
                        <span className="text-xl sm:text-2xl font-black text-black">{winner}</span>
                      </div>
                      <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-white/80 mt-1 sm:mt-2" />
                    </>
                  ) : isDrawingThis ? (
                    <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full border-4 border-indigo-400 border-t-transparent animate-spin" />
                  ) : (
                    <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full border-2 border-dashed border-indigo-700 flex items-center justify-center">
                      <Star className="w-4 h-4 sm:w-6 sm:h-6 text-indigo-700" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {drawnNumbers.length < 3 ? (
            <button onClick={handleDraw} disabled={isDrawing}
              className={`w-full py-3 sm:py-4 rounded-xl font-bold text-sm sm:text-lg flex items-center justify-center gap-2 sm:gap-3 transition-all ${
                !isDrawing ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-2xl'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}>
              {isDrawing
                ? <><div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />Drawing {WINNER_LABELS[drawnNumbers.length]}...</>
                : <><Sparkles size={18} className="animate-pulse" />Pick {WINNER_LABELS[drawnNumbers.length]}</>
              }
            </button>
          ) : (
            <div className="w-full py-3 sm:py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm sm:text-lg flex items-center justify-center gap-2 sm:gap-3 shadow-2xl">
              <Trophy size={18} />All Winners Selected!
            </div>
          )}
        </div>
      )}

      {/* Cartela Stock */}
      {cartelaStock && (
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-slate-200">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <Package className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
            <h3 className="text-base sm:text-xl font-bold text-slate-800">Cartela Stock</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-3 sm:mb-4">
            {[
              { label: 'Total', value: cartelaStock.total_cartelas, color: 'text-indigo-700', bg: 'bg-indigo-50' },
              { label: 'Sold', value: cartelaStock.sold_cartelas, color: 'text-red-600', bg: 'bg-red-50' },
              { label: 'Remaining', value: cartelaStock.remaining, color: 'text-green-600', bg: 'bg-green-50' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`${bg} rounded-lg p-2 sm:p-3 text-center`}>
                <p className="text-xs text-slate-500">{label}</p>
                <p className={`text-xl sm:text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="number" placeholder="New total (e.g. 20)" value={newTotal}
              onChange={(e) => setNewTotal(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            <button onClick={resetCartelaStock}
              className="bg-indigo-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-1 sm:gap-2 text-sm whitespace-nowrap">
              <RotateCcw size={13} />
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Users — card layout on mobile, table on desktop */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 border-b border-slate-200">
          <h3 className="font-semibold text-slate-700 text-sm sm:text-base">Users</h3>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden divide-y divide-slate-100">
          {users.map(user => (
            <div key={user.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{user.email}</p>
                  <p className="text-xs text-slate-500">{user.full_name || '—'}</p>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${
                  user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                }`}>{user.role}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-green-600">${parseFloat(user.balance as string).toFixed(2)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>{user.is_active ? 'Active' : 'Inactive'}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => addBalance(user.id)} className="bg-green-500 text-white p-1.5 rounded-lg hover:bg-green-600" title="Add Balance">
                    <DollarSign size={14} />
                  </button>
                  <button onClick={() => toggleStatus(user.id, user.is_active)}
                    className={`${user.is_active ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white p-1.5 rounded-lg`}>
                    <Power size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-100">
              <tr>
                {['Email', 'Name', 'Role', 'Balance', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-6 py-4 text-left text-sm font-semibold text-slate-700">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm text-slate-800">{user.email}</td>
                  <td className="px-6 py-4 text-sm text-slate-800">{user.full_name || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>{user.role}</span>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-green-600">${parseFloat(user.balance as string).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>{user.is_active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => addBalance(user.id)} className="bg-green-500 text-white p-2 rounded-lg hover:bg-green-600" title="Add Balance">
                        <DollarSign size={16} />
                      </button>
                      <button onClick={() => toggleStatus(user.id, user.is_active)}
                        className={`${user.is_active ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white p-2 rounded-lg`}>
                        <Power size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
