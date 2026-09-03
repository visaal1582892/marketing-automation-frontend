file_path = '/home/developer/rohitworkspace/prod/marketing-automation/marketing-automation-frontend/src/pages/approvals/MarketingApprovalPage.jsx'

with open(file_path, 'r', encoding='latin-1') as f:
    content = f.read()

# Add import if missing
if "import ActionMenu" not in content:
    content = content.replace(
      "import { EmptyState, ActionModal, HistoryTable } from './DeptApprovalPage'",
      "import { EmptyState, ActionModal, HistoryTable } from './DeptApprovalPage'\nimport ActionMenu, { ActionMenuItem } from '../../components/ActionMenu'"
    )

old_buttons = """        <div className="flex items-center gap-2 ml-3 shrink-0">
          <button
            onClick={onViewBrief}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 transition flex items-center gap-1"
            title="View full request brief"
          >
            <Icon name="eye" className="h-3.5 w-3.5" />
            Brief
          </button>
          <button
            onClick={onReject}
            className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition flex items-center gap-1"
          >
            <Icon name="x" className="h-3.5 w-3.5" /> Reject
          </button>
          <button
            onClick={onApprove}
            disabled={checkingCapacity}
            className="rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 transition disabled:opacity-60 flex items-center gap-1"
          >
            {checkingCapacity
              ? <><Icon name="refresh" className="h-3.5 w-3.5 animate-spin" /> Checking…</>
              : <><Icon name="check" className="h-3.5 w-3.5" /> Approve &amp; Route</>}
          </button>
        </div>"""

new_buttons = """        <div className="flex items-center gap-2 ml-3 shrink-0 flex-wrap justify-end">
          <button
            onClick={onReject}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
          >
            <Icon name="x" className="h-3.5 w-3.5" /> Reject
          </button>
          <button
            onClick={onApprove}
            disabled={checkingCapacity}
            className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 hover:bg-green-100 transition disabled:opacity-60"
          >
            {checkingCapacity
              ? <><Icon name="refresh" className="h-3.5 w-3.5 animate-spin" /> Checking…</>
              : <><Icon name="check" className="h-3.5 w-3.5" /> Approve &amp; Route</>}
          </button>
          <ActionMenu align="right">
            <ActionMenuItem icon="eye" label="View Brief" onClick={onViewBrief} />
          </ActionMenu>
        </div>"""

if old_buttons in content:
    content = content.replace(old_buttons, new_buttons)
    with open(file_path, 'w', encoding='latin-1') as f:
        f.write(content)
    print('Successfully updated MarketingApprovalPage.jsx')
else:
    print('old_buttons not found, let us check content...')
