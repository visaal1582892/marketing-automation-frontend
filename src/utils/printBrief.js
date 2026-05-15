/**
 * Opens a polished, print-ready version of the campaign brief in a new window
 * and immediately triggers the browser print dialog.
 *
 * The output is pure HTML + inline CSS — no library required.
 * Users can print to paper OR "Save as PDF" from the browser dialog.
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────
const safe = v => (v == null || v === '') ? '—' : String(v)

const safeMulti = v => {
  if (!v) return '—'
  return String(v).split(',').map(s => s.trim()).filter(Boolean).join(', ') || '—'
}

const safeLocation = raw => {
  if (!raw) return '—'
  try {
    const p = JSON.parse(raw)
    if (Array.isArray(p)) return p.join(', ')
  } catch { /* not JSON */ }
  return raw
}

const fmtDate = d =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const fmtDateTime = d =>
  d ? new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) : '—'

const STATUS_LABEL = {
  IN_PROGRESS: 'In Progress', QC_REVIEW: 'QC Review',
  COMPLETED: 'Completed',     REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',     PENDING: 'Pending Approval',
}
const TASK_LABEL = {
  ASSIGNED: 'Assigned', ACCEPTED: 'Accepted', IN_PROGRESS: 'In Progress',
  QC_REVIEW: 'In QC',   COMPLETED: 'Completed', REWORK: 'Rework',
  HELD: 'On Hold',      CANCELLED: 'Cancelled',
}
const STATUS_COLOR = {
  IN_PROGRESS: '#2563eb', QC_REVIEW: '#7c3aed', COMPLETED: '#16a34a',
  REJECTED: '#dc2626',    CANCELLED: '#94a3b8', PENDING: '#94a3b8',
  ASSIGNED: '#2563eb',    ACCEPTED: '#2563eb',  REWORK: '#d97706',
  HELD: '#d97706',
}
const PRIORITY_COLOR = { HIGH: '#dc2626', MEDIUM: '#d97706', LOW: '#16a34a' }

// ─── Tiny HTML helpers ────────────────────────────────────────────────────────
const badge = (label, color) =>
  `<span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:10px;
    font-weight:700;letter-spacing:.04em;color:#fff;background:${color};">${label}</span>`

const fieldGrid = items =>
  `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px 20px;margin-top:12px;">
    ${items.filter(Boolean).map(({ label, value, wide }) =>
      `<div style="${wide ? 'grid-column:1/-1;' : ''}">
        <div style="font-size:9px;font-weight:700;letter-spacing:.08em;color:#94a3b8;text-transform:uppercase;margin-bottom:3px;">${label}</div>
        <div style="font-size:13px;color:#0f172a;font-weight:500;line-height:1.4;">${safe(value)}</div>
      </div>`
    ).join('')}
  </div>`

const sectionCard = (title, content, accent = '#c2181d') =>
  `<div style="margin-bottom:20px;break-inside:avoid;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <div style="width:3px;height:16px;border-radius:2px;background:${accent};flex-shrink:0;"></div>
      <h3 style="margin:0;font-size:11px;font-weight:800;letter-spacing:.1em;color:#475569;text-transform:uppercase;">${title}</h3>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;">
      ${content}
    </div>
  </div>`

