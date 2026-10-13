import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import { Rights } from './constants/rights'
import {
  BUDGET_RIGHTS,
  REQUESTOR_RIGHTS,
} from './constants/navAccess'
import { ToastProvider } from './components/Toast'
import { NotificationProvider } from './context/NotificationContext'
import AppLayout from './layouts/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import UnauthorizedPage from './pages/UnauthorizedPage'
import MasterHubPage from './pages/admin/MasterHubPage'
import MasterTablePage from './pages/admin/MasterTablePage'
import RoleManagementPage from './pages/admin/RoleManagementPage'
import EventCategoryMasterPage from './pages/admin/EventCategoryMasterPage'
import EventTaskTypeMappingMasterPage from './pages/admin/EventTaskTypeMappingMasterPage'
import GranularTaskPage from './pages/admin/GranularTaskPage'
import CapabilityMasterPage from './pages/admin/CapabilityMasterPage'
import UserManagementPage from './pages/admin/UserManagementPage'
import QuestionMasterPage from './pages/admin/QuestionMasterPage'
import NotificationTemplatesPage from './pages/admin/NotificationTemplatesPage'
import WorkingHoursPage from './pages/admin/WorkingHoursPage'
import ApprovalFlowMasterPage from './pages/admin/ApprovalFlowMasterPage'
import CampaignFormPage from './pages/campaigns/CampaignFormPage'
import CampaignEditPage from './pages/campaigns/CampaignEditPage'
import CampaignListPage from './pages/campaigns/CampaignListPage'
import CampaignDetailPage from './pages/campaigns/CampaignDetailPage'
import CompletedTasksPage from './pages/campaigns/CompletedTasksPage'
import MyTasksPage from './pages/tasks/MyTasksPage'
import CollaborationsPage from './pages/tasks/CollaborationsPage'
import ManagerQcReviewPage from './pages/manager/ManagerQcReviewPage'
import RequestorQcReviewPage from './pages/campaigns/RequestorQcReviewPage'
import TaskManagementPage from './pages/manager/TaskManagementPage'
import AnalyticsPage from './pages/manager/AnalyticsPage'
import BudgetPlanningWizard from './pages/budget/BudgetPlanningWizard'
import BudgetProposalListPage from './pages/budget/BudgetProposalListPage'
import BudgetApprovalsPage from './pages/budget/BudgetApprovalsPage'

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
              <Route path="/unauthorized" element={<UnauthorizedPage />} />

              {/* ── Campaigns ── */}
              <Route
                path="/campaigns"
                element={
                  <ProtectedRoute requireAnyRight={REQUESTOR_RIGHTS}>
                    <CampaignListPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/campaigns/new"
                element={
                  <ProtectedRoute requireRight={Rights.CAMPAIGN_CREATE}>
                    <CampaignFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/campaigns/completed"
                element={
                  <ProtectedRoute requireRight={Rights.CAMPAIGN_READ_OWN}>
                    <CompletedTasksPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/campaigns/:id"
                element={
                  <ProtectedRoute requireAnyRight={[Rights.CAMPAIGN_READ_OWN, Rights.CAMPAIGN_READ_TEAM, Rights.CAMPAIGN_READ_ALL]}>
                    <CampaignDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/campaigns/:id/edit"
                element={
                  <ProtectedRoute requireRight={Rights.CAMPAIGN_UPDATE_OWN}>
                    <CampaignEditPage />
                  </ProtectedRoute>
                }
              />

              {/* ── Worker queue ── */}
              <Route
                path="/my-tasks"
                element={
                  <ProtectedRoute requireRight={Rights.TASK_READ_OWN}>
                    <MyTasksPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/collaborations"
                element={
                  <ProtectedRoute
                    requireAnyRight={[Rights.COLLABORATION_START, Rights.COLLABORATION_MESSAGE]}
                    excludeRole={[]}
                  >
                    <CollaborationsPage />
                  </ProtectedRoute>
                }
              />

              {/* ── Manager ops ── */}
              <Route
                path="/manager/task-management"
                element={
                  <ProtectedRoute requireAnyRight={[Rights.TASK_READ_TEAM, Rights.TASK_HOLD]}>
                    <TaskManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tasks/approvals"
                element={
                  <ProtectedRoute requireAnyRight={[Rights.MANAGER_QC_READ, Rights.MANAGER_QC_APPROVE, Rights.TASK_READ_TEAM]}>
                    <ManagerQcReviewPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/requestor/review-center"
                element={
                  <ProtectedRoute requireRight={Rights.REQUESTOR_QC_READ}>
                    <RequestorQcReviewPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manager/analytics"
                element={
                  <ProtectedRoute
                    requireAnyRight={[Rights.ANALYTICS_READ_TEAM, Rights.ANALYTICS_READ_ALL, Rights.TASK_READ_TEAM]}
                  >
                    <AnalyticsPage />
                  </ProtectedRoute>
                }
              />

              {/* ── Budget Planning ── */}
              <Route
                path="/budget-planning"
                element={
                  <ProtectedRoute requireRight={Rights.BUDGET_CREATE}>
                    <BudgetProposalListPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/budget-planning/wizard/:proposalId?/:stepId?"
                element={
                  <ProtectedRoute requireAnyRight={[Rights.BUDGET_CREATE, Rights.BUDGET_READ_ALL]}>
                    <BudgetPlanningWizard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/budget/approvals"
                element={
                  <ProtectedRoute requireAnyRight={[Rights.BUDGET_OVERRUN_APPROVE, Rights.BUDGET_APPROVE]}>
                    <BudgetApprovalsPage />
                  </ProtectedRoute>
                }
              />

              {/* ── Admin config ── */}
              <Route
                path="/admin/master"
                element={
                  <ProtectedRoute requireRight={Rights.MASTER_DATA_UPDATE}>
                    <MasterHubPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/roles"
                element={
                  <ProtectedRoute requireRight={Rights.SYSTEM_SETTINGS_UPDATE}>
                    <RoleManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/master/budget/event-categories"
                element={
                  <ProtectedRoute requireRight={Rights.MASTER_DATA_UPDATE}>
                    <EventCategoryMasterPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/master/event-task-types"
                element={
                  <ProtectedRoute requireRight={Rights.MASTER_DATA_UPDATE}>
                    <EventTaskTypeMappingMasterPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/master/capabilities"
                element={
                  <ProtectedRoute requireRight={Rights.MASTER_DATA_UPDATE}>
                    <CapabilityMasterPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/master/:slug"
                element={
                  <ProtectedRoute requireRight={Rights.MASTER_DATA_UPDATE}>
                    <MasterTablePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/granular-tasks"
                element={
                  <ProtectedRoute requireRight={Rights.GRANULAR_TASK_UPDATE}>
                    <GranularTaskPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute requireRight={Rights.USER_UPDATE}>
                    <UserManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/questions"
                element={
                  <ProtectedRoute requireRight={Rights.SYSTEM_SETTINGS_UPDATE}>
                    <QuestionMasterPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/working-hours"
                element={
                  <ProtectedRoute requireRight={Rights.SYSTEM_SETTINGS_UPDATE}>
                    <WorkingHoursPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/approval-flows"
                element={
                  <ProtectedRoute requireRight={Rights.ROUTING_CONFIG_UPDATE}>
                    <ApprovalFlowMasterPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/notification-templates"
                element={
                  <ProtectedRoute requireRight={Rights.NOTIFICATION_TMPL_UPDATE}>
                    <NotificationTemplatesPage />
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
