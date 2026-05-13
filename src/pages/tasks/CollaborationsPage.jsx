import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import collaborationApi from '../../api/collaboration'
import AppSelect from '../../components/AppSelect'
import useTaskChat from '../../hooks/useTaskChat'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import RequestBriefDrawer from '../../components/RequestBriefDrawer'
import { useAuth } from '../../auth/AuthContext'
import Pagination from '../../components/Pagination'
import AssetPanel, { CHAT_OPEN_STATUSES, UploadRow, isImage, isVideo, displayName, openUrl, triggerDownload } from '../../components/AssetPanel'
import useDebounce from '../../hooks/useDebounce'

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
  ASSIGNED:    { badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',     stripe: 'bg-blue-400',    dot: 'bg-blue-400'    },
  IN_PROGRESS: { badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', stripe: 'bg-emerald-400', dot: 'bg-emerald-400' },
  REWORK:      { badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',  stripe: 'bg-amber-400',   dot: 'bg-amber-400'   },
  QC_REVIEW:   { badge: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200', stripe: 'bg-purple-400', dot: 'bg-purple-400'  },
  COMPLETED:   { badge: 'bg-green-50 text-green-700 ring-1 ring-green-200',  stripe: 'bg-green-500',   dot: 'bg-green-500'   },
  CANCELLED:   { badge: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',     stripe: 'bg-rose-400',    dot: 'bg-rose-400'    },
  HELD:        { badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',  stripe: 'bg-amber-400',   dot: 'bg-amber-400'   },
}
const STATUS_LABELS = {
  ASSIGNED: 'New', IN_PROGRESS: 'In Progress', REWORK: 'Rework',
  QC_REVIEW: 'In QC', COMPLETED: 'Completed', CANCELLED: 'Cancelled', HELD: 'On Hold',
}
const getStatus = (s) => STATUS_STYLES[s] || { badge: 'bg-slate-100 text-slate-600', stripe: 'bg-slate-300', dot: 'bg-slate-300' }

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatus(status).badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${getStatus(status).dot}`} />
      {STATUS_LABELS[status] || status}
    </span>
  )
}

// ─── Avatar helpers ────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-orange-100 text-orange-700',
  'bg-teal-100 text-teal-700',
]

function avatarCls(name) {
  if (!name) return AVATAR_PALETTE[0]
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function Avatar({ name, size = 'md' }) {
  const sz = size === 'sm' ? 'h-6 w-6 text-[9px]' : 'h-7 w-7 text-[10px]'
  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-bold shrink-0 ${avatarCls(name)}`}>
      {initials(name)}
    </div>
  )
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────

const CARD_BLOCKED_STATUSES = ['HELD', 'QC_REVIEW', 'CANCELLED', 'COMPLETED']

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
  const toast                   = useToast()
  const { user }                = useAuth()
  const [text, setText]         = useState('')
  const [sending, setSending]   = useState(false)
  const [members, setMembers]   = useState([])
  const bottomRefEl             = useRef(null)
  const typingTimer             = useRef(null)

  const isCardBlocked = CARD_BLOCKED_STATUSES.includes(task.status)
  const isNotStarted  = task.status === 'ASSIGNED'
  const isChatOpen    = CHAT_OPEN_STATUSES.includes(task.status) && task.collaborationActive && !isCardBlocked

  const cardBlockReason = {
    HELD:      'Task is on hold — chat and assets are paused.',
    QC_REVIEW: 'Task is in QC review — chat and assets are locked.',
    COMPLETED: 'Task completed — chat and assets are locked.',
    CANCELLED: 'Task has been cancelled.',
  }[task.status]

  const chatBlockReason = !task.collaborationActive && !isCardBlocked && !isNotStarted
    ? 'Chat paused by owner — assets can still be uploaded.'
    : null

  const currentUserId = user?.id

  const { messages, isConnected, typingUsers, sendTyping, setMessages } =
    useTaskChat(task.taskId, true, currentUserId)

  useEffect(() => {
    collaborationApi.getMessages(task.taskId)
      .then(res => setMessages(res.data || []))
      .catch(() => {})
  }, [task.taskId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    collaborationApi.getMembers(task.taskId)
      .then(res => setMembers(res.data || []))
      .catch(() => {})
  }, [task.taskId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRefEl.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typingUsers]) // eslint-disable-line react-hooks/exhaustive-deps

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

        {/* Header */}
        <div className="shrink-0 bg-brand-600 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
                <Icon name="messageSquare" className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white leading-tight truncate max-w-[240px]">
                  {task.granularTaskName || task.taskId}
                </h3>
                <p className="text-[10px] text-brand-200 mt-0.5">Campaign #{task.campaignId}</p>
                {members.length > 0 && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <Icon name="users" className="h-3 w-3 text-white/60 shrink-0" />
                    <p className="text-[10px] text-white/80 leading-tight line-clamp-1">
                      {members.map(m => (m.userName || m.fullName || '').split(' ')[0]).join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
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

        {/* Messages */}
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

          <div ref={bottomRefEl} />
        </div>

        {/* Status banners */}
        {cardBlockReason && (
          <div className="shrink-0 px-4 py-2.5 bg-brand-50 border-t border-brand-100 flex items-center justify-center gap-1.5">
            <Icon name="lock" className="h-3.5 w-3.5 text-brand-600" />
            <span className="text-xs text-brand-700 font-medium">{cardBlockReason}</span>
          </div>
        )}
        {isNotStarted && !cardBlockReason && (
          <div className="shrink-0 px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-1.5">
            <Icon name="lock" className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-xs text-slate-600 font-medium">Chat and assets unlock once the worker starts the task.</span>
          </div>
        )}
        {chatBlockReason && !cardBlockReason && !isNotStarted && (
          <div className="shrink-0 px-4 py-2.5 bg-amber-50 border-t border-amber-100 flex items-center justify-center gap-1.5">
            <Icon name="lock" className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-xs text-amber-700 font-medium">{chatBlockReason}</span>
          </div>
        )}

        {/* Input */}
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

// ─── Role Config ──────────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  OWNER:        { accent: 'brand',   badge: 'bg-brand-600 text-white',                              icon: 'star',      label: 'Owner'         },
  REQUESTOR:    { accent: 'accent',  badge: 'bg-accent-50 text-accent-700 ring-1 ring-accent-200',  icon: 'briefcase', label: 'Requestor'      },
  COLLABORATOR: { accent: 'brand',   badge: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200',     icon: 'users',     label: 'Collaborator'   },
  ADMIN:        { accent: 'slate',   badge: 'bg-slate-800 text-white',                              icon: 'shield',    label: 'Admin'          },
  MANAGER:      { accent: 'purple',  badge: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200', icon: 'briefcase', label: 'Manager'        },
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

function CollabCard({ task, onChat, onAssets, onBrief, onRefresh }) {
  const toast               = useToast()
  const role                = task.myRole || 'COLLABORATOR'
  const cfg                 = rc(role)
  const canManage           = ['OWNER', 'ADMIN', 'MANAGER'].includes(role)
  const isCardBlocked       = CARD_BLOCKED_STATUSES.includes(task.status)
  const isInteractionLocked = isCardBlocked || task.status === 'ASSIGNED' || !task.collaborationActive
  const canPauseChat        = ['OWNER', 'ADMIN'].includes(role) && !isCardBlocked && task.status !== 'ASSIGNED'
  const statusStyle         = getStatus(task.status)

  const [showAddPeople, setShowAddPeople] = useState(false)
  const [togglingChat,  setTogglingChat]  = useState(false)

  const handleToggleChat = async () => {
    setTogglingChat(true)
    try {
      await collaborationApi.pauseCollaboration(task.taskId)
      toast.success?.(task.collaborationActive ? 'Chat paused — assets still available.' : 'Chat resumed.')
      window.dispatchEvent(new CustomEvent('collab-active-changed'))
      onRefresh()
    } catch (e) {
      toast.error?.(e?.response?.data?.message || 'Could not toggle chat.')
    } finally {
      setTogglingChat(false)
    }
  }

  return (
    <>
      <div className="flex flex-col rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 overflow-hidden">

        {/* ── Status stripe (top) ── */}
        <div className={`h-[3px] w-full shrink-0 ${statusStyle.stripe}`} />

        {/* ── Card header: IDs + status + pause toggle ── */}
        <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-100 shrink-0">
              CMP&nbsp;{task.campaignId}
            </span>
            <span className="text-[10px] font-mono text-slate-400 shrink-0">·</span>
            <span className="text-[10px] font-mono text-slate-500 truncate">T-{task.taskId}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {canPauseChat && (
              <button
                title={!task.collaborationActive ? 'Resume chat' : 'Pause chat'}
                onClick={handleToggleChat}
                disabled={togglingChat}
                className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold transition disabled:opacity-50
                  ${!task.collaborationActive
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                    : 'border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
              >
                <Icon name={!task.collaborationActive ? 'play' : 'lock'} className="h-2.5 w-2.5" />
                {!task.collaborationActive ? 'Resume' : 'Pause'}
              </button>
            )}
            <StatusBadge status={task.status} />
          </div>
        </div>

        {/* ── Task name + type ── */}
        <div className="px-3 py-2.5">
          <p className="text-[13px] font-bold text-slate-900 leading-snug line-clamp-2">
            {task.granularTaskName || task.taskTypeName || 'Task'}
          </p>
          {task.taskTypeName && task.granularTaskName && (
            <span className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
              {task.taskTypeName}
            </span>
          )}
        </div>

        {/* ── People: side-by-side ── */}
        <div className="px-3 pb-2.5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2">
          {task.assigneeName && (
            <div className="flex items-center gap-1.5 min-w-0">
              <Avatar name={task.assigneeName} size="sm" />
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400 leading-none">Assignee</p>
                <p className="text-xs font-semibold text-slate-800 truncate leading-tight">{task.assigneeName}</p>
              </div>
            </div>
          )}
          {task.requestorName && (
            <div className="flex items-center gap-1.5 min-w-0">
              <Avatar name={task.requestorName} size="sm" />
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400 leading-none">Requestor</p>
                <p className="text-xs font-semibold text-slate-800 truncate leading-tight">{task.requestorName}</p>
              </div>
            </div>
          )}
        </div>

        {/* Chat-paused notice */}
        {!isCardBlocked && task.status !== 'ASSIGNED' && !task.collaborationActive && (
          <div className="mx-3 mb-2 flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5">
            <Icon name="lock" className="h-3 w-3 text-amber-500 shrink-0" />
            <span className="text-[10px] text-amber-700 font-medium">Chat paused — assets still accessible</span>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 space-y-1.5">
          {/* Action buttons — requestors cannot view assets until approved */}
          <div className={`grid gap-1 ${role === 'REQUESTOR' ? 'grid-cols-2' : 'grid-cols-3'}`}>
            <button
              title={isInteractionLocked ? 'Chat unavailable' : 'Open chat'}
              onClick={isInteractionLocked ? undefined : onChat}
              disabled={isInteractionLocked}
              className={`flex items-center justify-center gap-1 rounded-md py-1.5 text-[11px] font-bold transition
                ${isInteractionLocked
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-brand-600 text-white hover:bg-brand-700 active:scale-95'}`}
            >
              <Icon name="messageSquare" className="h-3 w-3" />
              Chat
            </button>

            {role !== 'REQUESTOR' && (
              <button
                title="Files & assets"
                onClick={onAssets}
                className="flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition active:scale-95"
              >
                <Icon name="upload" className="h-3 w-3" />
                Assets
              </button>
            )}

            <button
              title="View campaign brief"
              onClick={onBrief}
              className="flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition active:scale-95"
            >
              <Icon name="eye" className="h-3 w-3" />
              Brief
            </button>
          </div>

          {/* Add people */}
          {canManage && !isInteractionLocked && (
            <button
              onClick={() => setShowAddPeople(true)}
              className="w-full flex items-center justify-center gap-1 rounded-md border border-dashed border-slate-300 py-1 text-[10px] font-semibold text-slate-500 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition"
            >
              <Icon name="userPlus" className="h-3 w-3" />
              Add collaborators
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

const PAGE_SIZE = 12

export default function CollaborationsPage() {
  const toast          = useToast()
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()
  const taskIdFilter   = searchParams.get('taskId') // e.g. "WORK-TASK-42" from Collaborate button

  const [tasks,         setTasks]        = useState([])
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages,    setTotalPages]   = useState(0)
  const [loading,       setLoading]      = useState(true)
  const [page,          setPage]         = useState(0)

  const [chatTask,   setChatTask]   = useState(null)
  const [assetTask,  setAssetTask]  = useState(null)
  const [briefTask,  setBriefTask]  = useState(null)

  // ── Filter state — hidden when taskIdFilter is active ────────────────────────
  const [search,     setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState('all') // 'all' | 'mine' | 'involved'

  const dSearch = useDebounce(search, 350)

  // Reset page when filters change
  useEffect(() => { setPage(0) }, [dSearch, roleFilter, taskIdFilter])

  const fetchTasks = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    const params = {
      page, size: PAGE_SIZE,
      role: roleFilter,
      ...(dSearch && { search: dSearch }),
      ...(taskIdFilter && { taskId: taskIdFilter }),
    }
    collaborationApi.getMyCollaborations(params)
      .then(res => {
        const data = res.data
        setTasks(data.content || [])
        setTotalElements(data.totalElements ?? 0)
        setTotalPages(data.totalPages ?? 0)
      })
      .catch(() => { if (!silent) toast.error?.('Failed to load collaborations.') })
      .finally(() => { if (!silent) setLoading(false) })
  }, [page, dSearch, roleFilter, taskIdFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const load = () => fetchTasks()

  const clearTaskFilter = () => navigate('/collaborations')

  return (
    <div className="mx-auto max-w-7xl pb-10 space-y-5">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-3.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: title + counts */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
              <Icon name="users" className="h-4.5 w-4.5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">
                Collaborations
                {taskIdFilter && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-200">
                    <Icon name="filter" className="h-3 w-3" />
                    {taskIdFilter}
                  </span>
                )}
              </h1>
              {!loading && (
                <p className="text-xs text-slate-500">
                  {taskIdFilter
                    ? `Showing task ${taskIdFilter}`
                    : `${totalElements} active collaboration${totalElements !== 1 ? 's' : ''}`}
                </p>
              )}
            </div>
          </div>

          {/* Right: filters (hidden when viewing a specific task) + refresh */}
          <div className="flex items-center gap-2 flex-wrap">
            {taskIdFilter ? (
              <button
                onClick={clearTaskFilter}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 active:scale-95"
              >
                <Icon name="arrowLeft" className="h-3.5 w-3.5" />
                Back to all
              </button>
            ) : (
              <>
                {/* Role type select */}
                <select
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 cursor-pointer"
                >
                  <option value="all">All</option>
                  <option value="mine">Created by me</option>
                  <option value="involved">I'm involved</option>
                </select>

                {/* Search */}
                <div className="relative">
                  <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search…"
                    className="w-48 rounded-lg border border-slate-200 pl-8 pr-7 py-1.5 text-xs text-slate-700
                      placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 focus:w-64 transition-all"
                  />
                  {search && (
                    <button onClick={() => setSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                      <Icon name="x" className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Result count chip */}
                {!loading && (
                  <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500">
                    {totalElements}
                  </span>
                )}
              </>
            )}

            <button
              onClick={load}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 active:scale-95"
            >
              <Icon name="refreshCw" className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
          <p className="text-sm text-slate-400">Loading collaborations…</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-24 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50">
            <Icon name="users" className="h-8 w-8 text-brand-300" />
          </div>
          {(search || roleFilter !== 'all') ? (
            <>
              <p className="text-sm font-bold text-slate-700">No collaborations match your filters.</p>
              <button onClick={() => { setSearch(''); setRoleFilter('all') }}
                className="mt-3 inline-flex items-center gap-1 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-100 transition">
                <Icon name="x" className="h-3 w-3" /> Clear filters
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-slate-700">No collaborations yet</p>
              <p className="mt-1.5 max-w-xs mx-auto text-xs text-slate-400 leading-relaxed">
                Use the <strong className="text-slate-600">Collaborate</strong> button on any task to start
                coordinating with your team.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tasks.map(t => (
              <CollabCard
                key={t.taskId}
                task={t}
                onChat={() => setChatTask(t)}
                onAssets={() => setAssetTask(t)}
                onBrief={() => setBriefTask(t)}
                onRefresh={load}
              />
            ))}
          </div>

          {/* Pagination */}
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-1 shadow-sm">
            <Pagination
              page={page}
              totalPages={totalPages}
              totalElements={totalElements}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
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
