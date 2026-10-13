const fs = require('fs');
const file = 'src/pages/budget/BudgetProposalListPage.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/import \{ budgetTopupApi \} from "\.\.\/\.\.\/api\/budgetTopup";\n/g, '');

content = content.replace(/\/\/ TopUp Dialog State[\s\S]*?const \[masterQuarters, setMasterQuarters\] = useState\(\[\]\);\n/g, '');

content = content.replace(/, budgetMasterDataApi\.getPeriods\("QUARTER"\)/g, '');
content = content.replace(/, qRes/g, '');
content = content.replace(/const now = new Date\(\);[\s\S]*?setMasterQuarters\(validQuarters\);\n/g, '');

content = content.replace(/\{\/\* TopUp Request Modal \*\/\}[\s\S]*?<\/Modal>\n/g, '');

fs.writeFileSync(file, content);
console.log('Patched');
