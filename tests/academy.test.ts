import test from 'node:test';import assert from 'node:assert/strict';import { gradeAttempt } from '../src/lib/academy';
test('gradeAttempt is exported',()=>assert.equal(typeof gradeAttempt,'function'));
