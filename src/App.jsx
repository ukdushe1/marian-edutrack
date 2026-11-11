import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

import AppShell         from './components/layout/AppShell';
import Login            from './pages/auth/Login';
import Dashboard        from './pages/Dashboard';

// Pages load on first visit, so the app starts faster on mobile data
const MarkbookPage = lazy(() => import('./pages/markbook/MarkbookPage'));
const RegisterPage = lazy(() => import('./pages/register/RegisterPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const AIToolsPage = lazy(() => import('./pages/ai/AIToolsPage'));
const DataToolsPage = lazy(() => import('./pages/admin/DataToolsPage'));
const AnalysisPage = lazy(() => import('./pages/analysis/AnalysisPage'));
const ConductPage = lazy(() => import('./pages/conduct/ConductPage'));
const NoticeBoardPage = lazy(() => import('./pages/notices/NoticeBoardPage'));
const SyllabiPage = lazy(() => import('./pages/admin/SyllabiPage'));
const GroupsPage = lazy(() => import('./pages/admin/GroupsPage'));
const ExamTimetablePage = lazy(() => import('./pages/exams/ExamTimetablePage'));
const CambridgeEntriesPage = lazy(() => import('./pages/exams/CambridgeEntriesPage'));
const CoverReliefPage = lazy(() => import('./pages/cover/CoverReliefPage'));
const SchemesPage = lazy(() => import('./pages/schemes/SchemesPage'));
const BookingsPage = lazy(() => import('./pages/bookings/BookingsPage'));
const PredictionsPage = lazy(() => import('./pages/predictions/PredictionsPage'));
const HodMarksPage = lazy(() => import('./pages/hod/HodMarksPage'));
const HeadApprovalsPage = lazy(() => import('./pages/head/HeadApprovalsPage'));
const BoardingPage = lazy(() => import('./pages/boarding/BoardingPage'));
const GuardiansPage = lazy(() => import('./pages/admin/GuardiansPage'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const CommentBankPage = lazy(() => import('./pages/admin/CommentBankPage'));
const AuditLogPage = lazy(() => import('./pages/admin/AuditLogPage'));
const BackupPage = lazy(() => import('./pages/admin/BackupPage'));
const AnalyticsPage = lazy(() => import('./pages/head/AnalyticsPage'));
const GradeBoundariesPage = lazy(() => import('./pages/exams/GradeBoundariesPage'));
const TermExamsHome = lazy(() => import('./pages/termExams/TermExamsHome'));
const ExamWindowPage = lazy(() => import('./pages/termExams/WindowPage'));
const ExamMarkingGrid = lazy(() => import('./pages/termExams/MarkingGrid'));
const MyExamTasks = lazy(() => import('./pages/termExams/MyExamTasks'));

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
              <Route path="admin/guardians" element={<GuardiansPage />} />
              <Route path="admin/users"     element={<UsersPage />} />
              <Route path="admin/comments"  element={<CommentBankPage />} />
              <Route path="admin/audit"     element={<AuditLogPage />} />
              <Route path="admin/backup"    element={<BackupPage />} />
              <Route path="exams/term"      element={<TermExamsHome />} />
              <Route path="exams/term/:windowId" element={<ExamWindowPage />} />
              <Route path="exams/term/:windowId/mark/:paperId/:groupId" element={<ExamMarkingGrid />} />
              <Route path="exam-tasks"      element={<MyExamTasks />} />
              <Route path="hod/marks"           element={<HodMarksPage />} />
              <Route path="hod/schemes"         element={<SchemesPage />} />
              <Route path="head/approve"        element={<HeadApprovalsPage />} />
              <Route path="head/analytics"      element={<AnalyticsPage />} />
              <Route path="exams/timetable"     element={<ExamTimetablePage />} />
              <Route path="exams/entries"       element={<CambridgeEntriesPage />} />
              <Route path="exams/seating"       element={<Navigate to="/exams/term" replace />} />
              <Route path="exams/boundaries"    element={<GradeBoundariesPage />} />
              <Route path="cover"               element={<CoverReliefPage />} />
              <Route path="bookings"            element={<BookingsPage />} />
              <Route path="predictions"         element={<PredictionsPage />} />
              <Route path="boarding"            element={<BoardingPage />} />
              <Route path="*"              element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
