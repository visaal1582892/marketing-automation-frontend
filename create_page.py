import os

repo_dir = "/home/developer/rohitworkspace/prod/marketing-automation/marketing-automation-frontend"
page_path = os.path.join(repo_dir, "src/pages/tasks/TaskApprovalsPage.jsx")

content = """import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/client'
import { useToast } from '../../components/Toast'
import Icon from '../../components/Icon'
import Pagination from '../../components/Pagination'
import { format } from 'date-fns'

export default function TaskApprovalsPage() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  
  // Pagination state
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const size = 15
  
  const toast = useToast()

  const loadApprovals = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/tasks/my-approvals', { // Wait, ManagerController maps to /admin. Actually ManagerController has @RequestMapping("/api/admin")
        params: { search, page, size }
      })
      setTasks(data.content || [])
      setTotalPages(data.totalPages || 1)
    } catch (err) {
      toast.error('Failed to load pending approvals')
    } finally {
      setLoading(false)
    }
  }, [search, page, size, toast])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadApprovals()
    }, 300)
    return () => clearTimeout(timer)
  }, [loadApprovals])

  const getBadge = (task) => {
    if (task.status === 'REQUESTOR_QC_REVIEW') {
      return <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 ring-1 ring-purple-200">Final Requestor QC</span>
    } else if (task.status === 'MANAGER_QC_REVIEW') {
      return <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200">Legacy Manager QC</span>
    } else {
      return <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">Configurable QC</span>
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Task Approvals Inbox</h1>
          <p className="mt-1 text-sm text-slate-500">
            Unified queue for all your pending approvals
          </p>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Task ID, Campaign, Name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full rounded-lg border-slate-200 bg-white pl-10 pr-4 py-2 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-6 py-4 font-semibold">Task Details</th>
                <th className="px-6 py-4 font-semibold">Campaign Info</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Queue Type</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    <Icon name="loading" className="mx-auto h-6 w-6 animate-spin" />
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <Icon name="checkCircle" className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                    <p className="text-base font-medium text-slate-900">You're all caught up!</p>
                    <p className="text-sm">No tasks currently require your approval.</p>
                  </td>
                </tr>
              ) : (
                tasks.map(task => (
                  <tr key={task.taskId} className="transition hover:bg-slate-50/50 group">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{task.taskName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{task.taskId}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{task.campaignName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">ID: {task.campaignId}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-900">{task.taskTypeName}</div>
                    </td>
                    <td className="px-6 py-4">
                      {getBadge(task)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/tasks/${task.taskId}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 transition"
                      >
                        <Icon name="eye" className="h-3.5 w-3.5" />
                        Review
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="border-t border-slate-100 px-6 py-4">
            <Pagination 
              currentPage={page} 
              totalPages={totalPages} 
              onPageChange={setPage} 
            />
          </div>
        )}
      </div>
    </div>
  )
}
"""

with open(page_path, "w") as f:
    f.write(content)

# Update App.jsx to include the new route
app_file = os.path.join(repo_dir, "src/App.jsx")
with open(app_file, "r") as f:
    app_content = f.read()

import_stmt = "import TaskApprovalsPage from './pages/tasks/TaskApprovalsPage'"
if import_stmt not in app_content:
    app_content = app_content.replace(
        "import ManagerQcReviewPage from './pages/tasks/ManagerQcReviewPage'",
        "import ManagerQcReviewPage from './pages/tasks/ManagerQcReviewPage'\n" + import_stmt
    )
    app_content = app_content.replace(
        "<Route path=\"/tasks/manager-qc\" element={<ManagerQcReviewPage />} />",
        "<Route path=\"/tasks/manager-qc\" element={<ManagerQcReviewPage />} />\n              <Route path=\"/tasks/approvals\" element={<TaskApprovalsPage />} />"
    )
    with open(app_file, "w") as f:
        f.write(app_content)

print("TaskApprovalsPage created and added to App.jsx!")
