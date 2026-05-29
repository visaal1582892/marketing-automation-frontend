import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import collaborationApi from '../api/collaboration'
import tasksApi from '../api/tasks'
import api from '../api/client'

// ─── File-type helpers ────────────────────────────────────────────────────────

function detectType(url, filename) {
  const name = (filename || url || '').split('?')[0].toLowerCase()
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff?)$/.test(name)) return 'image'
  if (/\.(mp4|mov|avi|webm|wmv|mpg|mpeg|mkv)$/.test(name)) return 'video'
  if (/\.pdf$/.test(name)) return 'pdf'
  if (/\.(xls|xlsx|ppt|pptx|doc|docx)$/.test(name)) return 'office'
  // Fallback: guess from URL path keywords
  if (name.includes('/image') || name.includes('/img')) return 'image'
  return 'file'
}

/** For Office formats, route through Microsoft Office Online viewer. */
function buildOpenUrl(assetUrl, filename) {
  const name = (filename || assetUrl || '').toLowerCase()
  if (/\.(xls|xlsx|ppt|pptx|doc|docx)(\?|$)/.test(name)) {
    return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(assetUrl)}`
  }
  return assetUrl
}

function displayName(asset) {
  if (asset.originalFilename) return asset.originalFilename
  try {
    return decodeURIComponent(asset.url.split('/').pop().split('?')[0]) || 'File'
  } catch {
    return 'File'
  }
}

function fmtDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

// ─── Download via backend proxy ───────────────────────────────────────────────
// Uses axios so the request goes to the configured backend URL (ngrok/prod)
// with the JWT header — avoids the relative-URL pitfall on Vercel deployments.

async function triggerDownload(taskId, assetId, filename) {
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

// ─── Single asset row ─────────────────────────────────────────────────────────

function AssetRow({ asset, taskId, currentUserId, onDeleted }) {
  const [deleting, setDeleting] = useState(false)
  const name  = displayName(asset)
  const type  = detectType(asset.url, name)
  const isOwn = currentUserId != null && Number(asset.userId) === Number(currentUserId)

  const handleDelete = async () => {
    if (!window.confirm(`Remove "${name}"?`)) return
    setDeleting(true)
    try {
      await collaborationApi.deleteAsset(taskId, asset.assetId)
      onDeleted(asset.assetId)
    } catch {
      // silently ignore — parent will keep the row
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
      {/* Thumbnail / icon */}
      {type === 'image' ? (
        <img
          src={asset.thumbnailUrl || asset.url}
          alt={name}
          className="h-14 w-14 rounded-lg object-cover shrink-0 border border-slate-200"
        />
      ) : type === 'video' ? (
        <div className="h-14 w-14 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
          <Icon name="play" className="h-5 w-5 text-purple-500" />
        </div>
      ) : type === 'pdf' ? (
        <div className="h-14 w-14 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
          <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
      ) : type === 'office' ? (
        <div className="h-14 w-14 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
          <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75.125V6.375A2.625 2.625 0 014.875 3.75H9m0 0h6.75M9 3.75h1.5m0 0v.375m0-.375h3M12 3.75V4.5m3 0h.375A2.625 2.625 0 0118 7.125v11.25M12 4.5V18" />
          </svg>
        </div>
      ) : (
        <div className="h-14 w-14 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
          <Icon name="fileText" className="h-5 w-5 text-slate-400" />
        </div>
      )}

      {/* Info + actions */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-800 truncate" title={name}>{name}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">
          by {asset.userName || 'Unknown'}
          {asset.createdAt ? ` · ${fmtDate(asset.createdAt)}` : ''}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <button
            onClick={() => triggerDownload(taskId, asset.assetId, name)}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-brand-600 hover:text-brand-800 transition"
          >
            <Icon name="download" className="h-3 w-3" />
            Download
          </button>
          <span className="text-slate-200">|</span>
          <a
            href={buildOpenUrl(asset.url, name)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-700 transition"
          >
            <Icon name="externalLink" className="h-3 w-3" />
            Open
          </a>
        </div>
      </div>

      {/* Delete — own assets only */}
      {isOwn && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          title="Remove asset"
          className="rounded-lg p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition shrink-0 disabled:opacity-50"
        >
          {deleting
            ? <span className="h-3.5 w-3.5 animate-spin rounded-full border border-rose-400 border-t-transparent block" />
            : <Icon name="trash2" className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  )
}

// ─── Upload row (shown while a file is being uploaded) ───────────────────────

function UploadRow({ name, status, error }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2
      ${status === 'error' ? 'border-rose-200 bg-rose-50'
        : status === 'done' ? 'border-green-100 bg-green-50'
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
      {status === 'uploading' && <span className="text-[10px] text-slate-400 shrink-0">Uploading…</span>}
      {status === 'error' && error && <span className="text-[10px] text-rose-600 shrink-0 truncate max-w-[100px]" title={error}>{error}</span>}
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

/**
 * Rich shared modal for viewing (and optionally uploading) task assets.
 *
 * Props:
 *   taskId        — work task ID (loads assets from collaboration API)
 *   taskName      — display label shown under the header title
 *   currentUserId — (optional) logged-in user ID; enables delete button on own assets
 *   canUpload     — (optional) show the Add Files button and handle uploads
 *   onClose       — close handler
 */
export default function AssetPreviewModal({ taskId, taskName, currentUserId, canUpload = false, onClose }) {
  const [assets,       setAssets]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [pendingFiles, setPendingFiles] = useState([])
  const [uploadError,  setUploadError]  = useState('')
  const fileRef = useRef(null)

  const isUploading = pendingFiles.some(f => f.status === 'uploading')

  const refreshAssets = () =>
    collaborationApi.getAssets(taskId)
      .then(res => setAssets(res.data || []))
      .catch(() => {})

  useEffect(() => {
    if (!taskId) return
    setLoading(true)
    refreshAssets().finally(() => setLoading(false))
  }, [taskId]) // eslint-disable-line react-hooks/exhaustive-deps

  const showError = (msg) => {
    setUploadError(msg)
    setTimeout(() => setUploadError(''), 6000)
  }

  const uploadFiles = async (files) => {
    setUploadError('')
    const allowed = []
    for (const file of files) {
      if (/\.(docx?)$/i.test(file.name)) {
        showError(`"${file.name}" — DOC/DOCX not allowed. Convert to PDF or an image.`)
        continue
      }
      allowed.push(file)
    }
    if (!allowed.length) return

    const offset = pendingFiles.length
    setPendingFiles(prev => [...prev, ...allowed.map(f => ({ name: f.name, status: 'uploading', error: null }))])

    const fd = new FormData()
    allowed.forEach(f => fd.append('files', f))
    try {
      const res = await tasksApi.uploadAssets(fd)
      const urls      = res.data?.urls              || []
      const thumbUrls = res.data?.thumbnailUrls     || []
      const origNames = res.data?.originalFilenames || []
      await Promise.all(allowed.map((_, i) => {
        const url = urls[i]; if (!url) return Promise.resolve()
        return collaborationApi.addAsset(taskId, url, thumbUrls[i] || null, origNames[i] || allowed[i].name)
      }))
      setPendingFiles(prev => prev.map((f, idx) =>
        idx >= offset && idx < offset + allowed.length ? { ...f, status: 'done' } : f
      ))
      await refreshAssets()
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Upload failed.'
      showError(msg.toLowerCase().includes('unsupported') || msg.toLowerCase().includes('format')
        ? 'File format not supported by the server. Try a different file.'
        : msg)
      setPendingFiles(prev => prev.map((f, idx) =>
        idx >= offset && idx < offset + allowed.length ? { ...f, status: 'error', error: 'Failed' } : f
      ))
    }
  }

  const downloadAll = () =>
    assets.forEach(a => triggerDownload(taskId, a.assetId, displayName(a)))

  const handleDeleted = (assetId) =>
    setAssets(prev => prev.filter(a => a.assetId !== assetId))

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[88vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Assets</h3>
            {taskName && <p className="text-xs text-slate-500 mt-0.5">{taskName}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadAll}
              disabled={assets.length === 0}
              title={assets.length === 0 ? 'No assets to download' : `Download all ${assets.length} asset${assets.length !== 1 ? 's' : ''}`}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Icon name="download" className="h-3.5 w-3.5" />
              Download All
            </button>
            {canUpload && (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition disabled:opacity-50"
              >
                <Icon name="upload" className="h-3.5 w-3.5" />
                {isUploading ? 'Uploading…' : 'Add Files'}
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Hidden file input */}
        {canUpload && (
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
        )}

        {/* Upload error */}
        {uploadError && (
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 shrink-0">
            <Icon name="alertCircle" className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* In-progress upload rows */}
        {pendingFiles.length > 0 && (
          <div className="mx-4 mt-3 space-y-1 shrink-0">
            {pendingFiles.map((f, i) => (
              <UploadRow key={i} name={f.name} status={f.status} error={f.error} />
            ))}
          </div>
        )}

        {/* Scrollable list */}
        <div className="overflow-y-auto p-4 space-y-3 flex-1">
          {loading ? (
            <p className="text-center text-slate-400 text-sm py-8">Loading assets…</p>
          ) : assets.length === 0 ? (
            <div className="text-center py-10">
              <Icon name="upload" className="mx-auto h-8 w-8 text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">No assets yet.{canUpload ? ' Use Add Files above.' : ''}</p>
            </div>
          ) : (
            assets.map(a => (
              <AssetRow
                key={a.assetId}
                asset={a}
                taskId={taskId}
                currentUserId={currentUserId}
                onDeleted={handleDeleted}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/** Utility: parse assetUrl which may be a JSON array or a plain URL string */
export function parseAssetUrls(assetUrl) {
  if (!assetUrl) return []
  try {
    const parsed = JSON.parse(assetUrl)
    if (Array.isArray(parsed)) return parsed.filter(Boolean)
  } catch { /* plain URL */ }
  return [assetUrl]
}