// ─── Main export ─────────────────────────────────────────────────────────────
export function printBrief(campaign, filterTaskId = null) {
  const c = campaign

  const statusLabel   = STATUS_LABEL[c.status]   || safe(c.status)
  const statusColor   = STATUS_COLOR[c.status]    || '#94a3b8'
  const priorityColor = PRIORITY_COLOR[c.priority] || '#64748b'

  const deliverables = (c.deliverables || [])

  // If opened from a worker's task card, only show their task.
  const allTasks = (c.workTasks || []).filter(t => t.status !== 'CANCELLED')
  const tasks = filterTaskId
    ? allTasks.filter(t => String(t.taskId) === String(filterTaskId))
    : allTasks

  // When printing a single task, also filter deliverables to the matched task's granularTaskId
  const matchedTask  = tasks[0]
  const printDeliverables = filterTaskId
    ? deliverables.filter(d =>
        matchedTask &&
        (String(d.granularTaskId) === String(matchedTask.granularTaskId) ||
         d.granularTaskName === matchedTask.granularTaskName)
      )
    : deliverables

  const isSingleTask = !!filterTaskId

  // ── Build HTML ───────────────────────────────────────────────────────────
  const html = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Brief #${c.campaignId} — ${safe(c.taskTypeName)}${isSingleTask ? ` — Task #${filterTaskId}` : ''}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
    font-size:13px;color:#1e293b;background:#f8fafc;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
  }
  .page{
    max-width:750px;margin:0 auto;padding:0;
    background:#fff;
  }

  /* ── Cover strip ── */
  .cover{
    background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);
    color:#fff;padding:32px 36px 24px;
    position:relative;overflow:hidden;
  }
  .cover::after{
    content:'#${c.campaignId}';
    position:absolute;right:32px;top:16px;
    font-size:64px;font-weight:900;letter-spacing:-.04em;
    color:rgba(255,255,255,0.07);line-height:1;pointer-events:none;
  }
  .cover-eyebrow{
    font-size:9px;font-weight:700;letter-spacing:.14em;
    color:rgba(255,255,255,.4);text-transform:uppercase;margin-bottom:10px;
  }
  .cover-title{
    font-size:26px;font-weight:800;letter-spacing:-.02em;line-height:1.2;
    color:#fff;margin-bottom:10px;
  }
  .cover-meta{
    font-size:12px;color:rgba(255,255,255,.55);display:flex;flex-wrap:wrap;
    gap:6px 16px;margin-bottom:16px;
  }
  .cover-meta span::before{content:'·';margin-right:6px;color:rgba(255,255,255,.25);}
  .cover-meta span:first-child::before{content:'';}
  .cover-badges{display:flex;gap:8px;flex-wrap:wrap;}

  .badge{
    display:inline-block;padding:3px 10px;border-radius:999px;
    font-size:10px;font-weight:700;letter-spacing:.04em;
  }

  /* ── Objective strip ── */
  .obj-strip{
    background:#f1f5f9;border-bottom:1px solid #e2e8f0;
    padding:10px 36px;display:flex;flex-wrap:wrap;gap:20px;
  }
  .obj-item{font-size:11px;color:#64748b;}
  .obj-item strong{font-size:10px;letter-spacing:.07em;text-transform:uppercase;
    color:#94a3b8;font-weight:700;margin-right:6px;}

  /* ── Body ── */
  .body{padding:28px 36px 36px;}

  /* ── Section card ── */
  .section-card{margin-bottom:20px;break-inside:avoid;}
  .section-label{
    display:flex;align-items:center;gap:8px;margin-bottom:10px;
  }
  .section-accent{width:3px;height:16px;border-radius:2px;flex-shrink:0;}
  .section-title{
    font-size:10px;font-weight:800;letter-spacing:.1em;
    color:#64748b;text-transform:uppercase;
  }
  .card{
    background:#fff;border:1px solid #e2e8f0;
    border-radius:10px;padding:16px;
  }

  /* ── Field grid ── */
  .field-grid{
    display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));
    gap:14px 20px;
  }
  .field-wide{grid-column:1/-1;}
  .field-label{
    font-size:9px;font-weight:700;letter-spacing:.08em;
    color:#94a3b8;text-transform:uppercase;margin-bottom:3px;
  }
  .field-value{font-size:13px;color:#0f172a;font-weight:500;line-height:1.4;}
  .field-value.italic{font-style:italic;}

  /* ── Key message block ── */
  .key-msg{
    background:#fefce8;border:1px solid #fde047;border-left:3px solid #eab308;
    border-radius:8px;padding:12px 14px;font-size:13px;
    color:#713f12;font-style:italic;line-height:1.6;margin-bottom:12px;
  }

  /* ── Alert boxes ── */
  .alert{
    border-radius:8px;padding:10px 14px;font-size:12px;line-height:1.5;
    margin-bottom:12px;break-inside:avoid;
  }
  .alert-red{background:#fff1f2;border:1px solid #fecdd3;color:#9f1239;}
  .alert-amber{background:#fffbeb;border:1px solid #fde68a;color:#78350f;}

  /* ── Deliverable pills ── */
  .deliverable-list{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;}
  .deliverable-pill{
    display:inline-flex;align-items:center;gap:6px;
    background:#f1f5f9;border:1px solid #e2e8f0;
    border-radius:999px;padding:4px 12px 4px 6px;
    font-size:12px;font-weight:500;color:#334155;
  }
  .deliverable-num{
    width:18px;height:18px;border-radius:50%;
    background:#c2181d;color:#fff;font-size:9px;font-weight:800;
    display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;
  }

  /* ── Task cards ── */
  .task-card{
    border:1px solid #e2e8f0;border-radius:10px;
    margin-bottom:12px;overflow:hidden;break-inside:avoid;
  }
  .task-header{
    background:#f8fafc;border-bottom:1px solid #e2e8f0;
    padding:10px 14px;display:flex;justify-content:space-between;
    align-items:flex-start;gap:12px;
  }
  .task-name{font-size:13px;font-weight:700;color:#0f172a;margin-bottom:4px;}
  .task-meta{font-size:11px;color:#64748b;}
  .task-chips{display:flex;flex-wrap:wrap;gap:6px;flex-shrink:0;}
  .task-body{padding:12px 14px;}

  /* ── Timeline strip ── */
  .timeline{
    display:flex;align-items:stretch;gap:0;
    margin-bottom:10px;flex-wrap:wrap;gap:4px;
  }
  .tl-step{
    display:flex;align-items:center;gap:6px;
    border:1px solid #e2e8f0;border-radius:8px;
    padding:5px 10px;font-size:10px;
  }
  .tl-dot{
    width:10px;height:10px;border-radius:50%;flex-shrink:0;
  }
  .tl-label{font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#94a3b8;}
  .tl-label.active{color:inherit;}
  .tl-ts{font-size:10px;font-weight:600;color:#475569;}

  /* ── Notes block ── */
  .note-block{
    background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
    padding:10px 12px;margin-top:8px;
  }
  .note-label{font-size:9px;font-weight:700;letter-spacing:.08em;color:#94a3b8;
    text-transform:uppercase;margin-bottom:4px;}

  /* ── Approval trail ── */
  .approval-row{
    display:flex;align-items:center;gap:12px;padding:8px 0;
    border-bottom:1px solid #f1f5f9;
  }
  .approval-row:last-child{border-bottom:none;}
  .approval-stage{font-size:12px;font-weight:600;color:#334155;width:160px;flex-shrink:0;}
  .approval-decision{font-size:12px;font-weight:700;}
  .approval-by{font-size:11px;color:#94a3b8;flex:1;text-align:right;}

  /* ── Q&A ── */
  .qa-list{margin-top:8px;}
  .qa-item{margin-bottom:10px;}
  .qa-q{font-size:10px;font-weight:700;color:#6366f1;letter-spacing:.04em;margin-bottom:2px;}
  .qa-a{font-size:12px;color:#1e293b;font-weight:500;}

  /* ── Footer ── */
  .footer{
    border-top:1px solid #e2e8f0;padding:14px 36px;
    display:flex;justify-content:space-between;
    font-size:10px;color:#94a3b8;
  }

  /* ── Print rules ── */
  @media print {
    body{background:#fff;}
    .page{max-width:none;box-shadow:none;}
    .no-print{display:none!important;}
    h2,h3{break-after:avoid;}
    .task-card,.section-card{break-inside:avoid;}
  }
  @page{margin:14mm 12mm;size:A4;}
</style>
</head>
<body>
<div class="page">

  <!-- ── PRINT BUTTON (screen only) ── -->
  <div class="no-print" style="background:#f1f5f9;padding:10px 36px;display:flex;justify-content:flex-end;gap:10px;border-bottom:1px solid #e2e8f0;">
    <button onclick="window.print()"
      style="display:flex;align-items:center;gap:6px;background:#0f172a;color:#fff;
             border:none;border-radius:8px;padding:7px 16px;font-size:12px;font-weight:700;
             cursor:pointer;letter-spacing:.02em;">
      🖨️ Print / Save as PDF
    </button>
    <button onclick="window.close()"
      style="background:#e2e8f0;color:#475569;border:none;border-radius:8px;
             padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;">
      Close
    </button>
  </div>

  <!-- ── COVER ── -->
  <div class="cover">
    <div class="cover-eyebrow">MedPlus Marketing Automation · ${isSingleTask ? 'Task Brief' : 'Campaign Brief'}</div>
    <div class="cover-title">${safe(c.taskTypeName)}</div>
    <div class="cover-meta">
      <span>${safe(c.requestorName)}</span>
      ${c.departmentName ? `<span>${safe(c.departmentName)}</span>` : ''}
      <span>${fmtDate(c.createdAt)}</span>
    </div>
    <div class="cover-badges">
      <span class="badge" style="background:${statusColor};">${statusLabel}</span>
      <span class="badge" style="background:${priorityColor};">${safe(c.priority)}</span>
      ${c.flaggedInconsistency ? `<span class="badge" style="background:#dc2626;">⚠ Inconsistency</span>` : ''}
    </div>
  </div>

  <!-- ── OBJECTIVE STRIP ── -->
  ${(c.businessObjective || safeLocation(c.targetLocation) !== '—') ? `
  <div class="obj-strip">
    ${c.businessObjective ? `<div class="obj-item"><strong>Objective</strong>${safe(c.businessObjective)}</div>` : ''}
    ${safeLocation(c.targetLocation) !== '—' ? `<div class="obj-item"><strong>Location</strong>${safeLocation(c.targetLocation)}</div>` : ''}
  </div>` : ''}

  <!-- ── BODY ── -->
  <div class="body">

    ${c.inconsistencyReason ? `
    <div class="alert alert-red" style="margin-bottom:16px;">
      <strong>⚠ Inconsistency Detected</strong><br/>${safe(c.inconsistencyReason)}
    </div>` : ''}

    ${c.routingNotes ? `
    <div class="alert alert-amber" style="margin-bottom:16px;">
      <strong>Routing Note</strong><br/>${safe(c.routingNotes)}
    </div>` : ''}

    <!-- Campaign Overview -->
    <div class="section-card">
      <div class="section-label">
        <div class="section-accent" style="background:#2563eb;"></div>
        <div class="section-title">Campaign Overview</div>
      </div>
      <div class="card">
        <div class="field-grid">
          <div>
            <div class="field-label">Task Type</div>
            <div class="field-value">${safe(c.taskTypeName)}</div>
          </div>
          <div>
            <div class="field-label">Audience Type</div>
            <div class="field-value">${safeMulti(c.audienceName || c.audienceTypeId)}</div>
          </div>
          <div>
            <div class="field-label">Language</div>
            <div class="field-value">${safeMulti(c.language)}</div>
          </div>
          <div>
            <div class="field-label">Tone / Style</div>
            <div class="field-value">${safeMulti(c.tone)}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Message & Offer -->
    <div class="section-card">
      <div class="section-label">
        <div class="section-accent" style="background:#7c3aed;"></div>
        <div class="section-title">Message & Offer</div>
      </div>
      <div class="card">
        ${c.keyMessage ? `<div class="key-msg">"${safe(c.keyMessage)}"</div>` : ''}
        <div class="field-grid">
          <div>
            <div class="field-label">Has Offer</div>
            <div class="field-value">${safe(c.hasOffer)}</div>
          </div>
          ${c.hasOffer === 'YES' ? `
          <div>
            <div class="field-label">Offer Type</div>
            <div class="field-value">${safe(c.offerTypeId || c.offerTypeName)}</div>
          </div>
          <div>
            <div class="field-label">Supporting Proof</div>
            <div class="field-value">${safe(c.supportingProof)}</div>
          </div>` : ''}
        </div>
      </div>
    </div>

    <!-- Budget & Goals -->
    <div class="section-card">
      <div class="section-label">
        <div class="section-accent" style="background:#059669;"></div>
        <div class="section-title">Budget & Goals</div>
      </div>
      <div class="card">
        <div class="field-grid">
          <div>
            <div class="field-label">Budget Tier</div>
            <div class="field-value">${safe(c.budgetTier)}</div>
          </div>
          <div>
            <div class="field-label">KPI Type</div>
            <div class="field-value">${safe(c.kpiType)}</div>
          </div>
          <div>
            <div class="field-label">Expected Output</div>
            <div class="field-value">${safe(c.expectedOutput)}</div>
          </div>
          <div>
            <div class="field-label">Vendor Required</div>
            <div class="field-value">${safe(c.vendorRequired)}</div>
          </div>
          ${c.vendorRequired === 'YES' ? `
          <div>
            <div class="field-label">Vendor Type</div>
            <div class="field-value">${safeMulti(c.vendorType)}</div>
          </div>` : ''}
        </div>
      </div>
    </div>

    <!-- Deliverables -->
    ${printDeliverables.length ? `
    <div class="section-card">
      <div class="section-label">
        <div class="section-accent" style="background:#0284c7;"></div>
        <div class="section-title">Deliverables (${printDeliverables.length})</div>
      </div>
      <div class="card">
        <div class="deliverable-list">
          ${printDeliverables.map((d, i) =>
            `<div class="deliverable-pill">
              <span class="deliverable-num">${i + 1}</span>
              ${safe(d.granularTaskName || d.granularTaskId)}
            </div>`
          ).join('')}
        </div>
      </div>
    </div>` : ''}

    <!-- Work Tasks -->
    ${tasks.length ? `
    <div class="section-card">
      <div class="section-label">
        <div class="section-accent" style="background:#c2181d;"></div>
        <div class="section-title">${isSingleTask ? 'Your Task' : `Work Tasks (${tasks.length})`}</div>
      </div>
      ${tasks.map(t => {
        const tColor  = STATUS_COLOR[t.status] || '#94a3b8'
        const tLabel  = TASK_LABEL[t.status]   || t.status
        const steps   = [
          { label: 'Assigned',  ts: t.assignedAt || t.createdAt, color: '#64748b' },
          { label: 'Accepted',  ts: t.acceptedAt,                color: '#2563eb' },
          { label: 'Submitted', ts: t.submittedAt,               color: '#7c3aed' },
          { label: 'Mgr Approved', ts: t.managerApprovedAt,   color: '#059669' },
          { label: 'Req Approved', ts: t.requestorApprovedAt, color: '#16a34a' },
        ]
        return `
        <div class="task-card">
          <div class="task-header">
            <div>
              <div class="task-name">${safe(t.granularTaskName || 'Task')}</div>
              <div class="task-meta">
                TASK #${t.taskId}
                ${t.assigneeName ? ` · Assigned to ${safe(t.assigneeName)}` : ' · Unassigned'}
                ${t.totalTimeLoggedMinutes != null ? ` · ${t.totalTimeLoggedMinutes} min logged` : ''}
              </div>
            </div>
            <div class="task-chips">
              <span class="badge" style="background:${tColor};">${tLabel}</span>
              ${t.reworkCount > 0 ? `<span class="badge" style="background:#d97706;">${t.reworkCount}× rework</span>` : ''}
            </div>
          </div>
          <div class="task-body">
            <div class="timeline">
              ${steps.map(s => `
              <div class="tl-step" style="${s.ts ? `border-color:${s.color}20;background:${s.color}08;` : ''}">
                <div class="tl-dot" style="background:${s.ts ? s.color : '#e2e8f0'};"></div>
                <div>
                  <div class="tl-label ${s.ts ? 'active' : ''}" style="${s.ts ? `color:${s.color};` : ''}">${s.label}</div>
                  <div class="tl-ts">${s.ts ? fmtDateTime(s.ts) : '—'}</div>
                </div>
              </div>`).join('')}
            </div>
            ${t.submissionNotes ? `
            <div class="note-block">
              <div class="note-label">Submission Notes</div>
              <div style="font-size:12px;color:#334155;">${safe(t.submissionNotes)}</div>
            </div>` : ''}
            ${t.workerComment ? `
            <div class="note-block" style="background:#fffbeb;border-color:#fde68a;margin-top:8px;">
              <div class="note-label" style="color:#d97706;">Worker Comment — On Hold</div>
              <div style="font-size:12px;color:#78350f;">${safe(t.workerComment)}</div>
            </div>` : ''}
            ${t.questionnaire?.length ? `
            <div class="qa-list">
              <div style="font-size:9px;font-weight:800;letter-spacing:.1em;color:#6366f1;text-transform:uppercase;margin:10px 0 6px;">Task Q&A</div>
              ${t.questionnaire.map(q => `
              <div class="qa-item">
                <div class="qa-q">${safe(q.questionText)}</div>
                <div class="qa-a">${safe(q.answerDisplay)}</div>
              </div>`).join('')}
            </div>` : ''}
          </div>
        </div>`
      }).join('')}
    </div>` : ''}

    <!-- Approval Trail (not shown in single-task view) -->
    ${!isSingleTask && (c.deptDecision || c.marketingDecision) ? `
    <div class="section-card">
      <div class="section-label">
        <div class="section-accent" style="background:#059669;"></div>
        <div class="section-title">Approval Trail</div>
      </div>
      <div class="card">
        ${[
          { stage: 'Department Approval', decision: c.deptDecision,      by: c.deptDecisionByName,         at: c.deptDecisionAt },
          { stage: 'Marketing Approval',  decision: c.marketingDecision,  by: c.marketingDecisionByName,    at: c.marketingDecisionAt },
          c.interventionDecision && { stage: 'Intervention', decision: c.interventionDecision, by: c.interventionDecisionByName, at: c.interventionDecisionAt },
        ].filter(Boolean).map(s => {
          const dc = s.decision === 'APPROVED' ? '#16a34a' : s.decision === 'REJECTED' ? '#dc2626' : '#94a3b8'
          return `
          <div class="approval-row">
            <div class="approval-stage">${s.stage}</div>
            <div class="approval-decision" style="color:${dc};">${s.decision || 'Pending'}</div>
            <div class="approval-by">${[s.by, s.at ? fmtDate(s.at) : ''].filter(Boolean).join(' · ')}</div>
          </div>`
        }).join('')}
        ${c.rejectionReason && (c.deptDecision === 'REJECTED' || c.marketingDecision === 'REJECTED' || c.interventionDecision === 'REJECTED') ? `
        <div class="alert alert-red" style="margin-top:12px;">
          <strong>Rejection reason:</strong> ${safe(c.rejectionReason)}
        </div>` : ''}
      </div>
    </div>` : ''}

  </div><!-- /body -->

  <!-- ── FOOTER ── -->
  <div class="footer">
    <span>MedPlus Marketing Automation · Confidential</span>
    <span>Generated ${fmtDateTime(new Date())}</span>
  </div>

</div><!-- /page -->
</body>
</html>`

  // ── Open & print ─────────────────────────────────────────────────────────
  const win = window.open('', '_blank', 'width=860,height=900,scrollbars=yes')
  if (!win) {
    alert('Pop-up blocked. Please allow pop-ups for this site to use the print feature.')
    return
  }
  win.document.write(html)
  win.document.close()
  // Give the browser a tick to finish rendering before opening the print dialog
  win.addEventListener('load', () => {
    win.focus()
    setTimeout(() => win.print(), 400)
  })
}
