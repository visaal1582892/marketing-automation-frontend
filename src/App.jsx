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
import CampaignTypeMasterPage from './pages/admin/CampaignTypeMasterPage'
import EventCampaignTaskMaster from './pages/admin/EventCampaignTaskMaster'
import GranularTaskPage from './pages/admin/GranularTaskPage'
import TaskMappingsPage from './pages/admin/TaskMappingsPage'
import UserManagementPage from './pages/admin/UserManagementPage'
import QuestionMasterPage from './pages/admin/QuestionMasterPage'
import NotificationTemplatesPage from './pages/admin/NotificationTemplatesPage'
import VerticalTypeMappingPage from './pages/admin/VerticalTypeMappingPage'
import TypeFormatMappingPage from './pages/admin/TypeFormatMappingPage'
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
                  <ProtectedRoute requireRight={Rights.CREATE_CAMPAIGN}>
                    <CampaignFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/campaigns/completed"
                element={
                  <ProtectedRoute requireRight={Rights.VIEW_OWN_COMPLETED_TASKS}>
                    <CompletedTasksPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/campaigns/:id"
                element={
                  <ProtectedRoute requireRight={Rights.VIEW_CAMPAIGN_DETAIL}>
                    <CampaignDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/campaigns/:id/edit"
                element={
                  <ProtectedRoute requireRight={Rights.EDIT_OWN_CAMPAIGN}>
                    <CampaignEditPage />
                  </ProtectedRoute>
                }
              />

              {/* ── Worker queue ── */}
              <Route
                path="/my-tasks"
                element={
                  <ProtectedRoute requireRight={Rights.VIEW_MY_TASKS}>
                    <MyTasksPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/collaborations"
                element={
                  <ProtectedRoute
                    requireRight={Rights.ACCESS_COLLABORATIONS}
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
                  <ProtectedRoute requireAnyRight={[Rights.ACCESS_MANAGER_TOOLS, Rights.VIEW_TEAM_TASKS]}>
                    <TaskManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tasks/approvals"
                element={
                  <ProtectedRoute requireAnyRight={[Rights.REVIEW_MANAGER_QC, Rights.APPROVE_TEAM_TASKS]}>
                    <ManagerQcReviewPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/requestor/review-center"
                element={
                  <ProtectedRoute requireRight={Rights.VIEW_REQUESTOR_QC_QUEUE}>
                    <RequestorQcReviewPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manager/analytics"
                element={
                  <ProtectedRoute
                    requireAnyRight={[Rights.VIEW_ANALYTICS_REPORTS, Rights.ACCESS_MANAGER_TOOLS, Rights.VIEW_TEAM_ANALYTICS]}
                  >
                    <AnalyticsPage />
                  </ProtectedRoute>
                }
              />

              {/* ── Budget Planning ── */}
              <Route
                path="/budget-planning"
                element={
                  <ProtectedRoute requireAnyRight={BUDGET_RIGHTS}>
                    <BudgetProposalListPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/budget-planning/wizard/:proposalId?/:stepId?"
                element={
                  <ProtectedRoute requireAnyRight={BUDGET_RIGHTS}>
                    <BudgetPlanningWizard />
                  </ProtectedRoute>
                }
              />

              {/* ── Admin config ── */}
              <Route
                path="/admin/master"
                element={
                  <ProtectedRoute requireRight={Rights.MANAGE_MASTER_DATA}>
                    <MasterHubPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/roles"
                element={
                  <ProtectedRoute requireRight={Rights.MANAGE_SYSTEM_SETTINGS}>
                    <RoleManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/master/budget/event-categories"
                element={
                  <ProtectedRoute requireRight={Rights.MANAGE_MASTER_DATA}>
                    <EventCategoryMasterPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/master/budget/campaign-types"
                element={
                  <ProtectedRoute requireRight={Rights.MANAGE_MASTER_DATA}>
                    <CampaignTypeMasterPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/master/budget/event-campaign-tasks"
                element={
                  <ProtectedRoute requireRight={Rights.MANAGE_MASTER_DATA}>
                    <EventCampaignTaskMaster />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/master/:slug"
                element={
                  <ProtectedRoute requireRight={Rights.MANAGE_MASTER_DATA}>
                    <MasterTablePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/granular-tasks"
                element={
                  <ProtectedRoute requireRight={Rights.MANAGE_GRANULAR_TASKS}>
                    <GranularTaskPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/task-mappings"
                element={
                  <ProtectedRoute requireRight={Rights.MANAGE_ROUTING_CONFIG}>
                    <TaskMappingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute requireRight={Rights.MANAGE_USERS}>
                    <UserManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/questions"
                element={
                  <ProtectedRoute requireRight={Rights.MANAGE_QUESTION_LIBRARY}>
                    <QuestionMasterPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/working-hours"
                element={
                  <ProtectedRoute requireRight={Rights.MANAGE_SYSTEM_SETTINGS}>
                    <WorkingHoursPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/approval-flows"
                element={
                  <ProtectedRoute requireRight={Rights.MANAGE_SYSTEM_SETTINGS}>
                    <ApprovalFlowMasterPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/notification-templates"
                element={
                  <ProtectedRoute requireRight={Rights.MANAGE_NOTIFICATION_TEMPLATES}>
                    <NotificationTemplatesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/campaign-mappings/vertical-type"
                element={
                  <ProtectedRoute requireRight={Rights.MANAGE_CAMPAIGN_SPEC_MAPPINGS}>
                    <VerticalTypeMappingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/campaign-mappings/type-format"
                element={
                  <ProtectedRoute requireRight={Rights.MANAGE_CAMPAIGN_SPEC_MAPPINGS}>
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
