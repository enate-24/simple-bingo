import { Trophy, Wallet, LogOut, Menu, X, Shield } from 'lucide-react';
import { useState } from 'react';

interface User {
  id: number;
  email: string;
  full_name: string | null;
  role: 'user' | 'admin';
  balance: number;
  is_active: boolean;
}

interface SidebarProps {
  currentPage: 'game' | 'balance' | 'admin';
  onNavigate: (page: 'game' | 'balance' | 'admin') => void;
  user: User;
  onLogout: () => void;
}

export default function Sidebar({ currentPage, onNavigate, user, onLogout }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  const userMenuItems = [
    { id: 'game' as const, label: 'Lottery Game', icon: Trophy },
    { id: 'balance' as const, label: 'My Balance', icon: Wallet },
  ];

  const adminMenuItems = [
    { id: 'admin' as const, label: 'User Management', icon: Shield },
  ];

  const menuItems = user.role === 'admin' ? adminMenuItems : userMenuItems;

  const handleNavigate = (page: 'game' | 'balance' | 'admin') => {
    onNavigate(page);
    setIsOpen(false);
  };

  const handleLogout = () => {
    onLogout();
    setIsOpen(false);
  };

  return (
    <>
      {/* Hamburger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 bg-white/10 backdrop-blur-sm p-2.5 rounded-xl shadow-lg hover:bg-white/20 transition-all border border-white/10"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <div
        className={`fixed top-0 left-0 h-full bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white w-64 shadow-2xl z-40 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-slate-700 pt-16">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-xs text-slate-400">Logged in as</p>
              <p className="text-sm font-semibold truncate">{user.email}</p>
              {user.role === 'user' && (
                <div className="mt-2 pt-2 border-t border-slate-700">
                  <p className="text-xs text-slate-400">Balance</p>
                  <p className="text-xl font-bold text-green-400">${user.balance.toFixed(2)}</p>
                </div>
              )}
              {user.role === 'admin' && (
                <div className="mt-2">
                  <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">Admin</span>
                </div>
              )}
            </div>
          </div>

          {/* Nav items */}
          <nav className="flex-1 p-4 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg'
                      : 'hover:bg-slate-700/50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-slate-700">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
