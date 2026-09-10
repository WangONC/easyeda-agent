import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { interpret } from '../src/execution.generated.mjs';
import { authoringResult } from '../src/authoring-result.mjs';
import properties from '../../scripts/execution-evidence-properties.cjs';
test('R4 inventory-driven independent semantic oracle and MCP canonical projection', () => { properties.run(interpret, authoringResult); });

test('actual preview receipts retain canonical evidence at MCP exit', () => {
 const cases=JSON.parse(execFileSync(process.execPath,['../scripts/execution-preview-fixtures.cjs'],{encoding:'utf8'}));
 properties.runCases(cases,interpret,authoringResult);
});
