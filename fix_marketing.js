const fs = require('fs');
const file = '/home/developer/rohitworkspace/prod/marketing-automation/marketing-automation-frontend/src/pages/approvals/MarketingApprovalPage.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "import { EmptyState, ActionModal, HistoryTable } from './DeptApprovalPage'",
  "import { EmptyState, ActionModal, HistoryTable } from './DeptApprovalPage'\nimport ActionMenu, { ActionMenuItem } from '../../components/ActionMenu'"
);

const oldButtons = `<div className="flex items-center gap-2 ml-3 shrink-0">
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
        </div>`;

const newButtons = `<div className="flex items-center gap-2 ml-3 shrink-0 flex-wrap justify-end">
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
        </div>`;

content = content.replace(oldButtons, newButtons);
fs.writeFileSync(file, content, 'utf8');
console.log('done');
