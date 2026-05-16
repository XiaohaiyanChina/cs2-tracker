import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Teams from './pages/Teams';
import TeamDetail from './pages/TeamDetail';
import Players from './pages/Players';
import PlayerDetail from './pages/PlayerDetail';
import Admin from './pages/Admin';
import MatchDetail from './pages/MatchDetail';
import LoginPage from './pages/LoginPage';
import { isAuthenticated } from './utils/auth';

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(window.location.pathname)}`} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/teams/:id" element={<TeamDetail />} />
          <Route path="/players" element={<Players />} />
          <Route path="/players/:id" element={<PlayerDetail />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/matches/:id" element={<MatchDetail />} />
          <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
