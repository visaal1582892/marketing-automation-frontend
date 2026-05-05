import { useEffect, useMemo, useRef, useState } from 'react'
import collaborationApi from '../../api/collaboration'
import tasksApi from '../../api/tasks'
import useTaskChat from '../../hooks/useTaskChat'
import useUnreadWatcher from '../../hooks/useUnreadWatcher'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import RequestBriefDrawer from '../../components/RequestBriefDrawer'
import { useAuth } from '../../auth/AuthContext'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
  } catch { return '' }
}

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

const STATUS_STYLES = {
  ASSIGNED:    'bg-blue-50 text-blue-700 ring-blue-200',
  IN_PROGRESS: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  REWORK:      'bg-amber-50 text-amber-700 ring-amber-200',
  QC_REVIEW:   'bg-purple-50 text-purple-700 ring-purple-200',
  COMPLETED:   'bg-green-50 text-green-700 ring-green-200',
  CANCELLED:   'bg-rose-50 text-rose-700 ring-rose-200',
  HELD:        'bg-amber-50 text-amber-700 ring-amber-200',
}
const STATUS_LABELS = {
  ASSIGNED: 'New', IN_PROGRESS: 'In Progress', REWORK: 'Rework',
  QC_REVIEW: 'In QC', COMPLETED: 'Completed', CANCELLED: 'Cancelled', HELD: 'On Hold',
}

function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${cls}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────

