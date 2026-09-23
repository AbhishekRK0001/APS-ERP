import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TeacherLeaveDashboard from './pages/TeacherLeaveDashboard';
import HODDashboard from './pages/HODDashboard';
import PrincipalDashboard from './pages/PrincipalDashboard';
import Login from './pages/Login';
import { Toaster } from 'react-hot-toast';

function PrivateRoute({ children, roles }) {
  const token = localStorage.getItem('token');
  let user = {};
  try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch { /* invalid session */ }
  if (!token) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><TeacherLeaveDashboard /></PrivateRoute>} />
        <Route path="/leave" element={<Navigate to="/" replace />} />
        <Route path="/apply-leave" element={<PrivateRoute roles={['teacher']}><TeacherLeaveDashboard /></PrivateRoute>} />
        <Route path="/substitute-requests" element={<PrivateRoute roles={['teacher']}><TeacherLeaveDashboard /></PrivateRoute>} />
        <Route path="/hod" element={<PrivateRoute roles={['hod', 'principal']}><HODDashboard /></PrivateRoute>} />
        <Route path="/principal" element={<PrivateRoute roles={['principal']}><PrincipalDashboard /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
