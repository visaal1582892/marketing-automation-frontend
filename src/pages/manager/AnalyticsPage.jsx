import { useEffect, useState } from 'react'
import managerApi from '../../api/manager'
import Icon from '../../components/Icon'
import { exportToExcel } from '../../utils/exportUtils'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Select from 'react-select'

// Import Report Components
import CampaignOverviewReport from './reports/CampaignOverviewReport'
import TaskOperationsReport from './reports/TaskOperationsReport'
import TeamUtilizationReport from './reports/TeamUtilizationReport'
import SlaCycleTimeReport from './reports/SlaCycleTimeReport'
import BudgetFinancialsReport from './reports/BudgetFinancialsReport'

const REPORT_OPTIONS = [
  { id: 'campaigns', label: 'Campaign & Department Overview' },
  { id: 'utilization', label: 'Team & Resource Utilization' },
  { id: 'operations', label: 'Task Operations & Bottlenecks' },
  { id: 'sla', label: 'SLA & Cycle Time Report' },
  { id: 'financials', label: 'Budget & Financials Overview' }
]

const reactSelectOptions = REPORT_OPTIONS.map(opt => ({ value: opt.id, label: opt.label }))

const customSelectStyles = {
  control: (base, state) => ({
    ...base,
    borderRadius: '0.75rem',
    border: state.isFocused ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
    boxShadow: state.isFocused ? '0 0 0 1px #cbd5e1' : '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    padding: '0.15rem 0.25rem',
    fontSize: '0.875rem',
    fontWeight: '700',
    color: '#334155',
    backgroundColor: '#ffffff',
    cursor: 'pointer',
    minWidth: '280px'
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? '#c2181d' : state.isFocused ? '#fef2f2' : 'white',
    color: state.isSelected ? 'white' : state.isFocused ? '#a31418' : '#334155',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '600'
  }),
  singleValue: (base) => ({
    ...base,
    color: '#334155'
  })
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [activeReport, setActiveReport] = useState('campaigns')
  
  // Date Filtering State
  const defaultEndDate = new Date()
  const defaultStartDate = new Date()
  defaultStartDate.setDate(defaultStartDate.getDate() - 30)
  
  const [dateRange, setDateRange] = useState([defaultStartDate, defaultEndDate])
  const [startDate, endDate] = dateRange;
  const [activePreset, setActivePreset] = useState('30')
  const [dateError, setDateError] = useState(null)

  const formatApiDate = (date) => {
    if (!date) return null;
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const loadData = (start, end) => {
    if (dateError) return
    setLoading(true)
    setError(null)
    const formattedStart = formatApiDate(start);
    const formattedEnd = formatApiDate(end);
    managerApi.analytics({ startDate: formattedStart, endDate: formattedEnd })
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load analytics data.'))
      .finally(() => setLoading(false))
  }

  // Load data on start/end date change (if valid)
  useEffect(() => {
    // Only load if both dates are selected
    if (startDate && endDate) {
      loadData(startDate, endDate)
    }
  }, [startDate, endDate, dateError])

  // --- Date Validation & Presets ---
  const applyPreset = (days, presetId) => {
    setDateError(null)
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - days)
    setDateRange([start, end])
    setActivePreset(presetId)
  }

  const handleDateRangeChange = (update) => {
    setDateRange(update)
    setActivePreset('CUSTOM')
  }

  const formatDateLabel = (date) => {
    if (!date) return ''
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // --- Export Logic ---
  const handleExport = () => {
    if (!data) return

    let datasets = {}
    let filename = 'analytics_export.xlsx'

    switch (activeReport) {
      case 'campaigns':
        datasets = {
          "Department Matrix": data.departmentMatrix || [],
          "Priority Breakdown": data.campaignsByPriority || [],
          "Campaign Status": data.campaignsByStatus || [],
          "Requirement Types": data.campaignsByType || [],
          "Weekly New": data.weeklyNew || []
        }
        filename = 'campaign_overview.xlsx'
        break
      case 'utilization':
        datasets = {
          "Team Performance": data.team || [],
          "Top Rework Tasks": data.topRework || []
        }
        filename = 'team_utilization.xlsx'
        break
      case 'operations':
        datasets = {
          "Tasks By Status": data.tasksByStatus || [],
          "Weekly Completed": data.weeklyCompleted || [],
          "Bottlenecks": data.bottlenecks || [],
          "Time Efficiency": data.timeEfficiencyByType || []
        }
        filename = 'task_operations.xlsx'
        break
      case 'sla':
      case 'financials':
        alert("No data available to export for this report yet.")
        return
      default:
        break
    }

    if (Object.keys(datasets).length > 0) {
      exportToExcel(datasets, filename)
    } else {
      alert("No data available to export for this report yet.")
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Error Toast ── */}
      {dateError && (
        <div className="fixed top-20 right-8 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 z-50 animate-in fade-in slide-in-from-top-2">
          <Icon name="xCircle" className="h-5 w-5" />
          <span className="text-sm font-semibold">{dateError}</span>
          <button onClick={() => setDateError(null)} className="ml-4 text-rose-400 hover:text-rose-600">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Hub Header ── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-5">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
              Manager Reports
            </p>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Analytics Hub</h1>
            <p className="text-sm text-slate-400 mt-0.5 flex items-center gap-2">
              Viewing data for: <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">{formatDateLabel(startDate)} — {formatDateLabel(endDate)}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Report Selector */}
            <Select
              options={reactSelectOptions}
              value={reactSelectOptions.find(o => o.value === activeReport)}
              onChange={(selected) => setActiveReport(selected.value)}
              styles={customSelectStyles}
              isSearchable={false}
            />

            {/* Export Button */}
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 rounded-xl bg-brand-600 text-white border border-brand-700
                         px-4 py-2.5 text-sm font-bold hover:bg-brand-700 transition shadow-sm"
            >
              <Icon name="download" className="h-4 w-4" /> Export Excel
            </button>
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* ── Date Range UI ── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Presets:</span>
            <button 
              onClick={() => applyPreset(0, '0')} 
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                activePreset === '0' 
                  ? 'bg-brand-50 text-brand-700 border-brand-200 shadow-sm' 
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
              }`}
            >Today</button>
            <button 
              onClick={() => applyPreset(7, '7')} 
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                activePreset === '7' 
                  ? 'bg-brand-50 text-brand-700 border-brand-200 shadow-sm' 
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
              }`}
            >This Week</button>
            <button 
              onClick={() => applyPreset(30, '30')} 
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                activePreset === '30' 
                  ? 'bg-brand-50 text-brand-700 border-brand-200 shadow-sm' 
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
              }`}
            >Last 30 Days</button>
            <button 
              onClick={() => applyPreset(90, '90')} 
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                activePreset === '90' 
                  ? 'bg-brand-50 text-brand-700 border-brand-200 shadow-sm' 
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
              }`}
            >Last 90 Days</button>
          </div>

          <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 shadow-sm focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-50 transition px-4 py-2">
            <Icon name="calendar" className="h-4 w-4 text-slate-400" />
            <DatePicker
              selectsRange={true}
              startDate={startDate}
              endDate={endDate}
              onChange={handleDateRangeChange}
              maxDate={new Date()}
              placeholderText="Select date range"
              className="bg-transparent text-sm font-semibold text-slate-700 outline-none w-[200px]"
              dateFormat="MMM d, yyyy"
            />
          </div>
        </div>
      </div>

      {/* ── Error State (API) ── */}
      {error && (
        <div className="flex items-center justify-center py-24 text-rose-500 text-sm font-semibold bg-rose-50 rounded-2xl border border-rose-100">
          {error}
        </div>
      )}

      {/* ── Active Report View ── */}
      {!error && (
        <div className="bg-slate-50/50 rounded-2xl border border-slate-100 min-h-[400px]">
          {activeReport === 'campaigns' && <CampaignOverviewReport data={data} loading={loading} />}
          {activeReport === 'utilization' && <TeamUtilizationReport data={data} loading={loading} />}
          {activeReport === 'operations' && <TaskOperationsReport data={data} loading={loading} />}
          {activeReport === 'sla' && <SlaCycleTimeReport data={data} loading={loading} />}
          {activeReport === 'financials' && <BudgetFinancialsReport data={data} loading={loading} />}
        </div>
      )}
    </div>
  )
}
