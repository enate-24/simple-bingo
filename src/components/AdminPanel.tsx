import { useState, useEffect } from 'react';
import { Users, Plus, DollarSign, Power } from 'lucide-react';
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

export default function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '', role: 'user', balance: 0 });
  const { token } = useAuth();

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const fetchUsers = async () => {
    const response = await fetch(`${API_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.ok) {
      const data = await response.json();
      setUsers(data);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await fetch(`${API_URL}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(newUser)
    });

    if (response.ok) {
      setShowCreateUser(false);
      setNewUser({ email: '', password: '', full_name: '', role: 'user', balance: 0 });
      fetchUsers();
    }
  };

  const addBalance = async (userId: number) => {
    const amount = prompt('Enter amount to add:');
    if (!amount) return;

    const response = await fetch(`${API_URL}/api/admin/users/${userId}/balance`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ amount: parseFloat(amount), description: 'Admin credit' })
    });

    if (response.ok) {
      fetchUsers();
    }
  };

  const toggleStatus = async (userId: number, currentStatus: boolean) => {
    const response = await fetch(`${API_URL}/api/admin/users/${userId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ is_active: !currentStatus })
    });

    if (response.ok) {
      fetchUsers();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-indigo-600" />
          <h2 className="text-3xl font-bold text-slate-800">User Management</h2>
        </div>
        <button
          onClick={() => setShowCreateUser(true)}
          className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:from-indigo-600 hover:to-purple-700"
        >
          <Plus size={20} />
          Create User
        </button>
      </div>

      {showCreateUser && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
          <h3 className="text-xl font-bold text-slate-800 mb-4">Create New User</h3>
          <form onSubmit={createUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                <input
                  type="text"
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Initial Balance</label>
                <input
                  type="number"
                  step="0.01"
                  value={newUser.balance}
                  onChange={(e) => setNewUser({ ...newUser, balance: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700">
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowCreateUser(false)}
                className="bg-slate-300 text-slate-700 px-6 py-2 rounded-lg hover:bg-slate-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Email</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Name</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Role</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Balance</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-sm text-slate-800">{user.email}</td>
                <td className="px-6 py-4 text-sm text-slate-800">{user.full_name || '-'}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-green-600">
                  ${parseFloat(user.balance).toFixed(2)}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => addBalance(user.id)}
                      className="bg-green-500 text-white p-2 rounded-lg hover:bg-green-600"
                      title="Add Balance"
                    >
                      <DollarSign size={16} />
                    </button>
                    <button
                      onClick={() => toggleStatus(user.id, user.is_active)}
                      className={`${
                        user.is_active ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                      } text-white p-2 rounded-lg`}
                      title={user.is_active ? 'Deactivate' : 'Activate'}
                    >
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
  );
}
