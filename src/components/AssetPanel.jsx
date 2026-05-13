import { useEffect, useRef, useState } from 'react'
import collaborationApi from '../api/collaboration'
import tasksApi from '../api/tasks'
import api from '../api/client'
import Icon from './Icon'
import { useToast } from './Toast'
import { useAuth } from '../auth/AuthContext'

// ─── Constants ────────────────────────────────────────────────────────────────

// Chat and asset uploads are only open while the task is actively being worked.
export const CHAT_OPEN_STATUSES = ['IN_PROGRESS', 'REWORK', 'REQUESTOR_REWORK']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return ''
  try {
    const d   = new Date(iso)
    const now = new Date()
    const sameDay = (a, b) =>
      a.getDate() === b.getDate() &&
      a.getMonth() === b.getMonth() &&
      a.getFullYear() === b.getFullYear()
    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    if (sameDay(d, now))       return 'Today'
    if (sameDay(d, yesterday)) return 'Yesterday'
    return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return '' }
}

export const isImage = (url) => url && /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url)
export const isVideo = (url) => url && /\.(mp4|mov|webm|avi)(\?|$)/i.test(url)

const isOfficeDoc = (url, filename) => {
  const name = filename || url || ''
  return /\.(xls|xlsx|ppt|pptx|doc|docx)(\?|$)/i.test(name)
}

export const displayName = (a) => a.originalFilename || (
  (() => { try { return decodeURIComponent(a.url.split('/').pop().split('?')[0]) } catch { return 'File' } })()
)

