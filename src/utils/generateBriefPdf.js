/**
 * Professional campaign brief PDF generator.
 * Builds the PDF directly from data — no HTML/CSS rendering.
 */
import { jsPDF } from 'jspdf'

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  brand:      [194, 24,  29 ],   // MedPlus red
  brandLight: [253, 226, 226],
  ink:        [17,  24,  39 ],   // slate-900
  sub:        [71,  85,  105],   // slate-600
  muted:      [148, 163, 184],   // slate-400
  rule:       [226, 232, 240],   // slate-200
  surface:    [248, 250, 252],   // slate-50
  white:      [255, 255, 255],
  green:      [22,  163, 74 ],
  amber:      [217, 119, 6  ],
  red:        [220, 38,  38 ],
  blue:       [37,  99,  235],
  purple:     [124, 58,  237],
}

const PW = 210, PH = 297, ML = 16, MR = 16, CW = PW - ML - MR

// ─── Helpers ─────────────────────────────────────────────────────────────────
const safe = v => (v == null || v === '') ? '—' : String(v)
const safeMulti = v => {
  if (!v) return '—'
  return String(v).split(',').map(s => s.trim()).filter(Boolean).join(', ') || '—'
}
const safeLocation = raw => {
  if (!raw) return '—'
  try { const p = JSON.parse(raw); if (Array.isArray(p)) return p.join(', ') } catch {}
  return raw
}
const fmtDate = d => d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—'
const fmtDateTime = d => d
  ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—'
const STATUS_LABEL = {
  IN_PROGRESS: 'In Progress', QC_REVIEW: 'QC Review',
  COMPLETED: 'Completed',     REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',     PENDING: 'Pending',
}
const TASK_LABEL = {
  ASSIGNED: 'Assigned', ACCEPTED: 'Accepted', IN_PROGRESS: 'In Progress',
  QC_REVIEW: 'In QC',   COMPLETED: 'Completed', REWORK: 'Rework',
  HELD: 'On Hold',      CANCELLED: 'Cancelled',
}
const STATUS_DOT = {
  IN_PROGRESS: C.blue,  QC_REVIEW: C.purple, COMPLETED: C.green,
  REJECTED: C.red,      CANCELLED: C.muted,  PENDING: C.muted,
  ASSIGNED: C.blue,     ACCEPTED: C.blue,    REWORK: C.amber,
  HELD: C.amber,
}
const PRIORITY_COLOR = { HIGH: C.red, MEDIUM: C.amber, LOW: C.green }

