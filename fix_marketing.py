import sys

file_path = '/home/developer/rohitworkspace/prod/marketing-automation/marketing-automation-frontend/src/pages/approvals/MarketingApprovalPage.jsx'

with open(file_path, 'r', encoding='latin-1') as f:
    content = f.read()

content = content.replace(
  "import { EmptyState, ActionModal, HistoryTable } from './DeptApprovalPage'",
  "import { EmptyState, ActionModal, HistoryTable } from './DeptApprovalPage'\nimport ActionMenu, { ActionMenuItem } from '../../components/ActionMenu'"
)

old_buttons = """<div className="flex items-center gap-2 ml-3 shrink-0">
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
              ? <><Icon name="refresh" className="h-3.5 w-3.5 animate-spin" /> Checking</>
              : <><Icon name="check" className="h-3.5 w-3.5" /> Approve & Route</>}
          </button>
        </div>"""

new_buttons = """<div className="flex items-center gap-2 ml-3 shrink-0 flex-wrap justify-end">
          <button
            onClick={onReject}
            title="Reject"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
          <button
            onClick={onApprove}
            disabled={checkingCapacity}
            title="Approve & Route"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition disabled:opacity-60"
          >
            {checkingCapacity
              ? <Icon name="refresh" className="h-4 w-4 animate-spin" />
              : <Icon name="check" className="h-4 w-4" />
            }
          </button>
          <ActionMenu align="right">
            <ActionMenuItem icon="eye" label="View Brief" onClick={onViewBrief} />
          </ActionMenu>
        </div>"""

content = content.replace(old_buttons, new_buttons)

with open(file_path, 'w', encoding='latin-1') as f:
    f.write(content)

print('done')
