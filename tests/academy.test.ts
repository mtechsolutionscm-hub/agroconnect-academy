import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeAttempt } from '../src/lib/academy';
test('gradeAttempt retourne un résultat',()=>assert.equal(gradeAttempt('f1',{}).courseId,'f1'));
