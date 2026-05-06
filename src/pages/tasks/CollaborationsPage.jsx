import { useEffect, useMemo, useRef, useState } from 'react'
import collaborationApi from '../../api/collaboration'
import AppSelect from '../../components/AppSelect'
import useTaskChat from '../../hooks/useTaskChat'
import useUnreadWatcher from '../../hooks/useUnreadWatcher'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import RequestBriefDrawer from '../../components/RequestBriefDrawer'
import { useAuth } from '../../auth/AuthContext'
import AssetPanel, { CHAT_OPEN_STATUSES, UploadRow, isImage, isVideo, displayName, openUrl, triggerDownload } from '../../components/AssetPanel'

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

// Chat and asset uploads are only open when the task is actively being worked on.
// ASSIGNED = not yet started → interaction locked until the worker hits Start.
// COMPLETED / QC_REVIEW / HELD / CANCELLED → entire card locked.
const CARD_BLOCKED_STATUSES = ['HELD', 'QC_REVIEW', 'CANCELLED', 'COMPLETED']
// CHAT_OPEN_STATUSES imported from ../../components/AssetPanel

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
  const bottomRef   = useRef(null)
  const typingTimer = useRef(null)

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

// ─── Shared helpers + AssetPanel imported from ../../components/AssetPanel ────
// isImage, isVideo, displayName, openUrl, triggerDownload, UploadRow, AssetPanel

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
  const toast          = useToast()
  const role           = task.myRole || 'COLLABORATOR'
  const cfg            = rc(role)
  const canManage      = ['OWNER', 'ADMIN', 'MANAGER'].includes(role)
  const isCardBlocked      = CARD_BLOCKED_STATUSES.includes(task.status)
  // Locked when card is blocked, task not started, OR collaboration is not active (manual pause)
  const isInteractionLocked = isCardBlocked || task.status === 'ASSIGNED' || !task.collaborationActive
  // Owner/Admin can still toggle the pause even when locked (to resume), but not when card is fully blocked or ASSIGNED
  const canPauseChat        = ['OWNER', 'ADMIN'].includes(role)
    && !isCardBlocked
    && task.status !== 'ASSIGNED'

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
      {/* Fixed-height card — uniform across all cards */}
      <div className={`relative flex flex-col rounded-2xl border-l-4 ${cfg.border} bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden ${isCardBlocked ? 'opacity-70' : ''}`}
           style={{ height: '178px' }}>

        {/* ── Content area ── */}
        <div className="flex-1 flex flex-col px-4 pt-3.5 pb-2 min-h-0 overflow-hidden">

          {/* Row 1: title + all badges on the same line */}
          <div className="flex items-center gap-2">
            <p className="flex-1 text-sm font-bold text-slate-900 leading-tight truncate min-w-0">
              {task.granularTaskName || task.taskTypeName || 'Task'}
            </p>
            {unreadCount > 0 && (
              <span className="animate-pulse inline-flex items-center rounded-full bg-brand-600 px-1.5 py-0.5 text-[9px] font-bold text-white shrink-0">
                {unreadCount}
              </span>
            )}
            <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-semibold shrink-0 ${cfg.badge}`}>
              <Icon name={cfg.icon} className="h-2.5 w-2.5" />
              {cfg.label}
            </span>
            <StatusBadge status={task.status} />
          </div>

          {/* Row 2: campaign + task ID on one line */}
          <p className="text-[10px] text-slate-400 mt-1 truncate">
            Campaign #{task.campaignId}
            <span className="mx-1.5 text-slate-200">·</span>
            <span className="font-mono text-[9px]">{task.taskId}</span>
          </p>

          {/* Row 3: assignee & requestor on one line with separator */}
          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-slate-500 min-w-0 overflow-hidden">
            {task.assigneeName && (
              <>
                <Icon name="user" className="h-2.5 w-2.5 text-slate-300 shrink-0" />
                <span className="font-medium text-slate-700 truncate max-w-[100px]">{task.assigneeName}</span>
                <span className="text-slate-300 shrink-0">assignee</span>
              </>
            )}
            {task.assigneeName && task.requestorName && (
              <span className="text-slate-200 mx-0.5 shrink-0">·</span>
            )}
            {task.requestorName && (
              <>
                <Icon name="briefcase" className="h-2.5 w-2.5 text-slate-300 shrink-0" />
                <span className="font-medium text-slate-700 truncate max-w-[100px]">{task.requestorName}</span>
                <span className="text-slate-300 shrink-0">requestor</span>
              </>
            )}
          </div>

          {/* Row 4: inline status banner (single compact line, only when needed) */}
          {isCardBlocked ? (
            <div className="mt-1.5 flex items-center gap-1 text-[10px] text-brand-700">
              <Icon name="lock" className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{{
                HELD:      'On hold — chat and assets paused.',
                QC_REVIEW: 'In QC review — locked.',
                COMPLETED: 'Completed — locked.',
                CANCELLED: 'Task cancelled.',
              }[task.status]}</span>
            </div>
          ) : task.status === 'ASSIGNED' ? (
            <div className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-500">
              <Icon name="lock" className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">Not started — chat and assets unlock on start.</span>
            </div>
          ) : !task.collaborationActive ? (
            <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-600">
              <Icon name="lock" className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">Chat paused — assets still available.</span>
            </div>
          ) : null}
        </div>

        {/* ── Action row — icon-only circular buttons, all in one line ── */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-t border-slate-100">

          <button title="Chat" onClick={isInteractionLocked ? undefined : onChat} disabled={isInteractionLocked}
            className="h-8 w-8 rounded-full bg-brand-600 flex items-center justify-center text-white hover:bg-brand-700 active:scale-95 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
            <Icon name="messageSquare" className="h-3.5 w-3.5" />
          </button>

          <button title="Assets" onClick={isInteractionLocked ? undefined : onAssets} disabled={isInteractionLocked}
            className="h-8 w-8 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
            <Icon name="upload" className="h-3.5 w-3.5" />
          </button>

          <button title="Brief" onClick={onBrief}
            className="h-8 w-8 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-100 transition shrink-0">
            <Icon name="eye" className="h-3.5 w-3.5" />
          </button>

          {canManage && !isInteractionLocked && (
            <button title="Add People" onClick={() => setShowAddPeople(true)}
              className="h-8 w-8 rounded-full border border-accent-200 bg-accent-50 flex items-center justify-center text-accent-700 hover:bg-accent-100 transition shrink-0">
              <Icon name="userPlus" className="h-3.5 w-3.5" />
            </button>
          )}

          {canPauseChat && (
            <button title={!task.collaborationActive ? 'Resume Chat' : 'Pause Chat'}
              onClick={handleToggleChat} disabled={togglingChat}
              className={`h-8 w-8 rounded-full flex items-center justify-center transition disabled:opacity-50 shrink-0 ml-auto
                ${!task.collaborationActive
                  ? 'bg-accent-500 text-white hover:bg-accent-600'
                  : 'border border-slate-300 bg-white text-slate-500 hover:bg-slate-100'}`}>
              <Icon name={!task.collaborationActive ? 'play' : 'lock'} className="h-3.5 w-3.5" />
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

export default function CollaborationsPage() {
  const { user }  = useAuth()
  const toast     = useToast()
  const [tasks,   setTasks]   = useState([])
  const [loading, setLoading] = useState(true)

  const [chatTask,   setChatTask]   = useState(null)
  const [assetTask,  setAssetTask]  = useState(null)
  const [briefTask,  setBriefTask]  = useState(null)

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [search,          setSearch]          = useState('')
  const [filterUnread,    setFilterUnread]    = useState(false)
  const [filterActivity,  setFilterActivity]  = useState('active') // 'active' | 'inactive' | 'all'

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
      if (filterActivity === 'active'   && !t.collaborationActive) return false
      if (filterActivity === 'inactive' &&  t.collaborationActive) return false
      if (filterUnread && !(unreadCounts[t.taskId] > 0)) return false
      if (q) {
        const hay = [
          t.taskId, t.granularTaskName, t.taskTypeName,
          t.campaignId, t.assigneeName, t.requestorName,
        ].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [tasks, filterUnread, filterActivity, search, unreadCounts])

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

        {/* Activity filter */}
        <div className="w-36">
          <AppSelect
            value={filterActivity}
            onChange={setFilterActivity}
            options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'all', label: 'All' }]}
            placeholder="Filter…"
            size="sm"
            isClearable={false}
          />
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
        {(search || filterUnread || filterActivity !== 'active') && (
          <button
            onClick={() => { setSearch(''); setFilterUnread(false); setFilterActivity('active') }}
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
          <button onClick={() => { setSearch(''); setFilterUnread(false); setFilterActivity('active') }}
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
