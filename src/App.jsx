import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import { ToastProvider } from './components/Toast'
import { NotificationProvider } from './context/NotificationContext'
import AppLayout from './layouts/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import MasterHubPage from './pages/admin/MasterHubPage'
import MasterTablePage from './pages/admin/MasterTablePage'
import GranularTaskPage from './pages/admin/GranularTaskPage'
import TaskMappingsPage from './pages/admin/TaskMappingsPage'
import UserManagementPage from './pages/admin/UserManagementPage'
import QuestionMasterPage from './pages/admin/QuestionMasterPage'
import QcRoutingPage from './pages/admin/QcRoutingPage'
import NotificationTemplatesPage from './pages/admin/NotificationTemplatesPage'
import VerticalTypeMappingPage from './pages/admin/VerticalTypeMappingPage'
import TypeFormatMappingPage from './pages/admin/TypeFormatMappingPage'
import CampaignFormPage from './pages/campaigns/CampaignFormPage'
import CampaignListPage from './pages/campaigns/CampaignListPage'
import CampaignDetailPage from './pages/campaigns/CampaignDetailPage'
import CompletedTasksPage from './pages/campaigns/CompletedTasksPage'
import MyTasksPage from './pages/tasks/MyTasksPage'
import CollaborationsPage from './pages/tasks/CollaborationsPage'
import ManagerQcReviewPage from './pages/manager/ManagerQcReviewPage'
import RequestorQcReviewPage from './pages/campaigns/RequestorQcReviewPage'
import TaskManagementPage from './pages/manager/TaskManagementPage'
import AnalyticsPage from './pages/manager/AnalyticsPage'
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
        <NotificationProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* ── Campaigns ──
                   The "Requests" list page and form are open to Requestors,
                   Dept Heads, Regional Managers, and Admins — all of whom can
                   now submit briefs directly (no approval gate). Requests are
                   auto-routed to workers on creation.
                   The detail page (/campaigns/:id) stays open for all users. */}
              <Route
                path="/campaigns"
                element={
                  <ProtectedRoute requireRole={['Requestor', 'Head', 'Regional Manager']}>
                    <CampaignListPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/campaigns/new"
                element={
                  <ProtectedRoute requireRole={['Requestor', 'Head', 'Regional Manager']}>
                    <CampaignFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/campaigns/completed"
                element={
                  <ProtectedRoute requireRole={['Requestor', 'Head', 'Regional Manager']}>
                    <CompletedTasksPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
              <Route
                path="/campaigns/:id/edit"
                element={
                  <ProtectedRoute requireRole={['Requestor', 'Head', 'Regional Manager']}>
                    <CampaignFormPage />
                  </ProtectedRoute>
                }
              />

              {/* ── My Tasks (Module 3 — Employee Dashboard) ──
                   Only marketing-team workers (the people the routing engine
                   actually assigns tasks to) ever have a queue to look at, so
                   approvers, requestors and admin are explicitly excluded. */}
              <Route
                path="/my-tasks"
                element={
                  <ProtectedRoute requireWorkerRole>
                    <MyTasksPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/collaborations"
                element={
                  <ProtectedRoute
                    excludeRole={['Head', 'Regional Manager']}
                  >
                    <CollaborationsPage />
                  </ProtectedRoute>
                }
              />

              {/* ── Manager: Task Management / QC review / Reports ── */}
              <Route
                path="/manager/task-management"
                element={
                  <ProtectedRoute requireRole={['Marketing Manager', 'Procurement Manager']}>
                    <TaskManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manager/qc-review"
                element={
                  <ProtectedRoute requireRole={['Marketing Manager', 'Procurement Manager']}>
                    <ManagerQcReviewPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/requestor-qc-review"
                element={
                  <ProtectedRoute requireRole={['Requestor', 'Head', 'Regional Manager']}>
                    <RequestorQcReviewPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manager/analytics"
                element={
                  <ProtectedRoute requireRole={['Marketing Manager', 'Procurement Manager']}>
                    <AnalyticsPage />
                  </ProtectedRoute>
                }
              />

              {/* ── Admin: Master Data — Admin role only ── */}
              <Route
                path="/admin/master"
                element={
                  <ProtectedRoute requireRole={['Admin']}>
                    <MasterHubPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/master/:slug"
                element={
                  <ProtectedRoute requireRole={['Admin']}>
                    <MasterTablePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/granular-tasks"
                element={
                  <ProtectedRoute requireRole={['Admin']}>
                    <GranularTaskPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/task-mappings"
                element={
                  <ProtectedRoute requireRole={['Admin']}>
                    <TaskMappingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute requireRole={['Admin']}>
                    <UserManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/questions"
                element={
                  <ProtectedRoute requireRole={['Admin']}>
                    <QuestionMasterPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/qc-routing"
                element={
                  <ProtectedRoute requireRole={['Admin']}>
                    <QcRoutingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/notification-templates"
                element={
                  <ProtectedRoute requireRole={['Admin']}>
                    <NotificationTemplatesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/campaign-mappings/vertical-type"
                element={
                  <ProtectedRoute requireRole={['Admin']}>
                    <VerticalTypeMappingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/campaign-mappings/type-format"
                element={
                  <ProtectedRoute requireRole={['Admin']}>
                    <TypeFormatMappingPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </NotificationProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