// ─── Main export ─────────────────────────────────────────────────────────────
export async function generateBriefPdf(campaign) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  let y = 0
  let pageNum = 1

  // ── Drawing primitives ───────────────────────────────────────────────────────
  const rgb  = ([r, g, b]) => ({ r, g, b })
  const fill = c => doc.setFillColor(...c)
  const draw = c => doc.setDrawColor(...c)
  const ink  = c => doc.setTextColor(...c)
  const lw   = w => doc.setLineWidth(w)
  const font = (style, size) => { doc.setFont('helvetica', style); doc.setFontSize(size) }

  const txt = (s, x, yy, opts = {}) => doc.text(safe(s), x, yy, opts)
  const wrap = (s, x, yy, maxW, lineH = 4.6) => {
    const lines = doc.splitTextToSize(safe(s), maxW)
    doc.text(lines, x, yy)
    return yy + lines.length * lineH
  }

  // ── Page break ───────────────────────────────────────────────────────────────
  const needY = (needed) => {
    if (y + needed > PH - 18) {
      drawFooter()
      doc.addPage()
      pageNum++
      drawPageHeader()
      y = 42
    }
  }

  // ── Horizontal rule ──────────────────────────────────────────────────────────
  const rule = (yy, color = C.rule) => {
    draw(color); lw(0.25)
    doc.line(ML, yy, PW - MR, yy)
  }

  // ── Section title ────────────────────────────────────────────────────────────
  const section = (title, icon = '') => {
    needY(18)
    y += 4

    // Accent left bar
    fill(C.brand)
    doc.rect(ML, y, 2.5, 6, 'F')

    font('bold', 9)
    ink(C.ink)
    txt(`${icon}${icon ? '  ' : ''}${title}`, ML + 6, y + 4.4)
    y += 10

    draw(C.rule); lw(0.2)
    doc.line(ML, y, PW - MR, y)
    y += 5
  }

  // ── Status dot + label ───────────────────────────────────────────────────────
  const statusLine = (status, labelMap = STATUS_LABEL, dotMap = STATUS_DOT) => {
    const color = dotMap[status] || C.muted
    fill(color)
    doc.circle(0, 0, 1.4, 'F')   // drawn via translate below — easier with text baseline
    // just inline dots as colored rectangles
    fill(color)
    doc.roundedRect(0, -2.2, 3, 3, 1.5, 1.5, 'F')   // will use correct coords below
    return (labelMap[status] || status || '—').replace('_', ' ')
  }

  // ── Two-column label/value grid ───────────────────────────────────────────────
  const grid = (items, cols = 2) => {
    const colW = CW / cols
    const rowH = 9

    for (let i = 0; i < items.length; i += cols) {
      const rowItems = items.slice(i, i + cols)
      const heights = rowItems.map(item => {
        if (!item) return rowH
        font('normal', 8)
        return Math.max(rowH, doc.splitTextToSize(safe(item.value), colW - 5).length * 4.5 + 5)
      })
      const rh = Math.max(...heights)
      needY(rh + 2)

      rowItems.forEach((item, j) => {
        if (!item) return
        const x = ML + j * colW

        font('normal', 6.5)
        ink(C.muted)
        txt(item.label.toUpperCase(), x, y)

        font('normal', 8.5)
        ink(C.ink)
        wrap(item.value, x, y + 4.5, colW - 5, 4.5)
      })

      y += rh
    }
  }

  // ── Full-width text block ────────────────────────────────────────────────────
  const textBlock = (label, value, accent = false) => {
    if (!value || value === '—') return
    needY(18)

    font('normal', 6.5)
    ink(C.muted)
    txt(label.toUpperCase(), ML, y)
    y += 4.5

    const lines = doc.splitTextToSize(safe(value), CW - 10)
    const bh = lines.length * 4.8 + 7

    fill(accent ? C.brandLight : C.surface)
    draw(accent ? C.brand : C.rule)
    lw(accent ? 0.4 : 0.2)
    doc.roundedRect(ML, y, CW, bh, 1.5, 1.5, 'FD')

    if (accent) { fill(C.brand); doc.rect(ML, y, 2.5, bh, 'F') }

    font(accent ? 'bold' : 'normal', 8.5)
    ink(C.ink)
    doc.text(lines, ML + (accent ? 7 : 4), y + 5)
    y += bh + 5
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Page header (repeats on every page after page 1)
  // ────────────────────────────────────────────────────────────────────────────
  const drawPageHeader = () => {
    fill(C.rule)
    doc.rect(0, 0, PW, 12, 'F')
    font('bold', 7)
    ink(C.sub)
    txt('MedPlus Marketing Automation', ML, 7.5)
    font('normal', 7)
    ink(C.muted)
    txt(`Campaign Brief  #${campaign.campaignId}`, PW - MR, 7.5, { align: 'right' })
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Footer
  // ────────────────────────────────────────────────────────────────────────────
  const drawFooter = () => {
    rule(PH - 14, C.rule)
    font('normal', 6.5)
    ink(C.muted)
    txt(`Confidential  •  Generated ${fmtDateTime(new Date())}`, ML, PH - 9)
    txt(`Page ${pageNum}`, PW - MR, PH - 9, { align: 'right' })
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 1 — Cover header
  // ════════════════════════════════════════════════════════════════════════════

  // Background strip
  fill(C.brand)
  doc.rect(0, 0, PW, 38, 'F')

  // MedPlus wordmark
  font('bold', 16)
  ink(C.white)
  txt('MedPlus', ML, 14)
  font('normal', 7.5)
  ink([255, 180, 180])
  txt('Marketing Automation  •  Campaign Brief', ML, 20)

  // Request ID — large, right side
  font('bold', 20)
  ink(C.white)
  txt(`#${campaign.campaignId}`, PW - MR, 16, { align: 'right' })
  font('normal', 7.5)
  ink([255, 180, 180])
  txt(safe(campaign.taskTypeName), PW - MR, 22, { align: 'right' })

  y = 46

  // ── Campaign title & meta ─────────────────────────────────────────────────
  font('bold', 14)
  ink(C.ink)
  const titleLines = doc.splitTextToSize(safe(campaign.taskTypeName), CW)
  doc.text(titleLines, ML, y)
  y += titleLines.length * 7 + 2

  // Metadata row — Requestor / Dept / Date / Status / Priority
  font('normal', 8)
  ink(C.sub)

  const metaLeft = [
    `Requested by:  ${safe(campaign.requestorName)}`,
    `Department:      ${safe(campaign.departmentName)}`,
    `Submitted:         ${fmtDate(campaign.createdAt)}`,
  ]
  const metaRight = [
    `Status:    ${(STATUS_LABEL[campaign.status] || safe(campaign.status)).replace('_', ' ')}`,
    `Priority:   ${safe(campaign.priority)}`,
  ]

  metaLeft.forEach((line, i) => {
    font('normal', 8); ink(C.sub); txt(line, ML, y + i * 5.5)
  })
  metaRight.forEach((line, i) => {
    font('normal', 8); ink(C.sub); txt(line, ML + CW / 2 + 5, y + i * 5.5)
  })
  y += 20

  rule(y)
  y += 8

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 1 — Campaign Details
  // ════════════════════════════════════════════════════════════════════════════
  section('Campaign Details')

  grid([
    { label: 'Task Type',   value: safe(campaign.taskTypeName) },
    { label: 'Business Objective', value: safe(campaign.businessObjective) },
    { label: 'Target Location',    value: safeLocation(campaign.targetLocation) },
    { label: 'Audience Type',      value: safeMulti(campaign.audienceName || campaign.audienceTypeId) },
    { label: 'Language',           value: safeMulti(campaign.language) },
    { label: 'Tone / Style',       value: safeMulti(campaign.tone) },
  ])

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 2 — Message & Offer
  // ════════════════════════════════════════════════════════════════════════════
  section('Message & Offer')

  textBlock('Key Message', campaign.keyMessage, true)

  grid([
    { label: 'Supporting Proof', value: safe(campaign.supportingProof) },
    { label: 'Has Offer',        value: safe(campaign.hasOffer) },
    { label: 'Offer Type',       value: safe(campaign.offerTypeId || campaign.offerTypeName) },
  ], 3)

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 3 — Budget & Goals
  // ════════════════════════════════════════════════════════════════════════════
  section('Budget & Goals')

  grid([
    { label: 'Budget Tier',     value: safe(campaign.budgetTier) },
    { label: 'KPI Type',        value: safe(campaign.kpiType) },
    { label: 'Expected Output', value: safe(campaign.expectedOutput) },
    { label: 'Vendor Required', value: safe(campaign.vendorRequired) },
    { label: 'Vendor Type',     value: safeMulti(campaign.vendorType) },
  ])

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 4 — Deliverables
  // ════════════════════════════════════════════════════════════════════════════
  const deliverables = campaign.deliverables || []
  if (deliverables.length) {
    section(`Deliverables  (${deliverables.length})`)

    deliverables.forEach((d, i) => {
      needY(8)

      // Bullet line
      fill(C.brand)
      doc.circle(ML + 2, y - 1, 1, 'F')

      font('normal', 8.5)
      ink(C.ink)
      txt(safe(d.granularTaskName || d.granularTaskId), ML + 7, y)

      // Status tag (right)
      if (d.workTaskStatus) {
        const dotC = STATUS_DOT[d.workTaskStatus] || C.muted
        fill(dotC)
        doc.circle(PW - MR - 20, y - 1.5, 1.2, 'F')
        font('normal', 7)
        ink(dotC)
        txt((TASK_LABEL[d.workTaskStatus] || d.workTaskStatus).replace('_', ' '), PW - MR - 17, y)
      }
      y += 6
    })
    y += 2
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 5 — Work Tasks
  // ════════════════════════════════════════════════════════════════════════════
  const tasks = (campaign.workTasks || []).filter(t => t.status !== 'CANCELLED')
  if (tasks.length) {
    section(`Work Tasks  (${tasks.length})`)

    tasks.forEach((t, idx) => {
      needY(24)

      const cardTop = y

      // Card background
      fill(C.surface)
      draw(C.rule)
      lw(0.2)
      doc.roundedRect(ML, y, CW, 8, 1, 1, 'FD')

      // Task name
      font('bold', 8.5)
      ink(C.ink)
      txt(safe(t.granularTaskName || 'Task'), ML + 4, y + 5.4)

      // Status dot + label (right)
      const dotC = STATUS_DOT[t.status] || C.muted
      fill(dotC)
      doc.circle(PW - MR - 24, y + 4, 1.4, 'F')
      font('bold', 7.5)
      ink(dotC)
      txt((TASK_LABEL[t.status] || t.status || '').replace('_', ' '), PW - MR - 21, y + 5.4)

      y += 11

      // Assignee
      font('normal', 7.5)
      ink(C.sub)
      txt(t.assigneeName ? `Assigned to: ${t.assigneeName}` : 'Unassigned', ML + 4, y)
      if (t.totalTimeLoggedMinutes != null) {
        txt(`${t.totalTimeLoggedMinutes} min logged`, PW - MR, y, { align: 'right' })
      }
      y += 5.5

      // Submission notes
      if (t.submissionNotes) {
        const snLines = doc.splitTextToSize(safe(t.submissionNotes), CW - 12)
        needY(snLines.length * 4.5 + 8)
        font('normal', 6.5); ink(C.muted)
        txt('SUBMISSION NOTES', ML + 4, y); y += 4
        font('normal', 8); ink(C.ink)
        doc.text(snLines, ML + 4, y)
        y += snLines.length * 4.5 + 3
      }

      // Task Q&A
      if (t.questionnaire?.length) {
        needY(10)
        font('bold', 6.5); ink(C.brand)
        txt('TASK QUESTIONNAIRE', ML + 4, y); y += 4.5

        t.questionnaire.forEach(qa => {
          needY(12)
          const qLines = doc.splitTextToSize(`Q  ${safe(qa.questionText)}`, CW - 14)
          font('bold', 7.5); ink(C.sub)
          doc.text(qLines, ML + 4, y)
          y += qLines.length * 4.2 + 1

          const aVal = qa.answerDisplay && qa.answerDisplay !== '—' ? qa.answerDisplay : '—'
          const aLines = doc.splitTextToSize(`A  ${aVal}`, CW - 14)
          font('normal', 8); ink(C.ink)
          doc.text(aLines, ML + 4, y)
          y += aLines.length * 4.2 + 4
        })
      }

      // Bottom border between cards
      if (idx < tasks.length - 1) {
        rule(y, C.rule); y += 5
      } else {
        y += 3
      }
    })
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 6 — Approval Trail (compact)
  // ════════════════════════════════════════════════════════════════════════════
  const hasApprovals = campaign.deptDecision || campaign.marketingDecision
  if (hasApprovals) {
    section('Approval Trail')

    const stages = [
      { label: 'Department Approval', decision: campaign.deptDecision,     by: campaign.deptDecisionByName,      at: campaign.deptDecisionAt },
      { label: 'Marketing Approval',  decision: campaign.marketingDecision, by: campaign.marketingDecisionByName, at: campaign.marketingDecisionAt },
      campaign.interventionDecision && { label: 'Intervention', decision: campaign.interventionDecision, by: campaign.interventionDecisionByName, at: campaign.interventionDecisionAt },
    ].filter(Boolean)

    stages.forEach(stage => {
      needY(9)

      const dc = stage.decision === 'APPROVED' ? C.green : stage.decision === 'REJECTED' ? C.red : C.muted

      // Decision dot
      fill(dc)
      doc.circle(ML + 2, y - 1, 1.5, 'F')

      font('normal', 8)
      ink(C.ink)
      txt(stage.label, ML + 7, y)

      font('bold', 8)
      ink(dc)
      txt(stage.decision || 'Pending', ML + 55, y)

      font('normal', 7.5)
      ink(C.muted)
      const detail = [stage.by && `${stage.by}`, stage.at && fmtDate(stage.at)].filter(Boolean).join('  •  ')
      txt(detail, PW - MR, y, { align: 'right' })
      y += 7
    })

    if (campaign.rejectionReason) {
      needY(14)
      textBlock('Rejection Reason', campaign.rejectionReason)
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Stamp footers on all pages
  // ════════════════════════════════════════════════════════════════════════════
  drawFooter()
  const total = doc.internal.getNumberOfPages()
  for (let p = 1; p < total; p++) {
    doc.setPage(p)
    font('normal', 6.5)
    ink(C.muted)
    txt(`Confidential  •  Generated ${fmtDateTime(new Date())}`, ML, PH - 9)
    txt(`Page ${p} of ${total}`, PW - MR, PH - 9, { align: 'right' })
  }
  // Fix last page footer with total
  doc.setPage(total)
  font('normal', 6.5)
  ink(C.muted)
  rule(PH - 14, C.rule)
  txt(`Confidential  •  Generated ${fmtDateTime(new Date())}`, ML, PH - 9)
  txt(`Page ${total} of ${total}`, PW - MR, PH - 9, { align: 'right' })

  const slug = (campaign.taskTypeName || 'Campaign').replace(/[^a-zA-Z0-9]+/g, '-')
  doc.save(`Brief-${campaign.campaignId}-${slug}.pdf`)
}
