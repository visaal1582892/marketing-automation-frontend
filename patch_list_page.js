const fs = require('fs');
const file = 'src/pages/budget/BudgetProposalListPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// Remove import { budgetTopupApi } from "../../api/budgetTopup";
content = content.replace(/import \{ budgetTopupApi \} from "\.\.\/\.\.\/api\/budgetTopup";\n/g, '');

// Remove TopUp Dialog State
content = content.replace(/\/\/ TopUp Dialog State[\s\S]*?const \[masterQuarters, setMasterQuarters\] = useState\(\[\]\);\n/g, '');

// In loadMasterData, remove masterQuarters fetch
content = content.replace(/, budgetMasterDataApi\.getPeriods\("QUARTER"\),?/g, '');
content = content.replace(/, qRes/g, '');
content = content.replace(/const validQuarters = \(qRes \|\| \[\]\)\.filter\([\s\S]*?setMasterQuarters\(validQuarters\);\n/g, '');

// Remove TopUp Request Modal
content = content.replace(/\{\/\* TopUp Request Modal \*\/\}[\s\S]*?<\/Modal>\n/g, '');

// Remove unused state processing, actionDialog etc? No, actionDialog is used for Delete Draft Proposal.
// But wait, the topupDialog state was already removed above.

// Write back
fs.writeFileSync(file, content);
console.log('Patched');
