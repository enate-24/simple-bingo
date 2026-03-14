import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Layout from './components/Layout';
import Game from './pages/Game';
import Balance from './pages/Balance';
import Admin from './pages/Admin';

function ProtectedRoute({ requireAdmin = false }: { requireAdmin?: boolean }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (requireAdmin && user.role !== 'admin') return <Navigate to="/lottery" replace />;

  return <Outlet />;
}

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: '/', element: <Navigate to="/lottery" replace /> },
          { path: '/lottery', element: <Game /> },
          { path: '/balance', element: <Balance /> },
          {
            element: <ProtectedRoute requireAdmin />,
            children: [{ path: '/admin', element: <Admin /> }],
          },
        ],
      },
    ],
  },
]);

function RouterWithAuth() {
  return <RouterProvider router={router} />;
}

export default function AppRouter() {
  return (
    <AuthProvider>
      <RouterWithAuth />
    </AuthProvider>
  );
}
