import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';
import AdminLayout from './layouts/AdminLayout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import NewSegmentationPage from './pages/NewSegmentationPage';
import ResultsPage from './pages/ResultsPage';
import SettingsPage from './pages/SettingsPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import BillingPage from './pages/BillingPage';

// Admin pages
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import UserManagementPage from './pages/admin/UserManagementPage';
import SystemConfigurationPage from './pages/admin/SystemConfigurationPage';
import ModelManagementPage from './pages/admin/ModelManagementPage';
import ActivityMonitoringPage from './pages/admin/ActivityMonitoringPage';
import DiagnosticPage from './pages/admin/DiagnosticPage';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <AdminAuthProvider>
            <Router>
              <div className="min-h-screen bg-background-light dark:bg-background-dark">
                <Routes>
                  {/* Public Routes */}
                  <Route element={<PublicLayout />}>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignUpPage />} />
                    <Route path="/verify-email" element={<VerifyEmailPage />} />
                  </Route>

                  {/* Protected User Routes */}
                  <Route element={<DashboardLayout />}>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/projects" element={<ProjectsPage />} />
                    <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
                    <Route path="/projects/:projectId/segment" element={<NewSegmentationPage />} />
                    <Route path="/projects/:projectId/results" element={<ResultsPage />} />
                    <Route path="/segmentation/new" element={<NewSegmentationPage />} />
                    <Route path="/results" element={<ResultsPage />} />

                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/billing" element={<BillingPage />} />
                  </Route>

                  {/* Admin Routes */}
                  <Route path="/admin/login" element={<AdminLoginPage />} />
                  <Route element={<AdminLayout />}>
                    <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
                    <Route path="/admin/users" element={<UserManagementPage />} />
                    <Route path="/admin/models" element={<ModelManagementPage />} />
                    <Route path="/admin/activity" element={<ActivityMonitoringPage />} />
                    <Route path="/admin/system" element={<SystemConfigurationPage />} />
                    <Route path="/admin/diagnostic" element={<DiagnosticPage />} />
                  </Route>

                  {/* Redirect unknown routes to home */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </Router>
          </AdminAuthProvider>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
