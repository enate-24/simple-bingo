import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, DollarSign, Power, History, Pencil, Trash2, X, Trophy, ChevronRight } from 'lucide-react';
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

interface Round {
  id: number;
  game_number: number;
  total_cartelas: number;
  total_purchases: number;
  winner_1: number | null;
  winner_2: number | null;
  winner_3: number | null;
  prize_1: string | null;
  prize_2: string | null;
  prize_3: string | null;
  status: string;
  started_at: string;
}

export default function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '', role: 'user', balance: 0 });
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ email: '', full_name: '', role: 'user', password: '' });
  const [editSaving, setEditSaving] = useState(false);

  // Per-user history modal
  const [historyUser, setHistoryUser] = useState<User | null>(null);
  const [userRounds, setUserRounds] = useState<Round[]>([]);
  const [roundsLoading, setRoundsLoading] = useState(false);

  const { token } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const fetchUsers = useCallback(async () => {
    const res = await fetch(`${API_URL}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setUsers(await res.json());
  }, [API_URL, token]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(newUser)
    });
    if (res.ok) {
      setShowCreateUser(false);
      setNewUser({ email: '', password: '', full_name: '', role: 'user', balance: 0 });
      fetchUsers();
    }
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

  const deleteUser = async (userId: number, email: string) => {
    if (!confirm(`Delete user "${email}"? This cannot be undone.`)) return;
    const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) fetchUsers();
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    setEditForm({ email: user.email, full_name: user.full_name || '', role: user.role, password: '' });
  };

  const saveEdit = async () => {
    if (!editUser) return;
    setEditSaving(true);
    const body: any = { email: editForm.email, full_name: editForm.full_name, role: editForm.role };
    if (editForm.password) body.password = editForm.password;
    const res = await fetch(`${API_URL}/api/admin/users/${editUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    if (res.ok) { setEditUser(null); fetchUsers(); }
    setEditSaving(false);
  };

  const openHistory = async (user: User) => {
    setHistoryUser(user);
    setUserRounds([]);
    setRoundsLoading(true);
    const res = await fetch(`${API_URL}/api/admin/users/${user.id}/rounds`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) setUserRounds(await res.json());
    setRoundsLoading(false);
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
          <Plus size={16} /> Create User
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
                  <option value="operator">Operator</option>
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

      {/* Users — mobile cards */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 border-b border-slate-200">
          <h3 className="font-semibold text-slate-700 text-sm sm:text-base">Users ({users.length})</h3>
        </div>

        <div className="sm:hidden divide-y divide-slate-100">
          {users.map(user => (
            <div key={user.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{user.email}</p>
                  <p className="text-xs text-slate-500">{user.full_name || '—'}</p>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${
                  user.role === 'admin' ? 'bg-purple-100 text-purple-700'
                  : user.role === 'operator' ? 'bg-orange-100 text-orange-700'
                  : 'bg-blue-100 text-blue-700'
                }`}>{user.role}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-green-600">{parseFloat(user.balance as string).toFixed(2)} Br</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>{user.is_active ? 'Active' : 'Inactive'}</span>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => openHistory(user)} className="bg-indigo-100 text-indigo-700 p-1.5 rounded-lg hover:bg-indigo-200" title="Game History">
                    <History size={14} />
                  </button>
                  <button onClick={() => openEdit(user)} className="bg-slate-100 text-slate-700 p-1.5 rounded-lg hover:bg-slate-200" title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => addBalance(user.id)} className="bg-green-100 text-green-700 p-1.5 rounded-lg hover:bg-green-200" title="Add Balance">
                    <DollarSign size={14} />
                  </button>
                  <button onClick={() => toggleStatus(user.id, user.is_active)}
                    className={`${user.is_active ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-green-100 text-green-700 hover:bg-green-200'} p-1.5 rounded-lg`}
                    title={user.is_active ? 'Deactivate' : 'Activate'}>
                    <Power size={14} />
                  </button>
                  <button onClick={() => deleteUser(user.id, user.email)} className="bg-red-100 text-red-700 p-1.5 rounded-lg hover:bg-red-200" title="Delete">
                    <Trash2 size={14} />
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
                  <td className="px-6 py-4 text-sm text-slate-800">{user.full_name || '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700'
                      : user.role === 'operator' ? 'bg-orange-100 text-orange-700'
                      : 'bg-blue-100 text-blue-700'
                    }`}>{user.role}</span>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-green-600">{parseFloat(user.balance as string).toFixed(2)} Br</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>{user.is_active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => openHistory(user)} className="bg-indigo-100 text-indigo-700 p-2 rounded-lg hover:bg-indigo-200 flex items-center gap-1 text-xs font-semibold" title="Game History">
                        <History size={14} /> History
                      </button>
                      <button onClick={() => openEdit(user)} className="bg-slate-100 text-slate-700 p-2 rounded-lg hover:bg-slate-200" title="Edit">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => addBalance(user.id)} className="bg-green-100 text-green-700 p-2 rounded-lg hover:bg-green-200" title="Add Balance">
                        <DollarSign size={15} />
                      </button>
                      <button onClick={() => toggleStatus(user.id, user.is_active)}
                        className={`${user.is_active ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-green-100 text-green-700 hover:bg-green-200'} p-2 rounded-lg`}
                        title={user.is_active ? 'Deactivate' : 'Activate'}>
                        <Power size={15} />
                      </button>
                      <button onClick={() => deleteUser(user.id, user.email)} className="bg-red-100 text-red-700 p-2 rounded-lg hover:bg-red-200" title="Delete">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Edit User</h3>
              <button onClick={() => setEditUser(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Email', key: 'email', type: 'email' },
                { label: 'Full Name', key: 'full_name', type: 'text' },
                { label: 'New Password', key: 'password', type: 'password' },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                  <input
                    type={type}
                    placeholder={key === 'password' ? 'Leave blank to keep current' : ''}
                    value={(editForm as any)[key]}
                    onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Role</label>
                <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500">
                  <option value="user">User</option>
                  <option value="operator">Operator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditUser(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={saveEdit} disabled={editSaving}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                {editSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Pencil size={14} />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Game History Modal */}
      {historyUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-800">Game History</h3>
                  <p className="text-xs text-slate-500">{historyUser.full_name || historyUser.email}</p>
                </div>
              </div>
              <button onClick={() => setHistoryUser(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {roundsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : userRounds.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Trophy className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">No games played yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {userRounds.map(r => (
                    <div key={r.id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-indigo-600">#{r.game_number}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            r.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>{r.status}</span>
                        </div>
                        <span className="text-xs text-slate-400">
                          {new Date(r.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-slate-500">
                          Cartelas: <span className="font-semibold text-slate-700">{r.total_purchases ?? 0}/{r.total_cartelas}</span>
                        </span>
                        <ChevronRight size={12} className="text-slate-300" />
                        {r.winner_1 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 font-bold">
                            🥇 #{r.winner_1}{r.prize_1 ? ` · ${r.prize_1}Br` : ''}
                          </span>
                        ) : <span className="text-slate-300">🥇 —</span>}
                        {r.winner_2 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold">
                            🥈 #{r.winner_2}{r.prize_2 ? ` · ${r.prize_2}Br` : ''}
                          </span>
                        ) : <span className="text-slate-300">🥈 —</span>}
                        {r.winner_3 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-100 text-orange-800 font-bold">
                            🥉 #{r.winner_3}{r.prize_3 ? ` · ${r.prize_3}Br` : ''}
                          </span>
                        ) : <span className="text-slate-300">🥉 —</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400 text-right">
              {userRounds.length} game{userRounds.length !== 1 ? 's' : ''} total
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
