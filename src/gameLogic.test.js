const test = require('node:test');
const assert = require('node:assert');
const { calculateResult } = require('./gameLogic');

test('detects row win', () => {
  const r = calculateResult(['X', 'X', 'X', null, 'O', 'O', null, null, null]);
  assert.strictEqual(r.winner, 'X');
});

test('detects draw', () => {
  const r = calculateResult(['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X']);
  assert.strictEqual(r.winner, 'draw');
});

test('ongoing game returns null', () => {
  assert.strictEqual(calculateResult(Array(9).fill(null)), null);
});
