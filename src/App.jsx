import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import { ToastProvider } from './components/Toast'
import AppLayout from './layouts/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import MasterTablePage from './pages/admin/MasterTablePage'
import GranularTaskPage from './pages/admin/GranularTaskPage'
import RoleTaskMappingPage from './pages/admin/RoleTaskMappingPage'
import UserManagementPage from './pages/admin/UserManagementPage'
import QuestionMasterPage from './pages/admin/QuestionMasterPage'
import CampaignFormPage from './pages/campaigns/CampaignFormPage'
import CampaignListPage from './pages/campaigns/CampaignListPage'
import CampaignDetailPage from './pages/campaigns/CampaignDetailPage'
import MyTasksPage from './pages/tasks/MyTasksPage'
import QcReviewPage from './pages/manager/QcReviewPage'
import TimeReportPage from './pages/manager/TimeReportPage'
import AllRequestsPage from './pages/manager/AllRequestsPage'
import { MASTER_RESOURCES } from './api/masterData'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
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
                  <ProtectedRoute requireRole={['Requestor', 'Head', 'Regional Manager', 'Admin']}>
                    <CampaignListPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/campaigns/new"
                element={
                  <ProtectedRoute requireRole={['Requestor', 'Head', 'Regional Manager', 'Admin']}>
                    <CampaignFormPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/campaigns/:id" element={<CampaignDetailPage />} />

              {/* ── My Tasks (Module 3 — Employee Dashboard) ──
                   Only marketing-team workers (the people the routing engine
                   actually assigns tasks to) ever have a queue to look at, so
                   approvers, requestors and admin are explicitly excluded. */}
              <Route
                path="/my-tasks"
                element={
                  <ProtectedRoute
                    excludeRole={['Requestor', 'Admin', 'Marketing Manager', 'Head', 'Regional Manager']}
                  >
                    <MyTasksPage />
                  </ProtectedRoute>
                }
              />

              {/* ── Manager: All Requests / QC review / Reports ── */}
              <Route
                path="/manager/all-requests"
                element={
                  <ProtectedRoute requireRole={['Marketing Manager', 'Admin']}>
                    <AllRequestsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manager/qc-review"
                element={
                  <ProtectedRoute requireRole={['Marketing Manager', 'Admin']}>
                    <QcReviewPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manager/reports"
                element={
                  <ProtectedRoute requireRole={['Marketing Manager', 'Admin']}>
                    <TimeReportPage />
                  </ProtectedRoute>
                }
              />

              {/* ── Admin: Master Data ── */}
              <Route
                path="/admin/master"
                element={
                  <ProtectedRoute requireRole={['Admin', 'Marketing Manager']}>
                    <Navigate to={`/admin/master/${MASTER_RESOURCES[0].slug}`} replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/master/:slug"
                element={
                  <ProtectedRoute requireRole={['Admin', 'Marketing Manager']}>
                    <MasterTablePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/granular-tasks"
                element={
                  <ProtectedRoute requireRole={['Admin', 'Marketing Manager']}>
                    <GranularTaskPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/role-task-mappings"
                element={
                  <ProtectedRoute requireRole={['Admin', 'Marketing Manager']}>
                    <RoleTaskMappingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute requireRole={['Admin', 'Marketing Manager']}>
                    <UserManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/questions"
                element={
                  <ProtectedRoute requireRole={['Admin', 'Marketing Manager']}>
                    <QuestionMasterPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
