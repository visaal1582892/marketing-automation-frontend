const fs = require('fs');
const file = 'src/pages/budget/BudgetProposalListPage.jsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  'const [openMenuId, setOpenMenuId] = useState(null);',
  'const [openMenuId, setOpenMenuId] = useState(null);\n  const [expandedRows, setExpandedRows] = useState({});\n  const toggleRow = (id) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));'
);

code = code.replace(
  'const getStatusBadge = (status) => {',
  `const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

  const getProposalTypeBadge = (type) => {
    if (type === 'TOP_UP') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200 uppercase tracking-wide">
          <Icon name="arrowUpRight" className="h-3 w-3" /> Top-Up
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wide">
        Initial Budget
      </span>
    );
  };

  const getStatusBadge = (status) => {`
);

code = code.replace(
  '<span className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Financial Year</span>',
  '<span className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Period</span>'
);

fs.writeFileSync(file, code);
