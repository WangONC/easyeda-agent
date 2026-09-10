import { test } from 'node:test';
import { interpret } from './execution';
const closure = require('../../scripts/execution-closure-properties.cjs');
test('Closure Repair 01 frozen finite implications and repeated interpretation', () => { closure.run(interpret); });
