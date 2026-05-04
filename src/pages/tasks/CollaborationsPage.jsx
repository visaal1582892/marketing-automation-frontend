import { useEffect, useRef, useState } from 'react'
import collaborationApi from '../../api/collaboration'
import tasksApi from '../../api/tasks'
import useTaskChat from '../../hooks/useTaskChat'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import RequestBriefDrawer from '../../components/RequestBriefDrawer'
import { useAuth } from '../../auth/AuthContext'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

function fmtDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })
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

  const isCompleted   = task.status === 'COMPLETED'
  const currentUserId = user?.userId

  const { messages, isConnected, typingUsers, sendTyping, setMessages } =
    useTaskChat(task.taskId, true, currentUserId)

  // Load history on mount
  useEffect(() => {
    collaborationApi.getMessages(task.taskId)
      .then(res => setMessages(res.data || []))
      .catch(() => {})
  }, [task.taskId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom whenever messages or typing users change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typingUsers])

  // Send + stop typing on submit
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

  // Debounced typing indicator
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
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-white/70 hover:text-white hover:bg-white/20 transition"
              >
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
                  /* ── Own message — RIGHT ── */
                  <div className="flex justify-end">
                    <div className="max-w-[72%]">
                      <div className="rounded-2xl rounded-br-sm bg-brand-600 px-4 py-2.5 shadow-sm">
                        <p className="text-sm text-white whitespace-pre-wrap break-words leading-relaxed">{msg.message}</p>
                      </div>
                      <p className="text-right text-[10px] text-slate-400 mt-1 pr-1">{fmtTime(msg.createdAt)}</p>
                    </div>
                  </div>
                ) : (
                  /* ── Received message — LEFT ── */
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

          {/* ── Typing indicator ── */}
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

        {/* ── Completed banner ───────────────────────────────────────────────── */}
        {isCompleted && (
          <div className="shrink-0 px-4 py-2.5 bg-emerald-50 border-t border-emerald-100 flex items-center justify-center gap-1.5">
            <Icon name="check" className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-xs text-emerald-700 font-medium">Task completed — chat is read-only.</span>
          </div>
        )}

        {/* ── Input ──────────────────────────────────────────────────────────── */}
        {!isCompleted && (
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
  const [assets,    setAssets]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    collaborationApi.getAssets(task.taskId)
      .then(res => setAssets(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [task.taskId])

  const uploadFile = async (file) => {
    setUploading(true)
    const fd = new FormData()
    fd.append('files', file)
    try {
      const res = await tasksApi.uploadAssets(fd)
      const url = res.data?.urls?.[0]
      if (url) {
        await collaborationApi.addAsset(task.taskId, url)
        const refresh = await collaborationApi.getAssets(task.taskId)
        setAssets(refresh.data || [])
        toast.success?.('Asset uploaded.')
      }
    } catch (e) {
      toast.error?.(e?.response?.data?.message || 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const isImage = (url) => /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url)
  const isVideo = (url) => /\.(mp4|mov|webm|avi)(\?|$)/i.test(url)
  const fileName = (url) => { try { return decodeURIComponent(url.split('/').pop().split('?')[0]) } catch { return 'File' } }

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
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
        />

        <div className="overflow-y-auto p-4 space-y-2">
          {loading ? (
            <p className="text-center text-slate-400 text-sm py-8">Loading…</p>
          ) : assets.length === 0 ? (
            <div className="text-center py-10">
              <Icon name="upload" className="mx-auto h-8 w-8 text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">No assets yet. Upload one above.</p>
            </div>
          ) : assets.map((a, i) => (
            <div key={a.assetId ?? i} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
              {isImage(a.url) ? (
                <img src={a.url} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0 border border-slate-200" />
              ) : isVideo(a.url) ? (
                <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                  <Icon name="play" className="h-5 w-5 text-purple-500" />
                </div>
              ) : (
                <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <Icon name="fileText" className="h-5 w-5 text-slate-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">{fileName(a.url)}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">by {a.userName} · {fmtDate(a.createdAt)}</p>
              </div>
              <a href={a.url} target="_blank" rel="noopener noreferrer"
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-100 transition shrink-0">
                Open
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CollaborationsPage() {
  const toast = useToast()
  const [tasks,   setTasks]   = useState([])
  const [loading, setLoading] = useState(true)

  const [chatTask,   setChatTask]   = useState(null)
  const [assetTask,  setAssetTask]  = useState(null)
  const [briefTask,  setBriefTask]  = useState(null)

  useEffect(() => {
    collaborationApi.getMyCollaborations()
      .then(res => setTasks(res.data || []))
      .catch(() => toast.error?.('Failed to load collaborations.'))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-4xl pb-10">
      {/* Page header */}
      <div className="mb-6 rounded-2xl bg-brand-600 px-6 py-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="users" className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Collaborations</h2>
            <p className="text-xs text-brand-100 mt-0.5">Tasks you own with collaborators, or tasks you've been invited to join.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-slate-400 py-14 text-sm">Loading…</p>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-brand-50 flex items-center justify-center mb-4">
            <Icon name="users" className="h-7 w-7 text-brand-400" />
          </div>
          <p className="text-sm font-medium text-slate-700">No collaborations yet</p>
          <p className="text-xs text-slate-400 mt-1">Use the Collaborate button on a task to invite teammates.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(t => (
            <CollabTaskCard
              key={t.taskId}
              task={t}
              isOwner={t.myRole === 'OWNER'}
              onChat={() => setChatTask(t)}
              onAssets={() => setAssetTask(t)}
              onBrief={() => setBriefTask(t)}
            />
          ))}
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

// ─── Collaboration Task Card ──────────────────────────────────────────────────

function CollabTaskCard({ task, isOwner, onChat, onAssets, onBrief }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
      {/* Coloured left accent */}
      <div className={`flex ${isOwner ? 'border-l-4 border-brand-600' : 'border-l-4 border-brand-200'}`}>
        <div className="flex-1 flex flex-wrap items-start justify-between gap-3 p-4">

          {/* Task info */}
          <div className="flex-1 min-w-[240px]">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-brand-600">
                {task.taskId}
              </span>
              <span className="text-sm font-semibold text-slate-800">
                {task.granularTaskName || task.requirementTypeName || 'Task'}
              </span>
              <StatusBadge status={task.status} />
              {isOwner ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                  <Icon name="star" className="h-2.5 w-2.5" />
                  Owner
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-600 ring-1 ring-brand-200">
                  <Icon name="users" className="h-2.5 w-2.5" />
                  Collaborator
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
              <span>Campaign {task.campaignId} · {task.requirementTypeName || '—'}</span>
              {task.assigneeName && <span>· Worker: <span className="font-medium text-slate-600">{task.assigneeName}</span></span>}
              {task.requestorName && <span>· Requested by <span className="font-medium text-slate-600">{task.requestorName}</span></span>}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onChat}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 active:scale-95 transition shadow-sm"
            >
              <Icon name="messageSquare" className="h-3.5 w-3.5" />
              Chat
            </button>
            <button
              onClick={onAssets}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition"
            >
              <Icon name="upload" className="h-3.5 w-3.5" />
              Assets
            </button>
            <button
              onClick={onBrief}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition"
            >
              <Icon name="eye" className="h-3.5 w-3.5" />
              Brief
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
