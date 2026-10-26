import test from 'node:test';
import assert from 'node:assert/strict';
test('harness auth',()=>assert.equal(typeof process.env.NODE_ENV,'string'));
