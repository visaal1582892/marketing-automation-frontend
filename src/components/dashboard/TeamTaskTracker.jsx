import { useState, useEffect } from 'react'
import tasksApi from '../../api/tasks'
import Icon from '../Icon'
import Pagination from '../Pagination' // Assuming standard pagination exists, wait I'll use standard pagination UI. Wait, let me check what pagination component is available.

export default function TeamTaskTracker() {
  const [stats, setStats] = useState([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [totalElements, setTotalElements] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchStats = async (p = page, s = search) => {
    setLoading(true)
    try {
      const res = await tasksApi.getTeamMembersStats(s, p, 10)
      setStats(res.data?.content || [])
      setTotalPages(res.data?.totalPages || 1)
      setTotalElements(res.data?.totalElements || 0)
      setPage(res.data?.number || 0)
    } catch (err) {
      console.error('Failed to fetch team stats', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, []) // Initial fetch

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setPage(0)
    fetchStats(0, search)
  }

  const handlePageChange = (newPage) => {
    if (newPage >= 0 && newPage < totalPages) {
      setPage(newPage)
      fetchStats(newPage, search)
    }
  }

  return (
    <section className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[13px] font-bold uppercase tracking-widest text-slate-400">
            Team Member Breakdown
          </h2>
          <p className="text-xs text-slate-400 mt-1">Detailed task execution metrics for your team</p>
        </div>
        <form onSubmit={handleSearchSubmit} className="relative w-64">
          <Icon
            name="search"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search member name..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm 
                       focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">Team Member</th>
                <th className="px-6 py-4">Total Tasks</th>
                <th className="px-6 py-4">Newly Assigned</th>
                <th className="px-6 py-4">In Progress</th>
                <th className="px-6 py-4">Marketing QC</th>
                <th className="px-6 py-4">Requestor QC</th>
                <th className="px-6 py-4">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    Loading stats...
                  </td>
                </tr>
              ) : stats.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    No team members found.
                  </td>
                </tr>
              ) : (
                stats.map((member) => (
                  <tr key={member.memberId} className="transition-colors hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {member.memberName}
                    </td>
                    <td className="px-6 py-4 font-semibold text-brand-600">
                      {member.totalTasks}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {member.newlyAssigned}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {member.inProgress}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {member.marketingQc}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {member.requestorQc}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {member.completed}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="border-t border-slate-100 px-4 py-1">
          <Pagination
            page={page}
            totalPages={totalPages}
            totalElements={totalElements}
            pageSize={10}
            onPageChange={handlePageChange}
            loading={loading}
          />
        </div>
      </div>
    </section>
  )
}
