import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Projects } from './pages/Projects';
import { Activity } from './pages/Activity';
import { TeamMembers } from './pages/TeamMembers';
import { Tokens } from './pages/Tokens';
import { Credentials } from './pages/Credentials';
import { Integrations } from './pages/Integrations';
import { Secrets } from './pages/Secrets';
import { ShareSecret } from './pages/ShareSecret';
import { ShareView } from './pages/ShareView';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return !isAuthenticated ? <>{children}</> : <Navigate to="/" />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/" element={<PrivateRoute><Projects /></PrivateRoute>} />
      <Route path="/activity" element={<PrivateRoute><Activity /></PrivateRoute>} />
      <Route path="/team" element={<PrivateRoute><TeamMembers /></PrivateRoute>} />
      <Route path="/tokens" element={<PrivateRoute><Tokens /></PrivateRoute>} />
      <Route path="/credentials" element={<PrivateRoute><Credentials /></PrivateRoute>} />
      <Route path="/integrations" element={<PrivateRoute><Integrations /></PrivateRoute>} />
      <Route path="/projects/:projectId" element={<PrivateRoute><Secrets /></PrivateRoute>} />
      <Route path="/share" element={<PrivateRoute><ShareSecret /></PrivateRoute>} />
      {/* 공유 링크 열람은 로그인 없이 접근 가능 */}
      <Route path="/share/:shareId" element={<ShareView />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
