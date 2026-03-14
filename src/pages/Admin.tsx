import { useState, useEffect } from 'react';
import { Users, Plus, DollarSign, Power } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface UserRow {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
  balance: string | number;
  is_active: boolean;
  created_at: string;
}

export default function Admin() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '', role: 'user', balance: 0 });
  const [message, setMessage] = useState('');
  const { token } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const fetchUsers = async () => {
    const r = await fetch(`${API_URL}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setUsers(await r.json());
  };

  useEffect(() => { fetchUsers(); }, []);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch(`${API_URL}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(newUser)
    });
    if (r.ok) {
      setShowCreateUser(false);
      setNewUser({ email: '', password: '', full_name: '', role: 'user', balance: 0 });
      fetchUsers();
      setMessage('User created');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const addBalance = async (userId: number) => {
    const amount = prompt('Enter amount to add:');
    if (!amount || isNaN(parseFloat(amount))) return;
    const r = await fetch(`${API_URL}/api/admin/users/${userId}/balance`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount: parseFloat(amount), description: 'Admin credit' })
    });
    if (r.ok) { fetchUsers(); setMessage('Balance updated'); setTimeout(() => setMessage(''), 3000); }
  };

  const toggleStatus = async (userId: number, current: boolean) => {
    const r = await fetch(`${API_URL}/api/admin/users/${userId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ is_active: !current })
    });
    if (r.ok) fetchUsers();
  };

  return (
    <div className="min-h-screen p-3 sm:p-4 lg:p-6 pl-14 sm:pl-16">
      <div className="max-w-full mx-auto space-y-4">

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-400" />
            <h2 className="text-lg sm:text-2xl font-bold text-white">User Management</h2>
          </div>
          <button onClick={() => setShowCreateUser(true)}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-3 sm:px-5 py-2 rounded-lg flex items-center gap-1.5 hover:from-indigo-600 hover:to-purple-700 text-sm sm:text-base">
            <Plus size={16} />
            <span className="hidden sm:inline">Create User</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>

        {message && (
          <div className="bg-green-500/20 border border-green-500/50 text-green-300 px-4 py-3 rounded-lg text-sm">{message}</div>
        )}

        {showCreateUser && (
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Create New User</h3>
            <form onSubmit={createUser} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                  <input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
                  <input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                  <input type="text" value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
                  <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Initial Balance</label>
                  <input type="number" step="0.01" value={newUser.balance}
                    onChange={(e) => setNewUser({ ...newUser, balance: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 text-sm">Create</button>
                <button type="button" onClick={() => setShowCreateUser(false)}
                  className="bg-slate-300 text-slate-700 px-5 py-2 rounded-lg hover:bg-slate-400 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Desktop table */}
        <div className="hidden sm:block bg-white rounded-xl shadow-lg overflow-x-auto">
          <table className="w-full min-w-[580px]">
            <thead className="bg-slate-100">
              <tr>
                {['Email','Name','Role','Balance','Status','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-800">{u.email}</td>
                  <td className="px-4 py-3 text-sm text-slate-800">{u.full_name || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-green-600">${parseFloat(u.balance.toString()).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.is_active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => addBalance(u.id)} className="bg-green-500 text-white p-1.5 rounded-lg hover:bg-green-600" title="Add Balance"><DollarSign size={15} /></button>
                      <button onClick={() => toggleStatus(u.id, u.is_active)} className={`${u.is_active ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white p-1.5 rounded-lg`} title={u.is_active ? 'Deactivate' : 'Activate'}><Power size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <div className="text-center py-8 text-slate-400">No users found</div>}
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden space-y-3">
          {users.length === 0 && <div className="text-center py-8 text-slate-400 bg-white rounded-xl">No users found</div>}
          {users.map((u) => (
            <div key={u.id} className="bg-white rounded-xl shadow p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">{u.email}</p>
                  <p className="text-xs text-slate-500">{u.full_name || 'No name'}</p>
                </div>
                <div className="flex gap-1.5 ml-2">
                  <button onClick={() => addBalance(u.id)} className="bg-green-500 text-white p-1.5 rounded-lg hover:bg-green-600"><DollarSign size={14} /></button>
                  <button onClick={() => toggleStatus(u.id, u.is_active)} className={`${u.is_active ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white p-1.5 rounded-lg`}><Power size={14} /></button>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{u.role}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.is_active ? 'Active' : 'Inactive'}</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">${parseFloat(u.balance.toString()).toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
