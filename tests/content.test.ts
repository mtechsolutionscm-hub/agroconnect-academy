import test from 'node:test';
import assert from 'node:assert/strict';
import { formationIds, loadCourse } from '../src/lib/content';
test('les modules sont chargés à partir des fichiers de contenu',()=>{assert.ok(Array.isArray(formationIds()));assert.equal(loadCourse('../.env'),null)});
