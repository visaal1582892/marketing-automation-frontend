import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../components/Toast'
import campaignsApi from '../../api/campaigns'
import Icon from '../../components/Icon'

const STATUS_STYLES = {
  PENDING_DEPT_APPROVAL:      'bg-yellow-50 text-yellow-700 ring-yellow-200',
  PENDING_MARKETING_APPROVAL: 'bg-orange-50 text-orange-700 ring-orange-200',
  PENDING_INTERVENTION:       'bg-amber-50 text-amber-700 ring-amber-200',
  IN_PROGRESS:                'bg-blue-50 text-blue-700 ring-blue-200',
  QC_REVIEW:                  'bg-purple-50 text-purple-700 ring-purple-200',
  COMPLETED:                  'bg-green-50 text-green-700 ring-green-200',
  REJECTED:                   'bg-red-50 text-red-700 ring-red-200',
}

const STATUS_LABELS = {
  PENDING_DEPT_APPROVAL:      'Pending Dept Approval',
  PENDING_MARKETING_APPROVAL: 'Pending Marketing Approval',
  PENDING_INTERVENTION:       'Pending Intervention',
  IN_PROGRESS:                'In Progress',
  QC_REVIEW:                  'QC Review',
  COMPLETED:                  'Completed',
  REJECTED:                   'Rejected',
}

function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${cls}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

export default function CampaignListPage() {
  const { user, hasAnyRole } = useAuth()
  const toast     = useToast()
  const showToast = (msg, type = 'info') => toast[type]?.(msg)
  const navigate = useNavigate()
  const location = useLocation()

  const [campaigns,     setCampaigns]     = useState([])
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)
  const [search,        setSearch]        = useState('')
  const [successBanner, setSuccessBanner] = useState(
    location.state?.justSubmitted ? 'Your request was submitted successfully and has been auto-assigned to the team.' : null
  )

  const isCreator = hasAnyRole('Marketing Creator')

  const load = (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    campaignsApi.list()
      .then((res) => setCampaigns(res.data || []))
      .catch(() => showToast('Failed to load campaigns', 'error'))
      .finally(() => { setLoading(false); setRefreshing(false) })
  }

  // Refetch every time the user navigates to this page (location.key changes on each navigation)
  useEffect(() => {
    load()
    // Clear the justSubmitted flag from browser history state so refresh doesn't re-show the banner
    if (location.state?.justSubmitted) {
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  // Also refetch silently when the window regains focus (handles cross-tab approval updates)
  useEffect(() => {
    const onFocus = () => load(true)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = campaigns.filter((c) => {
    const q = search.toLowerCase()
    return (
      !q ||
      c.requirementTypeName?.toLowerCase().includes(q) ||
      c.requestorName?.toLowerCase().includes(q) ||
      c.departmentName?.toLowerCase().includes(q) ||
      c.status?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-5">
      {/* Success banner */}
      {successBanner && (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <svg className="h-5 w-5 shrink-0 text-green-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
          <p className="flex-1 text-sm font-medium text-green-800">{successBanner}</p>
          <button onClick={() => setSuccessBanner(null)} className="text-green-500 hover:text-green-700 transition">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Marketing Requests</h2>
          <p className="mt-0.5 text-sm text-slate-500">{campaigns.length} total request{campaigns.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            title="Refresh list"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
          >
            <svg className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          {!isCreator && (
            <button
              onClick={() => navigate('/campaigns/new')}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition"
            >
              <Icon name="plus" className="h-4 w-4" /> New Request
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm
            placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500"
          placeholder="Search by type, requestor, department…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-slate-400 py-8 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center">
          <Icon name="inbox" className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">No requests found.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['#', 'Requirement Type', 'Requestor', 'Department', 'Priority', 'Deadline', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.campaignId} className="hover:bg-slate-50/60 transition">
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">#{c.campaignId}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{c.requirementTypeName || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{c.requestorName || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{c.departmentName || '—'}</td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={c.priority} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {c.deadline ? new Date(c.deadline).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate(`/campaigns/${c.campaignId}`)}
                      className="flex items-center gap-1 text-brand-600 hover:text-brand-800 text-xs font-medium"
                    >
                      <Icon name="eye" className="h-3.5 w-3.5" /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function PriorityBadge({ priority }) {
  const map = {
    HIGH:   'bg-red-50 text-red-700 ring-red-200',
    MEDIUM: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
    LOW:    'bg-green-50 text-green-700 ring-green-200',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${map[priority] || 'bg-slate-100 text-slate-600'}`}>
      {priority || '—'}
    </span>
  )
}
