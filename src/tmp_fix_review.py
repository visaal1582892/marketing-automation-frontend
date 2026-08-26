import os

filepath = '/home/developer/rohitworkspace/prod/marketing-automation/marketing-automation-frontend/src/pages/manager/ManagerQcReviewPage.jsx'

with open(filepath, 'r') as f:
    content = f.read()

# FlatTaskCard remove reject
content = content.replace("              onReject={()   => open(t, 'REJECTED')}\n", "")
content = content.replace(", onReject", "")

reject_btn = """            <button onClick={onReject}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition">
              <Icon name="x" className="h-3.5 w-3.5" /> Reject
            </button>\n"""
content = content.replace(reject_btn, "")

# TaskRow remove reject
content = content.replace("            onReject={()  => onReject(t)}\n", "")

# ReviewModal labels
content = content.replace("const labels = { APPROVED: 'Approve & Deliver', NEEDS_REWORK: 'Send for Rework', REJECTED: 'Reject Task' }", "const labels = { APPROVED: 'Approve & Deliver', NEEDS_REWORK: 'Send for Rework' }")
content = content.replace("""  const tones = {
    APPROVED:     'bg-green-600 hover:bg-green-700',
    NEEDS_REWORK: 'bg-amber-600 hover:bg-amber-700',
    REJECTED:     'bg-red-600  hover:bg-red-700',
  }""", """  const tones = {
    APPROVED:     'bg-green-600 hover:bg-green-700',
    NEEDS_REWORK: 'bg-amber-600 hover:bg-amber-700',
  }""")

content = content.replace("""  const isReject = action === 'REJECTED'
  const openSiblings = (campaign?.workTasks || []).filter(w =>
    w.taskId !== task.taskId &&
    w.status !== 'CANCELLED' &&
    w.status !== 'COMPLETED' &&
    w.status !== 'REQUESTOR_QC_REVIEW'
  ).length
  const wouldCloseSibs = isReject && openSiblings > 0""", "")

content = content.replace("""          {wouldCloseSibs && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 flex items-start gap-2">
              <Icon name="alertCircle" className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>
                Heads up — rejecting this deliverable will <b>close the entire
                campaign</b> and cancel {openSiblings} other open task{openSiblings === 1 ? '' : 's'}
                {' '}on it. Use "Rework" if you only want this single deliverable redone.
              </span>
            </div>
          )}""", "")

content = content.replace("""            <ActionRadio v="REJECTED"     active={action} setActive={setAction} label="Reject" />\n""", "")
content = content.replace("""          <div className="grid grid-cols-3 gap-1">""", """          <div className="grid grid-cols-2 gap-1">""")

content = content.replace("level.status === 'REJECTED' ? 'bg-red-500'", "level.status === 'REWORK' ? 'bg-amber-500'")

with open(filepath, 'w') as f:
    f.write(content)
