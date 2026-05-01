import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import PlayerPage from './pages/PlayerPage';

function AppRoutes() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen pitch-bg flex items-center justify-center">
        <div className="text-center">
          <div className="bebas text-4xl mb-2" style={{color: 'var(--green)'}}>טוען...</div>
          <div className="text-sm" style={{color: 'var(--text-muted)'}}>מונדיאל הימורים</div>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;
  if (profile?.role === 'admin') return <AdminPage />;
  return <PlayerPage />;
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="*" element={<AppRoutes />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}
