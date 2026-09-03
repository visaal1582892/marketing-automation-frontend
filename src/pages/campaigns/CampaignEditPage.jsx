import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useToast } from '../../components/Toast'
import campaignsApi from '../../api/campaigns'
import tasksApi from '../../api/tasks'
import Icon from '../../components/Icon'
import CampaignFormComponent from '../../components/CampaignFormComponent'

const CAMPAIGN_STATUS_STYLES = {
  IN_PROGRESS:      'bg-blue-50 text-blue-700 ring-blue-200',
  MARKETING_REVIEW: 'bg-purple-50 text-purple-700 ring-purple-200',
  REQUESTOR_REVIEW: 'bg-violet-50 text-violet-700 ring-violet-200',
  COMPLETED:        'bg-green-50 text-green-700 ring-green-200',
  REJECTED:         'bg-red-50 text-red-700 ring-red-200',
  CANCELLED:        'bg-slate-100 text-slate-500 ring-slate-200',
}

const CAMPAIGN_STATUS_LABELS = {
  IN_PROGRESS:      'In Progress',
  MARKETING_REVIEW: 'Marketing Review',
  REQUESTOR_REVIEW: 'Requestor Review',
  COMPLETED:        'Completed',
  REJECTED:         'Rejected',
  CANCELLED:        'Cancelled',
}

function CampaignStatusBadge({ status }) {
  const cls = CAMPAIGN_STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${cls}`}>
      {CAMPAIGN_STATUS_LABELS[status] || status}
    </span>
  )
}

export default function CampaignEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const showToast = (msg, type = 'info') => toast[type]?.(msg)

  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deletingCampaign, setDeletingCampaign] = useState(false)

  useEffect(() => {
    campaignsApi.getById(id)
      .then(res => setCampaign(res.data))
      .catch(err => {
        console.error(err)
        showToast('Failed to load campaign.', 'error')
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-slate-50/50">
        <Icon name="loader" className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-slate-50/50">
        <p className="text-slate-500">Campaign not found</p>
      </div>
    )
  }

  const handleSubmit = async (payload, meta) => {
    setSubmitting(true)
    try {
      // 1. Delete staged task deletions
      if (meta?.pendingTaskDeletions?.length) {
        for (const taskId of meta.pendingTaskDeletions) {
          await campaignsApi.deleteTask(campaign.campaignId, taskId)
        }
      }

      // 2. Requestor Edit API call
      await campaignsApi.requestorEdit(campaign.campaignId, payload)

      // 3. Task file removals
      if (meta?.taskFileRemovals) {
        for (const [taskId, urlSet] of Object.entries(meta.taskFileRemovals)) {
          for (const url of urlSet) {
            try { await tasksApi.removeTaskFile(taskId, url) } catch {}
          }
        }
      }

      // 4. Save answers for existing tasks
      if (meta?.existingTaskAns) {
        const answerSaves = Object.entries(meta.existingTaskAns).map(async ([workTaskId, ansMap]) => {
          const answers = Object.entries(ansMap)
            .filter(([, v]) => v != null && String(v).trim() !== '')
            .map(([questionId, answerValue]) => ({ questionId, answerValue }))
          if (answers.length > 0) {
            await tasksApi.submitAnswers(workTaskId, answers)
          }
        })
        await Promise.all(answerSaves)
      }

      showToast('Campaign updated successfully!', 'success')
      navigate(-1)
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to save changes.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteCampaign = async () => {
    setDeletingCampaign(true)
    try {
      await campaignsApi.deleteCampaign(campaign.campaignId)
      showToast('Campaign deleted successfully.', 'success')
      navigate(-1)
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to delete campaign.', 'error')
      setDeletingCampaign(false)
    }
  }

  const DELETABLE_STATUSES = new Set(['ASSIGNED', 'HELD', 'ACCEPTED'])
  const workTasks = campaign.workTasks || []
  const canDeleteCampaign = workTasks.every(t => !t.status || DELETABLE_STATUSES.has(t.status))

  return (
    <CampaignFormComponent
      initialData={campaign}
      isEditMode={true}
      onSubmit={handleSubmit}
      onCancel={() => navigate(-1)}
      submitting={submitting}
      headerTitle={
        <>
          Edit Campaign <span className="text-brand-600">#{campaign.campaignId}</span>
        </>
      }
      headerSubtitle="Update details · Add tasks · Manage files"
      statusBadge={<CampaignStatusBadge status={campaign.status} />}
      onDeleteCampaign={handleDeleteCampaign}
      canDeleteCampaign={canDeleteCampaign}
      deletingCampaign={deletingCampaign}
    />
  )
}