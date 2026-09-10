process.env.TS_NODE_PROJECT=require('node:path').join(__dirname,'../extension/tsconfig.json');
require('../extension/node_modules/ts-node/register');
require('../extension/src/execution-preview-fixtures').previewFixtures().then(c=>process.stdout.write(JSON.stringify(require('./execution-evidence-properties.cjs').previewCases(c)))).catch(e=>{console.error(e);process.exitCode=1;});