// Chat is open only while the task is held for collaboration.
// Once the worker resumes (IN_PROGRESS / REWORK), chat is paused.
const CHAT_OPEN_STATUSES = ['HELD']

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-0.5">
      {[0, 200, 400].map((delay) => (
        <span
          key={delay}
          className="typing-dot inline-block h-2.5 w-2.5 rounded-full bg-brand-400"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  )
}

function ChatPanel({ task, onClose }) {
  const toast                 = useToast()
  const { user }              = useAuth()
  const [text, setText]       = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef   = useRef(null)
  const typingTimer = useRef(null)

  const isChatOpen  = CHAT_OPEN_STATUSES.includes(task.status)
  const isCompleted = task.status === 'COMPLETED'
  const blockReason = {
    IN_PROGRESS:       'Worker has resumed the task — collaboration chat is paused. Assets can still be shared.',
    REWORK:            'Task is in rework — collaboration chat is paused. Assets can still be shared.',
    ASSIGNED:          'Task is in queue — collaboration chat is paused. Assets can still be shared.',
    QC_REVIEW:         'Task is in QC review — chat is paused.',
    CANCELLED:         'Task has been cancelled.',
    REQUESTOR_REWORK:  'Task needs requestor rework — chat is paused.',
  }[task.status]

  const currentUserId = user?.id

  const { messages, isConnected, typingUsers, sendTyping, setMessages } =
    useTaskChat(task.taskId, true, currentUserId)

  useEffect(() => {
    collaborationApi.getMessages(task.taskId)
      .then(res => setMessages(res.data || []))
      .catch(() => {})
  }, [task.taskId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typingUsers])

  const send = async () => {
    if (!text.trim() || sending) return
    clearTimeout(typingTimer.current)
    sendTyping(false)
    setSending(true)
    try {
      await collaborationApi.sendMessage(task.taskId, text.trim())
      setText('')
    } catch (e) {
      toast.error?.(e?.response?.data?.message || 'Failed to send message.')
    } finally {
      setSending(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const handleTextChange = (e) => {
    setText(e.target.value)
    sendTyping(true)
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => sendTyping(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden" style={{ height: 'min(600px, 90vh)' }}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="shrink-0 bg-brand-600 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Icon name="messageSquare" className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white leading-tight truncate max-w-[260px]">
                  {task.granularTaskName || task.taskId}
                </h3>
                <p className="text-[11px] text-brand-100 mt-px">Campaign {task.campaignId}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-accent-400' : 'bg-white/40'}`} />
                <span className="text-[10px] text-brand-100">{isConnected ? 'Live' : 'Connecting…'}</span>
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-white/70 hover:text-white hover:bg-white/20 transition">
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Messages ───────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
          {messages.length === 0 && typingUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-300">
              <Icon name="messageSquare" className="h-10 w-10" />
              <p className="text-xs">No messages yet. Say hello!</p>
            </div>
          ) : messages.map((msg, i) => {
            const isOwn    = msg.userId != null && currentUserId != null && Number(msg.userId) === Number(currentUserId)
            const prevMsg  = messages[i - 1]
            const showDate = !prevMsg || fmtDate(prevMsg.createdAt) !== fmtDate(msg.createdAt)
            const initial  = (msg.userName || '?')[0].toUpperCase()

            return (
              <div key={msg.messageId ?? i}>
                {showDate && (
                  <div className="flex items-center gap-2 my-3">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-[10px] text-slate-400 px-2 font-medium">{fmtDate(msg.createdAt)}</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                )}

                {isOwn ? (
                  <div className="flex justify-end">
                    <div className="max-w-[72%]">
                      <div className="rounded-2xl rounded-br-sm bg-brand-600 px-4 py-2.5 shadow-sm">
                        <p className="text-sm text-white whitespace-pre-wrap break-words leading-relaxed">{msg.message}</p>
                      </div>
                      <p className="text-right text-[10px] text-slate-400 mt-1 pr-1">{fmtTime(msg.createdAt)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <div className="h-7 w-7 rounded-full bg-brand-100 flex items-center justify-center text-[10px] font-bold text-brand-700 shrink-0 mb-4">
                      {initial}
                    </div>
                    <div className="max-w-[72%]">
                      <p className="text-[10px] font-semibold text-slate-500 mb-1 ml-1">{msg.userName}</p>
                      <div className="rounded-2xl rounded-bl-sm bg-white px-4 py-2.5 shadow-sm border border-slate-100">
                        <p className="text-sm text-slate-800 whitespace-pre-wrap break-words leading-relaxed">{msg.message}</p>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 ml-1">{fmtTime(msg.createdAt)}</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {typingUsers.length > 0 && (
            <div className="flex items-end gap-2">
              <div className="h-7 w-7 rounded-full bg-brand-100 flex items-center justify-center text-[10px] font-bold text-brand-700 shrink-0">
                {(typingUsers[0].userName || '?')[0].toUpperCase()}
              </div>
              <div className="rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-sm border border-slate-100">
                <TypingDots />
              </div>
              <span className="text-[10px] text-slate-400 self-end mb-1">
                {typingUsers.map(u => (u.userName || '').split(' ')[0]).join(', ')} typing…
              </span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Status banners ─────────────────────────────────────────────────── */}
        {blockReason && (
          <div className="shrink-0 px-4 py-2.5 bg-brand-50 border-t border-brand-100 flex items-center justify-center gap-1.5">
            <Icon name="lock" className="h-3.5 w-3.5 text-brand-600" />
            <span className="text-xs text-brand-700 font-medium">{blockReason}</span>
          </div>
        )}
        {isCompleted && (
          <div className="shrink-0 px-4 py-2.5 bg-emerald-50 border-t border-emerald-100 flex items-center justify-center gap-1.5">
            <Icon name="check" className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-xs text-emerald-700 font-medium">Task completed — chat is read-only.</span>
          </div>
        )}

        {/* ── Input ──────────────────────────────────────────────────────────── */}
        {isChatOpen && (
          <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3 flex items-end gap-2">
            <textarea
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKey}
              placeholder="Type a message… (Enter to send)"
              rows={2}
              className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 focus:bg-white transition"
            />
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              className="rounded-xl bg-brand-600 p-2.5 text-white hover:bg-brand-700 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-sm"
            >
              <Icon name="send" className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Asset Panel ──────────────────────────────────────────────────────────────

function AssetPanel({ task, onClose }) {
  const toast = useToast()
  const { user } = useAuth()
  const [assets,      setAssets]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [uploading,   setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef(null)

  const currentUserId = user?.id

  useEffect(() => {
    collaborationApi.getAssets(task.taskId)
      .then(res => setAssets(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [task.taskId])

  const showError = (msg) => {
    setUploadError(msg)
    setTimeout(() => setUploadError(''), 5000)
  }

  const uploadFile = async (file) => {
    setUploadError('')
    if (/\.(docx?)$/i.test(file.name)) {
      showError('DOC and DOCX files are not allowed. Please convert to PDF or an image and try again.')
      return
    }
    setUploading(true)
    const fd = new FormData()
    fd.append('files', file)
    try {
      const res = await tasksApi.uploadAssets(fd)
      const url              = res.data?.urls?.[0]
      const thumbnailUrl     = res.data?.thumbnailUrls?.[0] || null
      const originalFilename = res.data?.originalFilenames?.[0] || file.name
      if (url) {
        await collaborationApi.addAsset(task.taskId, url, thumbnailUrl, originalFilename)
        const refresh = await collaborationApi.getAssets(task.taskId)
        setAssets(refresh.data || [])
        toast.success?.('Asset uploaded.')
      }
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Upload failed.'
      showError(msg.toLowerCase().includes('unsupported') || msg.toLowerCase().includes('format')
        ? 'File format not supported. DOC/DOCX files are not accepted — please convert to PDF or an image.'
        : msg)
    } finally {
      setUploading(false)
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

  const isImage    = (url) => url && /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url)
  const isVideo    = (url) => url && /\.(mp4|mov|webm|avi)(\?|$)/i.test(url)
  const displayName = (a)  => a.originalFilename || (
    (() => { try { return decodeURIComponent(a.url.split('/').pop().split('?')[0]) } catch { return 'File' } })()
  )

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Assets</h3>
            <p className="text-xs text-slate-500 mt-0.5">{task.granularTaskName || task.taskId}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition disabled:opacity-50"
            >
              <Icon name="upload" className="h-3.5 w-3.5" />
              {uploading ? 'Uploading…' : 'Add Asset'}
            </button>
            <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          className="sr-only"
          onChange={e => { if (e.target.files?.[0]) uploadFile(e.target.files[0]); e.target.value = '' }}
          accept="image/*,video/*,.pdf,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.doc,.docx"
        />

        {uploadError && (
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-xs text-red-700">
            <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span>{uploadError}</span>
          </div>
        )}

        <div className="overflow-y-auto p-4 space-y-2">
          {loading ? (
            <p className="text-center text-slate-400 text-sm py-8">Loading…</p>
          ) : assets.length === 0 ? (
            <div className="text-center py-10">
              <Icon name="upload" className="mx-auto h-8 w-8 text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">No assets yet. Upload one above.</p>
            </div>
          ) : assets.map((a, i) => (
            <div key={a.assetId ?? i} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
              {/* Preview — prefer thumbnail when available, fall back to full URL for images */}
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

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">{displayName(a)}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">by {a.userName} · {fmtDate(a.createdAt)}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <a
                    href={a.url}
                    download={displayName(a)}
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-brand-600 hover:text-brand-800 transition"
                  >
                    <Icon name="download" className="h-3 w-3" />
                    Download
                  </a>
                  <span className="text-slate-200">|</span>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-700 transition"
                  >
                    <Icon name="externalLink" className="h-3 w-3" />
                    Open
                  </a>
                </div>
              </div>

              {/* Delete (own assets only) */}
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
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Role Config ──────────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  OWNER:        { border: 'border-brand-600',  badge: 'bg-brand-600 text-white',                         icon: 'star',      label: 'Owner' },
  REQUESTOR:    { border: 'border-accent-400', badge: 'bg-accent-50 text-accent-700 ring-1 ring-accent-200', icon: 'briefcase', label: 'Requestor' },
  COLLABORATOR: { border: 'border-brand-200',  badge: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200',    icon: 'users',     label: 'Collaborator' },
  ADMIN:        { border: 'border-slate-500',  badge: 'bg-slate-800 text-white',                         icon: 'shield',    label: 'Admin' },
  MANAGER:      { border: 'border-purple-400', badge: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200', icon: 'briefcase', label: 'Manager' },
}
const rc = (role) => ROLE_CONFIG[role] || ROLE_CONFIG.COLLABORATOR

// ─── Add People Modal ─────────────────────────────────────────────────────────

function AddPeopleModal({ task, onClose, onDone }) {
  const toast    = useToast()
  const [allUsers,  setAllUsers]  = useState([])
  const [existing,  setExisting]  = useState([])
  const [selected,  setSelected]  = useState([])
  const [search,    setSearch]    = useState('')
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    Promise.all([
      collaborationApi.getAllUsers(),
      collaborationApi.getMembers(task.taskId).catch(() => ({ data: [] })),
    ]).then(([u, m]) => {
      setAllUsers(u.data || [])
      setExisting((m.data || []).map(x => x.userId))
    }).finally(() => setLoading(false))
  }, [task.taskId])

  const filtered = (allUsers || []).filter(u =>
    !existing.includes(u.userId) &&
    (u.fullName || '').toLowerCase().includes(search.toLowerCase())
  )
  const toggle = (uid) => setSelected(p => p.includes(uid) ? p.filter(x => x !== uid) : [...p, uid])

  const submit = async () => {
    if (!selected.length) return
    setSaving(true)
    try {
      await collaborationApi.invite(task.taskId, selected)
      toast.success?.(`${selected.length} collaborator${selected.length > 1 ? 's' : ''} added.`)
      onDone()
    } catch (e) {
      toast.error?.(e?.response?.data?.message || 'Failed to add collaborators.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Add People</h3>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[220px]">{task.granularTaskName || task.taskId}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 pt-3 pb-1">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users…"
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-200" />
        </div>
        <div className="overflow-y-auto max-h-56 px-4 py-2 space-y-1">
          {loading ? <p className="text-center text-slate-400 text-xs py-6">Loading…</p>
          : filtered.length === 0 ? <p className="text-center text-slate-400 text-xs py-4">No more users to add.</p>
          : filtered.map(u => {
            const sel = selected.includes(u.userId)
            return (
              <button key={u.userId} onClick={() => toggle(u.userId)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition ${sel ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-slate-50'}`}>
                <div className="h-7 w-7 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-700 shrink-0">
                  {(u.fullName || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800 truncate">{u.fullName}</p>
                  <p className="text-[10px] text-slate-400 truncate">{u.designationName || u.email}</p>
                </div>
                {sel && <Icon name="check" className="h-3.5 w-3.5 text-brand-600 shrink-0" />}
              </button>
            )
          })}
        </div>
        <div className="px-4 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 transition">Cancel</button>
          <button onClick={submit} disabled={!selected.length || saving}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition disabled:opacity-50">
            {saving ? 'Adding…' : `Add ${selected.length || ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Collaboration Card ────────────────────────────────────────────────────────

function CollabCard({ task, onChat, onAssets, onBrief, onRefresh, unreadCount = 0 }) {
  const toast     = useToast()
  const role      = task.myRole || 'COLLABORATOR'
  const cfg       = rc(role)
  const canManage = ['OWNER', 'ADMIN', 'MANAGER'].includes(role)
  const canResume = (role === 'OWNER' || role === 'ADMIN') && task.status === 'HELD'

  const [showAddPeople, setShowAddPeople] = useState(false)
  const [resuming,      setResuming]      = useState(false)

  const handleResume = async () => {
    setResuming(true)
    try {
      await collaborationApi.pauseCollaboration(task.taskId)
      toast.success?.('Task resumed — collaboration chat is now paused.')
      onRefresh()
    } catch (e) {
      toast.error?.(e?.response?.data?.message || 'Could not resume task.')
    } finally {
      setResuming(false)
    }
  }

  return (
    <>
      <div className={`relative rounded-2xl border-l-4 ${cfg.border} bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden`}>
        {/* Top strip */}
        <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-slate-100">
          <div className="flex-1 min-w-0 pr-3">
            <p className="text-sm font-bold text-slate-900 leading-tight truncate">
              {task.granularTaskName || task.requirementTypeName || 'Task'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">{task.requirementTypeName || ''} · Campaign #{task.campaignId}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {unreadCount > 0 && (
              <span className="animate-pulse inline-flex items-center rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                {unreadCount} new
              </span>
            )}
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.badge}`}>
              <Icon name={cfg.icon} className="h-2.5 w-2.5" />
              {cfg.label}
            </span>
            <StatusBadge status={task.status} />
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-x-5 gap-y-1 px-4 py-2.5 text-[11px] text-slate-500">
          {task.assigneeName && (
            <span className="flex items-center gap-1">
              <Icon name="user" className="h-3 w-3 text-slate-300" />
              <span className="font-medium text-slate-700">{task.assigneeName}</span>
              <span className="text-slate-400">assignee</span>
            </span>
          )}
          {task.requestorName && (
            <span className="flex items-center gap-1">
              <Icon name="briefcase" className="h-3 w-3 text-slate-300" />
              <span className="font-medium text-slate-700">{task.requestorName}</span>
              <span className="text-slate-400">requestor</span>
            </span>
          )}
          <span className="font-mono text-slate-300">{task.taskId}</span>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-slate-50 border-t border-slate-100">
          {/* Primary: Chat */}
          <button onClick={onChat}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 active:scale-95 transition shadow-sm">
            <Icon name="messageSquare" className="h-3.5 w-3.5" />
            Chat
          </button>

          {/* Assets */}
          <button onClick={onAssets}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition">
            <Icon name="upload" className="h-3.5 w-3.5" />
            Assets
          </button>

          {/* Brief */}
          <button onClick={onBrief}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition">
            <Icon name="eye" className="h-3.5 w-3.5" />
            Brief
          </button>

          {/* Add People — owner/admin/manager only */}
          {canManage && (
            <button onClick={() => setShowAddPeople(true)}
              className="flex items-center gap-1.5 rounded-lg border border-accent-200 bg-accent-50 px-3 py-1.5 text-xs font-medium text-accent-700 hover:bg-accent-100 transition">
              <Icon name="userPlus" className="h-3.5 w-3.5" />
              Add People
            </button>
          )}

          {/* Resume Task — owner/admin, only when HELD */}
          {canResume && (
            <button onClick={handleResume} disabled={resuming}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-accent-300 bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-600 transition disabled:opacity-50">
              <Icon name="play" className="h-3.5 w-3.5" />
              {resuming ? 'Resuming…' : 'Resume Task'}
            </button>
          )}

        </div>
      </div>

      {showAddPeople && (
        <AddPeopleModal
          task={task}
          onClose={() => setShowAddPeople(false)}
          onDone={() => setShowAddPeople(false)}
        />
      )}
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────


// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CollaborationsPage() {
  const { user }  = useAuth()
  const toast     = useToast()
  const [tasks,   setTasks]   = useState([])
  const [loading, setLoading] = useState(true)

  const [chatTask,   setChatTask]   = useState(null)
  const [assetTask,  setAssetTask]  = useState(null)
  const [briefTask,  setBriefTask]  = useState(null)

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [search,       setSearch]       = useState('')
  const [filterUnread, setFilterUnread] = useState(false)

  const load = () => {
    setLoading(true)
    collaborationApi.getMyCollaborations()
      .then(res => setTasks(res.data || []))
      .catch(() => toast.error?.('Failed to load collaborations.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Unread watcher ────────────────────────────────────────────────────────────
  const taskIds = useMemo(() => tasks.map(t => t.taskId), [tasks])
  const { unreadCounts, clearUnread } = useUnreadWatcher(
    taskIds,
    user?.id,
    chatTask?.taskId ?? null,
  )

  const openChat = (t) => {
    setChatTask(t)
    clearUnread(t.taskId)
  }

  // ── Derived filtered list ─────────────────────────────────────────────────────
  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tasks.filter(t => {
      if (filterUnread && !(unreadCounts[t.taskId] > 0)) return false
      if (q) {
        const hay = [
          t.taskId, t.granularTaskName, t.requirementTypeName,
          t.campaignId, t.assigneeName, t.requestorName,
        ].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [tasks, filterUnread, search, unreadCounts])

  const owned  = filteredTasks.filter(t => t.myRole === 'OWNER')
  const others = filteredTasks.filter(t => t.myRole !== 'OWNER')

  const totalUnread = Object.values(unreadCounts).reduce((s, n) => s + n, 0)

  const RoleSection = ({ title, subtitle, items, icon }) => (
    items.length > 0 && (
      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Icon name={icon} className="h-4 w-4 text-slate-400" />
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{title}</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{items.length}</span>
          {subtitle && <p className="text-[10px] text-slate-400 ml-1">{subtitle}</p>}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map(t => (
            <CollabCard
              key={t.taskId}
              task={t}
              onChat={() => openChat(t)}
              onAssets={() => setAssetTask(t)}
              onBrief={() => setBriefTask(t)}
              onRefresh={load}
              unreadCount={unreadCounts[t.taskId] || 0}
            />
          ))}
        </div>
      </section>
    )
  )

  return (
    <div className="mx-auto max-w-7xl pb-10 space-y-6">
      {/* Page header */}
      <div className="rounded-2xl bg-brand-600 px-6 py-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Icon name="users" className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Collaborations</h2>
              <p className="text-xs text-brand-100 mt-0.5">Chat, share assets and coordinate with your team in real time.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {totalUnread > 0 && (
              <span className="animate-pulse rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-brand-700 shadow">
                {totalUnread} unread
              </span>
            )}
            <button onClick={load} className="flex items-center gap-1.5 rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1.5 text-xs font-semibold text-white transition">
              <Icon name="refreshCw" className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-[180px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <Icon name="search" className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search task, campaign, person…"
            className="flex-1 bg-transparent text-xs text-slate-700 placeholder-slate-400 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
              <Icon name="x" className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Unread toggle */}
        <button
          onClick={() => setFilterUnread(v => !v)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition
            ${filterUnread
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
        >
          <Icon name="bell" className="h-3.5 w-3.5" />
          Unread only
          {totalUnread > 0 && !filterUnread && (
            <span className="rounded-full bg-brand-600 text-white px-1.5 py-0 text-[10px] font-bold">{totalUnread}</span>
          )}
        </button>

        {/* Clear filters */}
        {(search || filterUnread) && (
          <button
            onClick={() => { setSearch(''); setFilterUnread(false) }}
            className="text-xs text-brand-600 hover:underline font-medium"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-[11px] text-slate-400">{filteredTasks.length} of {tasks.length}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-brand-50 flex items-center justify-center mb-4">
            <Icon name="users" className="h-7 w-7 text-brand-400" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No collaborations yet</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Use the <strong>Collaborate</strong> button on any task to open a chat and coordinate with your team.</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-10 text-center">
          <Icon name="search" className="mx-auto h-8 w-8 text-slate-300 mb-3" />
          <p className="text-sm font-semibold text-slate-700">No results match your filters</p>
          <button onClick={() => { setSearch(''); setFilterUnread(false) }}
            className="mt-2 text-xs text-brand-600 hover:underline">Clear filters</button>
        </div>
      ) : (
        <div className="space-y-8">
          <RoleSection title="My Tasks" subtitle="Tasks assigned to you with active collaborators" icon="star" items={owned} />
          <RoleSection title="Joined Collaborations" subtitle="Tasks you were invited to or are involved in" icon="users" items={others} />
        </div>
      )}

      {chatTask  && <ChatPanel  task={chatTask}  onClose={() => setChatTask(null)}  />}
      {assetTask && <AssetPanel task={assetTask} onClose={() => setAssetTask(null)} />}
      {briefTask && (
        <RequestBriefDrawer
          campaignId={briefTask.campaignId}
          filterTaskId={briefTask.taskId}
          onClose={() => setBriefTask(null)}
        />
      )}
    </div>
  )
}
