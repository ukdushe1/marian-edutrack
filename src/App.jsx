import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

import AppShell         from './components/layout/AppShell';
import Login            from './pages/auth/Login';
import Dashboard        from './pages/Dashboard';
import MarkbookPage     from './pages/markbook/MarkbookPage';
import RegisterPage     from './pages/register/RegisterPage';
import ReportsPage      from './pages/reports/ReportsPage';
import AIToolsPage      from './pages/ai/AIToolsPage';
import DataToolsPage    from './pages/admin/DataToolsPage';
import AnalysisPage     from './pages/analysis/AnalysisPage';
import ConductPage      from './pages/conduct/ConductPage';
import NoticeBoardPage  from './pages/notices/NoticeBoardPage';
import SyllabiPage      from './pages/admin/SyllabiPage';
import GroupsPage       from './pages/admin/GroupsPage';

function RequireAuth({ children }) {
  const { firebaseUser, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!firebaseUser) return <Navigate to="/login" replace />;
  return children;
}

function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              className: 'dark:bg-slate-800 dark:text-slate-100',
              duration: 3500,
            }}
          />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            >
              <Route index          element={<Dashboard />} />
              <Route path="markbook" element={<MarkbookPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="reports"  element={<ReportsPage />} />
              <Route path="ai"       element={<AIToolsPage />} />
              <Route path="admin/imports" element={<DataToolsPage />} />
              {/* Phase 2–4 routes registered but not yet implemented */}
              <Route path="analysis"       element={<AnalysisPage />} />
              <Route path="conduct"        element={<ConductPage />} />
              <Route path="notices"        element={<NoticeBoardPage />} />
              <Route path="admin/syllabi"  element={<SyllabiPage />} />
              <Route path="admin/groups"   element={<GroupsPage />} />
              <Route path="hod/marks"      element={<Placeholder title="Department marks" phase={2} />} />
              <Route path="hod/schemes"    element={<Placeholder title="Schemes of work" phase={3} />} />
              <Route path="head/approve"   element={<Placeholder title="Approvals" phase={2} />} />
              <Route path="head/analytics" element={<Placeholder title="Analytics" phase={2} />} />
              <Route path="exams/*"        element={<Placeholder title="Exams" phase={3} />} />
              <Route path="*"              element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

function Placeholder({ title, phase }) {
  return (
    <div className="text-center py-16 text-slate-400">
      <p className="text-lg font-semibold">{title}</p>
      <p className="text-sm mt-1">Coming in Phase {phase}</p>
    </div>
  );
}