export const openUrl = (assetUrl, filename) => {
  if (isOfficeDoc(assetUrl, filename)) {
    return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(assetUrl)}`
  }
  return assetUrl
}

export const triggerDownload = async (taskId, assetId, filename) => {
  try {
    const resp = await api.get(
      `/collaborations/${taskId}/assets/${assetId}/download`,
      { responseType: 'blob', timeout: 120_000 },
    )
    const url = URL.createObjectURL(resp.data)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  } catch (e) {
    console.error('Download failed', e)
  }
}

// ─── Upload row ───────────────────────────────────────────────────────────────

export function UploadRow({ name, status, error, onRetry, onClear }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2
      ${status === 'error'
        ? 'border-rose-200 bg-rose-50'
        : status === 'done'
          ? 'border-green-100 bg-green-50'
          : 'border-slate-100 bg-slate-50'}`}>
      {status === 'uploading' ? (
        <svg className="h-3.5 w-3.5 animate-spin text-brand-500 shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      ) : status === 'done' ? (
        <Icon name="check" className="h-3.5 w-3.5 text-green-500 shrink-0" />
      ) : (
        <Icon name="alertCircle" className="h-3.5 w-3.5 text-rose-500 shrink-0" />
      )}
      <span className="flex-1 text-xs text-slate-700 truncate" title={name}>{name}</span>
      {status === 'uploading' && (
        <span className="text-[10px] text-slate-400 shrink-0">Uploading…</span>
      )}
      {status === 'error' && error && (
        <span className="text-[10px] text-rose-600 shrink-0 max-w-[90px] truncate" title={error}>{error}</span>
      )}
      {status === 'error' && onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold
                     text-brand-600 hover:bg-brand-50 hover:text-brand-800 transition shrink-0">
          <Icon name="refresh" className="h-2.5 w-2.5" />
          Retry
        </button>
      )}
      {status !== 'uploading' && onClear && (
        <button
          onClick={onClear}
          title="Remove"
          className="rounded-full p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition shrink-0">
          <Icon name="x" className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

// ─── Asset Panel ──────────────────────────────────────────────────────────────

/**
 * Full-featured asset modal — view, download, open, user-specific delete,
 * upload with per-file retry/clear, and error banners.
 *
 * Props:
 *   task          — work task object ({ taskId, granularTaskName, status, collaborationActive, … })
 *   onClose       — close handler
 *   allowUpload   — (optional) force-enable the upload button regardless of task status /
 *                   collaborationActive flag. Useful in contexts like the QC submit modal
 *                   where the worker should always be able to add files.
 */
/**
 * When inline=true the panel renders as plain content (no modal backdrop, no
 * close button). Useful for embedding inside another modal.
 */
export default function AssetPanel({ task, onClose, allowUpload = false, inline = false }) {
  const toast = useToast()
  const { user } = useAuth()
  const [assets,       setAssets]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [uploadError,  setUploadError]  = useState('')
  const [pendingFiles, setPendingFiles] = useState([])
  const [isDragOver,   setIsDragOver]   = useState(false)
  const fileRef = useRef(null)

  const currentUserId = user?.id
  const isUploading   = pendingFiles.some(f => f.status === 'uploading')
  const canUpload     = allowUpload || (CHAT_OPEN_STATUSES.includes(task.status) && task.collaborationActive)

  const refreshAssets = () =>
    collaborationApi.getAssets(task.taskId)
      .then(res => setAssets(res.data || []))
      .catch(() => {})

  useEffect(() => {
    refreshAssets().finally(() => setLoading(false))
  }, [task.taskId]) // eslint-disable-line react-hooks/exhaustive-deps

  const showError = (msg) => {
    setUploadError(msg)
    setTimeout(() => setUploadError(''), 6000)
  }

  const uploadFiles = async (files) => {
    setUploadError('')
    const blocked = []
    const allowed = []
    for (const file of files) {
      if (/\.(docx?)$/i.test(file.name)) {
        blocked.push(file.name)
      } else {
        allowed.push(file)
      }
    }
    if (blocked.length) {
      showError(`DOC/DOCX not allowed: ${blocked.join(', ')} — convert to PDF.`)
    }
    if (!allowed.length) return

    const placeholders = allowed.map(f => ({ file: f, name: f.name, status: 'uploading', error: null }))
    const startIdx = pendingFiles.length
    setPendingFiles(prev => [...prev, ...placeholders])

    const results = await Promise.allSettled(
      allowed.map(async (file) => {
        const fd = new FormData()
        fd.append('files', file)
        const res = await tasksApi.uploadAssets(fd)
        const url              = res.data?.urls?.[0]              || null
        const thumbnailUrl     = res.data?.thumbnailUrls?.[0]     || null
        const originalFilename = res.data?.originalFilenames?.[0] || file.name
        if (!url) throw new Error('No URL returned from server')
        await collaborationApi.addAsset(task.taskId, url, thumbnailUrl, originalFilename)
        return { url, thumbnailUrl, originalFilename }
      })
    )

    setPendingFiles(prev => {
      const next = [...prev]
      results.forEach((result, i) => {
        const idx = startIdx + i
        if (idx >= next.length) return
        if (result.status === 'fulfilled') {
          next[idx] = { ...next[idx], status: 'done' }
        } else {
          const raw = result.reason?.response?.data?.message || result.reason?.message || 'Upload failed'
          const msg = raw.toLowerCase().includes('unsupported') || raw.toLowerCase().includes('format')
            ? 'Format not supported'
            : raw.length > 50 ? 'Upload failed' : raw
          next[idx] = { ...next[idx], status: 'error', error: msg }
        }
      })
      return next
    })

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed    = results.length - succeeded
    if (succeeded > 0) {
      await refreshAssets()
      toast.success?.(`${succeeded} file${succeeded > 1 ? 's' : ''} uploaded${failed > 0 ? `, ${failed} failed` : ''}.`)
    }
    if (failed > 0 && succeeded === 0) {
      showError(`${failed} file${failed > 1 ? 's' : ''} failed to upload. Check the format and try again.`)
    }
  }

  const clearPending = (idx) =>
    setPendingFiles(prev => prev.filter((_, i) => i !== idx))

  const retryFile = async (idx) => {
    const entry = pendingFiles[idx]
    if (!entry?.file) return
    const f = entry.file
    setPendingFiles(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], status: 'uploading', error: null }
      return next
    })
    try {
      const fd = new FormData()
      fd.append('files', f)
      const res              = await tasksApi.uploadAssets(fd)
      const url              = res.data?.urls?.[0]              || null
      const thumbnailUrl     = res.data?.thumbnailUrls?.[0]     || null
      const originalFilename = res.data?.originalFilenames?.[0] || f.name
      if (!url) throw new Error('No URL returned from server')
      await collaborationApi.addAsset(task.taskId, url, thumbnailUrl, originalFilename)
      setPendingFiles(prev => {
        const next = [...prev]
        next[idx] = { ...next[idx], status: 'done', error: null }
        return next
      })
      await refreshAssets()
      toast.success?.('File uploaded.')
    } catch (e) {
      const raw = e?.response?.data?.message || e?.message || 'Upload failed'
      const msg = raw.toLowerCase().includes('unsupported') || raw.toLowerCase().includes('format')
        ? 'Format not supported'
        : raw.length > 50 ? 'Upload failed' : raw
      setPendingFiles(prev => {
        const next = [...prev]
        next[idx] = { ...next[idx], status: 'error', error: msg }
        return next
      })
    }
  }

  const removeAsset = async (assetId) => {
    try {
      await collaborationApi.deleteAsset(task.taskId, assetId)
      setAssets(prev => prev.filter(a => a.assetId !== assetId))
      toast.success?.('Asset removed.')
    } catch (e) {
      toast.error?.(e?.response?.data?.message || 'Could not remove asset.')
    }
  }

  const downloadAll = () => {
    assets.forEach(a => triggerDownload(a.taskId || task.taskId, a.assetId, displayName(a)))
  }

  const linkedTaskId = task.linkedContentTaskId
  const mainAssets = linkedTaskId
    ? assets.filter(a => (a.taskId || task.taskId) === task.taskId)
    : assets
  const contentAssets = linkedTaskId
    ? assets.filter(a => a.taskId === linkedTaskId)
    : []

  const renderAssetRow = (a, i) => (
    <div key={a.assetId ?? i} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
      {(a.thumbnailUrl || isImage(a.url)) ? (
        <img src={a.thumbnailUrl || a.url} alt="" className="h-14 w-14 rounded-lg object-cover shrink-0 border border-slate-200" />
      ) : isVideo(a.url) ? (
        <div className="h-14 w-14 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
          <Icon name="play" className="h-5 w-5 text-purple-500" />
        </div>
      ) : (
        <div className="h-14 w-14 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
          <Icon name="fileText" className="h-5 w-5 text-slate-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-800 truncate">{displayName(a)}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">by {a.userName} · {fmtDate(a.createdAt)}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <button
            onClick={() => triggerDownload(a.taskId || task.taskId, a.assetId, displayName(a))}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-brand-600 hover:text-brand-800 transition"
          >
            <Icon name="download" className="h-3 w-3" />
            Download
          </button>
          <span className="text-slate-200">|</span>
          <a
            href={openUrl(a.url, displayName(a))}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-700 transition"
          >
            <Icon name="externalLink" className="h-3 w-3" />
            Open
          </a>
        </div>
      </div>
      {Number(a.userId) === Number(currentUserId) && (
        <button
          onClick={() => removeAsset(a.assetId)}
          title="Remove asset"
          className="rounded-lg p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition shrink-0"
        >
          <Icon name="trash2" className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )

  const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true) }
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragOver(false) }
  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files || [])
    if (files.length) uploadFiles(files)
  }

  // ── Shared inner content ───────────────────────────────────────────────────
  const inner = (
    <div className={inline
      ? 'flex flex-col gap-3'
      : 'w-full max-w-lg max-h-[88vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden'
    }>

      {/* Header row — shown in both modes */}
      <div className={`flex items-center justify-between shrink-0 ${
        inline ? '' : 'px-5 py-4 border-b border-slate-100'
      }`}>
        {!inline && (
          <div>
            <h3 className="text-sm font-bold text-slate-900">Assets</h3>
            <p className="text-xs text-slate-500 mt-0.5">{task.granularTaskName || task.taskId}</p>
          </div>
        )}
        <div className={`flex items-center gap-2 ${inline ? 'ml-auto' : ''}`}>
          <button
            onClick={downloadAll}
            disabled={assets.length === 0}
            title={assets.length === 0 ? 'No assets to download' : `Download all ${assets.length} asset${assets.length !== 1 ? 's' : ''}`}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Icon name="download" className="h-3.5 w-3.5" />
            Download All
          </button>
          {canUpload && !inline && (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition disabled:opacity-50"
            >
              <Icon name="upload" className="h-3.5 w-3.5" />
              {isUploading ? 'Uploading…' : 'Add Files'}
            </button>
          )}
          {!inline && (
            <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
              <Icon name="x" className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Hidden multi-file input */}
      <input
        ref={fileRef}
        type="file"
        multiple
        className="sr-only"
        accept="image/*,video/*,.pdf,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.doc,.docx,.zip"
        onChange={e => {
          const files = Array.from(e.target.files || [])
          if (files.length) uploadFiles(files)
          e.target.value = ''
        }}
      />

      {/* Drag-and-drop upload zone — inline mode only */}
      {canUpload && inline && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed py-6 cursor-pointer transition select-none
            ${isDragOver
              ? 'border-brand-400 bg-brand-50'
              : 'border-slate-200 bg-slate-50 hover:border-brand-300 hover:bg-brand-50/40'}`}
        >
          <Icon name="upload" className={`h-7 w-7 transition ${isDragOver ? 'text-brand-500' : 'text-slate-300'}`} />
          <p className="text-sm font-medium text-slate-600">
            {isDragOver ? 'Drop files here' : 'Drag & drop files here'}
          </p>
          <p className="text-xs text-slate-400">
            or <span className="text-brand-600 font-medium">browse files</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Images, videos, PDFs, Excel, PowerPoint, CSV</p>
        </div>
      )}

      {/* Error banner */}
      {uploadError && (
        <div className={`flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-xs text-red-700 shrink-0 ${inline ? '' : 'mx-4 mt-3'}`}>
          <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span>{uploadError}</span>
        </div>
      )}

      {/* In-progress uploads */}
      {pendingFiles.length > 0 && (
        <div className={`space-y-1 shrink-0 ${inline ? '' : 'mx-4 mt-3'}`}>
          {pendingFiles.map((f, i) => (
            <UploadRow
              key={i}
              name={f.name}
              status={f.status}
              error={f.error}
              onRetry={f.status === 'error' ? () => retryFile(i) : undefined}
              onClear={f.status !== 'uploading' ? () => clearPending(i) : undefined}
            />
          ))}
        </div>
      )}

      {/* Asset list */}
      <div className={`space-y-2 ${inline ? '' : 'overflow-y-auto p-4 flex-1'}`}>
        {loading ? (
          <p className="text-center text-slate-400 text-sm py-6">Loading…</p>
        ) : assets.length === 0 ? (
          <div className={`text-center ${inline ? 'py-4' : 'py-10'}`}>
            {!inline && <Icon name="upload" className="mx-auto h-8 w-8 text-slate-200 mb-2" />}
            <p className="text-sm text-slate-400">No assets yet.{canUpload && !inline ? ' Use Add Files above.' : ''}</p>
          </div>
        ) : linkedTaskId ? (
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Main task assets</p>
              <div className="space-y-2">
                {mainAssets.length === 0
                  ? <p className="text-sm text-slate-400 py-2">No main task assets yet.</p>
                  : mainAssets.map(renderAssetRow)}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500 mb-2">Content writer assets</p>
              <div className="space-y-2">
                {contentAssets.length === 0
                  ? <p className="text-sm text-slate-400 py-2">No content assets yet.</p>
                  : contentAssets.map(renderAssetRow)}
              </div>
            </div>
          </div>
        ) : assets.map(renderAssetRow)}
      </div>
    </div>
  )

  if (inline) return inner

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      {inner}
    </div>
  )
}
