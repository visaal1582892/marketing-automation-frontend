import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../components/Toast'
import campaignsApi from '../../api/campaigns'
import tasksApi from '../../api/tasks'
import Icon from '../../components/Icon'
import CampaignFormComponent from '../../components/CampaignFormComponent'

export default function CampaignFormPage() {
  const [searchParams] = useSearchParams()
  const cloneSourceId = searchParams.get('cloneFrom')
  const { user }     = useAuth()
  const navigate     = useNavigate()
  const toast        = useToast()
  const showToast    = (msg, type = 'info') => toast[type]?.(msg)

  const [cloneData, setCloneData]     = useState(null)
  const [cloneLoading, setCloneLoading] = useState(!!cloneSourceId)
  const [submitting, setSubmitting]   = useState(false)

  useEffect(() => {
    if (!cloneSourceId) return
    setCloneLoading(true)
    campaignsApi.getById(cloneSourceId)
      .then(res => {
        const c = res.data
        if (!c) return

        // Directive 1: Do NOT clone attached files. Cloned campaign starts with empty files.
        const cleanClone = {
          ...c,
          fileUrls: [],
          fileOriginalNames: [],
          // Keep user's departmentId if preferred or source departmentId
          departmentId: user?.departmentId || c.departmentId,
        }
        setCloneData(cleanClone)
      })
      .catch(() => showToast('Failed to load source campaign for cloning.', 'error'))
      .finally(() => setCloneLoading(false))
  }, [cloneSourceId, user?.departmentId])

  if (cloneLoading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center gap-3 bg-slate-50/50 text-slate-400">
        <svg className="h-6 w-6 animate-spin text-brand-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        <span className="text-sm font-medium">Loading clone source…</span>
      </div>
    )
  }

  const handleSubmit = async (payload) => {
    setSubmitting(true)
    try {
      // 1. Create campaign
      const result = await campaignsApi.create(payload)
      const newCampaignId = result.data?.campaignId

      // 2. Link any per-task staged files to the newly created work tasks
      if (newCampaignId && payload.newTaskSpecs?.length) {
        const detail = await campaignsApi.getById(newCampaignId).catch(() => null)
        const workTasks = detail?.data?.workTasks || []

        const linkJobs = payload.newTaskSpecs
          .map(spec => {
            const wt = workTasks.find(t => String(t.granularTaskId) === String(spec.granularTaskId))
            if (!wt || !spec.fileUrls?.length) return null
            return { wt, fileUrls: spec.fileUrls, fileNames: spec.fileOriginalNames }
          })
          .filter(Boolean)

        if (linkJobs.length) {
          const outcomes = await Promise.allSettled(
            linkJobs.map(({ wt, fileUrls, fileNames }) =>
              tasksApi.addTaskFiles(wt.taskId, newCampaignId, fileUrls, fileNames)
            )
          )
          const failCount = outcomes.filter(o => o.status === 'rejected').length
          if (failCount > 0) {
            showToast(`Campaign submitted, but files for ${failCount} task(s) could not be linked.`, 'info')
          }
        }
      }

      showToast(cloneSourceId ? 'Cloned campaign submitted successfully!' : 'Request submitted successfully!', 'success')
      setTimeout(() => navigate('/campaigns', { state: { justSubmitted: true } }), 1000)
    } catch (err) {
      console.error('[Form] Create error:', err)
      const serverMsg = err?.response?.data?.message || err?.response?.data?.error
      showToast(serverMsg || 'Failed to submit request. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const initialData = cloneData || { departmentId: user?.departmentId }

  return (
    <CampaignFormComponent
      initialData={initialData}
      isEditMode={false}
      onSubmit={handleSubmit}
      onCancel={() => navigate('/campaigns')}
      submitting={submitting}
      headerTitle={cloneSourceId ? `Clone Request (From #${cloneSourceId})` : 'New Marketing Request'}
      headerSubtitle={
        cloneSourceId
          ? `Cloned from campaign #${cloneSourceId} — review and edit before submitting.`
          : 'Fill details · Select tasks · Upload reference files'
      }
    />
  )
}
