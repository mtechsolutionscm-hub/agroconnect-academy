import test from 'node:test';import assert from 'node:assert/strict';import { formationIds, loadCourse } from '../src/lib/content';
test('18 contenus de formation présents',()=>{assert.equal(formationIds().length,18);assert.ok(loadCourse('f1'));assert.ok(loadCourse('f18'));});
