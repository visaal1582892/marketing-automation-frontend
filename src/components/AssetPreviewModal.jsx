import { useEffect, useState } from 'react'
import Icon from './Icon'
import collaborationApi from '../api/collaboration'

/**
 * Modal that shows all submitted assets for a work task.
 * Loads assets from the asset_info table via the collaboration API.
 * Handles images (compact thumbnail + expand), videos (inline player),
 * and any other file type (icon + open/download links).
 *
 * Props:
 *   taskId   — work task ID (loads assets from API)
 *   urls     — legacy: pass a plain array of URLs to skip the API call
 *   taskName — display label
 *   onClose  — close handler
 */
export default function AssetPreviewModal({ taskId, urls: urlsProp, taskName, onClose }) {
  const [urls,    setUrls]    = useState(urlsProp || [])
  const [loading, setLoading] = useState(!!taskId && !urlsProp?.length)

  useEffect(() => {
    if (!taskId) return
    setLoading(true)
    collaborationApi.getAssets(taskId)
      .then(res => setUrls((res.data || []).map(a => a.url)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [taskId])

  if (!loading && !urls.length) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[88vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Submitted Assets</h3>
            {taskName && <p className="text-xs text-slate-500 mt-0.5">{taskName}</p>}
          </div>
          <div className="flex items-center gap-2">
            {!loading && (
              <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2.5 py-0.5">
                {urls.length} file{urls.length !== 1 ? 's' : ''}
              </span>
            )}
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable list */}
        <div className="overflow-y-auto p-4 space-y-3">
          {loading ? (
            <p className="text-center text-slate-400 text-sm py-8">Loading assets…</p>
          ) : urls.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">No assets uploaded yet.</p>
          ) : (
            urls.map((url, i) => (
              <AssetCard key={i} url={url} index={i} total={urls.length} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

async function triggerDownload(url, fileName) {
  try {
    const res  = await fetch(url, { mode: 'cors' })
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href     = blobUrl
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  } catch {
    // CORS blocked or fetch failed — fall back to opening in new tab
    window.open(url, '_blank')
  }
}

function AssetCard({ url, index, total }) {
  const [expanded, setExpanded] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const type     = detectType(url)
  const fileName = friendlyAssetName(url, index, total)

  const handleDownload = async () => {
    setDownloading(true)
    await triggerDownload(url, rawFileName(url, index))
    setDownloading(false)
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
      {/* Action bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50">
        <span className="text-xs font-semibold text-slate-600 truncate max-w-[160px]">{fileName}</span>
        <div className="flex items-center gap-1 shrink-0">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-200 transition"
            title="Open in new tab"
          >
            <Icon name="eye" className="h-3 w-3" />
            Open
          </a>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 disabled:opacity-60 transition"
            title="Download file"
          >
            {downloading ? (
              <span className="h-3 w-3 animate-spin rounded-full border border-brand-400 border-t-transparent" />
            ) : (
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M8 12l4 4 4-4M12 4v12" />
              </svg>
            )}
            {downloading ? 'Saving…' : 'Download'}
          </button>
        </div>
      </div>

      {/* Preview area */}
      <div className="bg-slate-100 flex items-center justify-center">
        {type === 'image' ? (
          <div className="w-full">
            <img
              src={url}
              alt={fileName}
              loading="lazy"
              className={[
                'mx-auto block object-contain cursor-zoom-in transition-all duration-200',
                expanded ? 'max-h-[60vh] w-full' : 'max-h-48 max-w-full',
              ].join(' ')}
              onClick={() => setExpanded(v => !v)}
              title={expanded ? 'Click to collapse' : 'Click to expand'}
            />
            <p className="text-center text-[10px] text-slate-400 py-1 select-none">
              {expanded ? 'Click image to collapse' : 'Click image to expand'}
            </p>
          </div>
        ) : type === 'video' ? (
          <video src={url} controls className="w-full max-h-56 block" />
        ) : type === 'pdf' ? (
          <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
            <svg className="h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <span className="text-xs font-medium text-slate-500">Use Open or Download to access this PDF</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
            <Icon name="fileText" className="h-12 w-12 text-slate-300" />
            <span className="text-xs font-medium text-slate-500">Use Open or Download to access this file</span>
          </div>
        )}
      </div>
    </div>
  )
}

function friendlyAssetName(url, index, total) {
  const ext = (url || '').split('?')[0].toLowerCase().split('.').pop()
  const TYPE = {
    jpg: 'Image', jpeg: 'Image', png: 'Image', gif: 'Image', webp: 'Image', svg: 'Graphic',
    mp4: 'Video', mov: 'Video', avi: 'Video', webm: 'Video', wmv: 'Video',
    pdf: 'PDF', doc: 'Document', docx: 'Document',
    xls: 'Spreadsheet', xlsx: 'Spreadsheet',
  }
  const typeName = TYPE[ext] || 'Asset'
  return total > 1 ? `${typeName} ${index + 1}` : typeName
}

/** Returns the raw filename portion of a URL for use as a download name. */
function rawFileName(url, index) {
  try {
    const path = new URL(url).pathname
    const name = path.substring(path.lastIndexOf('/') + 1).split('?')[0]
    return name || `asset-${index + 1}`
  } catch {
    return `asset-${index + 1}`
  }
}

function detectType(url) {
  const clean = url.split('?')[0].toLowerCase()
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff?)$/.test(clean)) return 'image'
  if (/\.(mp4|mov|avi|webm|wmv|mpg|mpeg|mkv)$/.test(clean)) return 'video'
  if (/\.pdf$/.test(clean)) return 'pdf'
  // Fallback: try to guess from URL path keywords
  if (clean.includes('/image') || clean.includes('/img')) return 'image'
  return 'file'
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
