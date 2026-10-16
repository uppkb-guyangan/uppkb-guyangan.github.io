import test from 'node:test';
import assert from 'node:assert/strict';
import { simulationStatus } from './fixtures/gita-simulation.mjs';
test('synthetic status normalizes whitespace, casing and missing input', () => {
  assert.equal(simulationStatus(' terbayar '), 'TERBAYAR');
  assert.equal(simulationStatus(null), '');
});
