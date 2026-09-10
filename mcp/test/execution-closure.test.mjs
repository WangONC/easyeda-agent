import { test } from 'node:test';
import { interpret } from '../src/execution.generated.mjs';
import { authoringResult } from '../src/authoring-result.mjs';
import closure from '../../scripts/execution-closure-properties.cjs';
test('Closure Repair 01 finite implications and MCP canonical metadata', () => { closure.run(interpret,authoringResult); });
