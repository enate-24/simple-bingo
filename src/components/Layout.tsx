import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from './Sidebar';

export default function Layout() {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const currentPage = location.pathname === '/balance'
    ? 'balance'
    : location.pathname === '/admin'
    ? 'admin'
    : location.pathname === '/settings'
    ? 'settings'
    : 'game';

  const handleNavigate = (page: 'game' | 'balance' | 'admin' | 'settings') => {
    if (page === 'game') navigate('/lottery');
    else navigate(`/${page}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 flex">
      {user && (
        <Sidebar
          currentPage={currentPage as 'game' | 'balance' | 'admin' | 'settings'}
          onNavigate={handleNavigate}
          user={user}
          onLogout={logout}
        />
      )}
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}
