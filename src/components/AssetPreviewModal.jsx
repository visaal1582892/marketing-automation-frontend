import Icon from './Icon'

/**
 * Modal that shows all submitted assets for a work task.
 * Handles images (inline preview), videos (inline player),
 * and any other file type (icon + open-in-new-tab link).
 */
export default function AssetPreviewModal({ urls = [], taskName, onClose }) {
  if (!urls.length) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Submitted Assets</h3>
            {taskName && <p className="text-xs text-slate-500 mt-0.5">{taskName}</p>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2.5 py-0.5">
              {urls.length} file{urls.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Single-column scrollable list — no height caps so images render fully */}
        <div className="overflow-y-auto p-5 space-y-4">
          {urls.map((url, i) => (
            <AssetCard key={i} url={url} index={i} total={urls.length} />
          ))}
        </div>
      </div>
    </div>
  )
}

function AssetCard({ url, index, total }) {
  const type = detectType(url)
  const fileName = friendlyAssetName(url, index, total)

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
      {/* Label bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-white">
        <span className="text-xs font-semibold text-slate-600">{fileName}</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 shrink-0"
        >
          <Icon name="eye" className="h-3.5 w-3.5" />
          Open full size
        </a>
      </div>

      {/* Preview — no height cap, image renders at its natural width-constrained height */}
      <div className="bg-slate-100">
        {type === 'image' ? (
          <img
            src={url}
            alt={fileName}
            className="w-full h-auto block"
            loading="lazy"
          />
        ) : type === 'video' ? (
          <video
            src={url}
            controls
            className="w-full h-auto block"
          />
        ) : type === 'pdf' ? (
          <div className="flex flex-col items-center gap-3 py-12 text-slate-400">
            <svg className="h-14 w-14 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <span className="text-sm font-medium text-slate-500">PDF — click "Open full size" to view</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12 text-slate-400">
            <Icon name="fileText" className="h-14 w-14 text-slate-300" />
            <span className="text-sm font-medium text-slate-500">Click "Open full size" to view this file</span>
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
