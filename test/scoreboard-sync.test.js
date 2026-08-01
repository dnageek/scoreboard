'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applyEntryToBoard,
  applyReasonOrder,
  sanitizeHistoryEntry,
  sanitizeReason,
  synchronizeBoardHistory
} = require('../lib/scoreboard-sync');

function entry(id, timestamp, scoreChange, overrides = {}) {
  return {
    id,
    timestamp,
    reason: 'Test reason',
    scoreChange,
    reasonId: 'reason-1',
    ...overrides
  };
}

test('sanitizeReason normalizes text and reason type', () => {
  assert.deepEqual(
    sanitizeReason({ id: ' reason-1 ', text: ' Example ', score: 4, type: 'subtract' }),
    { id: 'reason-1', text: 'Example', score: 4, type: 'subtract' }
  );
  assert.equal(sanitizeReason({ id: 'reason-1', text: '', score: 4 }), null);
  assert.equal(sanitizeReason({ id: 'reason-1', text: 'Example', score: 0 }), null);
});

test('sanitizeHistoryEntry rejects invalid timestamps and scores', () => {
  assert.equal(sanitizeHistoryEntry(entry('entry-1', 'not-a-date', 2)), null);
  assert.equal(sanitizeHistoryEntry(entry('entry-1', '2026-01-01T00:00:00.000Z', NaN)), null);
});

test('applyReasonOrder reorders every reason while preserving reason objects', () => {
  const first = { id: 'first' };
  const second = { id: 'second' };
  const board = { reasons: [first, second] };

  assert.equal(applyReasonOrder(board, ['second', 'first']), true);
  assert.deepEqual(board.reasons, [second, first]);
});

test('applyReasonOrder rejects incomplete, duplicate, and unknown orders without mutation', () => {
  for (const invalidOrder of [['first'], ['first', 'first'], ['first', 'unknown']]) {
    const reasons = [{ id: 'first' }, { id: 'second' }];
    const board = { reasons };

    assert.equal(applyReasonOrder(board, invalidOrder), false);
    assert.equal(board.reasons, reasons);
  }
});

test('synchronizeBoardHistory sorts entries and recalculates running scores', () => {
  const board = {
    currentScore: 99,
    history: [
      entry('later', '2026-01-02T00:00:00.000Z', -2),
      entry('earlier', '2026-01-01T00:00:00.000Z', 5)
    ]
  };

  synchronizeBoardHistory(board);

  assert.deepEqual(board.history.map(item => item.id), ['earlier', 'later']);
  assert.deepEqual(board.history.map(item => item.newScore), [5, 3]);
  assert.equal(board.currentScore, 3);
});

test('synchronizeBoardHistory preserves manual reset targets', () => {
  const board = {
    currentScore: 0,
    history: [
      entry('add', '2026-01-01T00:00:00.000Z', 5),
      entry('reset', '2026-01-02T00:00:00.000Z', 0, {
        reason: 'Manual reset', reasonId: null, newScore: 2
      }),
      entry('after', '2026-01-03T00:00:00.000Z', 4)
    ]
  };

  synchronizeBoardHistory(board);

  assert.equal(board.history[1].scoreChange, -3);
  assert.deepEqual(board.history.map(item => item.newScore), [5, 2, 6]);
  assert.equal(board.currentScore, 6);
});

test('applyEntryToBoard keeps chronological appends on the fast path', () => {
  const existing = entry('existing', '2026-01-01T00:00:00.000Z', 3, { newScore: 3 });
  const history = [existing];
  const board = { currentScore: 3, history, reasons: [] };

  const result = applyEntryToBoard(
    board,
    entry('new', '2026-01-02T00:00:00.000Z', 4),
    7
  );

  assert.equal(result.ok, true);
  assert.equal(result.isChronologicalAppend, true);
  assert.equal(board.history, history);
  assert.equal(board.currentScore, 7);
  assert.equal(board.history[1].newScore, 7);
});

test('applyEntryToBoard reconciles out-of-order entries', () => {
  const board = {
    currentScore: 3,
    history: [entry('later', '2026-01-02T00:00:00.000Z', 3, { newScore: 3 })],
    reasons: []
  };

  const result = applyEntryToBoard(
    board,
    entry('earlier', '2026-01-01T00:00:00.000Z', 2),
    5
  );

  assert.equal(result.ok, true);
  assert.equal(result.isChronologicalAppend, false);
  assert.deepEqual(board.history.map(item => item.id), ['earlier', 'later']);
  assert.deepEqual(board.history.map(item => item.newScore), [2, 5]);
  assert.equal(board.currentScore, 5);
});

test('applyEntryToBoard computes manual reset changes from the server score', () => {
  const board = { currentScore: 10, history: [], reasons: [] };

  const result = applyEntryToBoard(
    board,
    entry('reset', '2026-01-01T00:00:00.000Z', 0, {
      reason: 'Manual reset', reasonId: null, newScore: 4
    }),
    4
  );

  assert.equal(result.ok, true);
  assert.equal(result.entryToStore.scoreChange, -6);
  assert.equal(result.entryToStore.newScore, 4);
  assert.equal(board.currentScore, 4);
});

test('applyEntryToBoard rejects invalid input without changing score or history', () => {
  const history = [];
  const board = { currentScore: 3, history, reasons: [] };

  const result = applyEntryToBoard(board, entry('', '2026-01-01T00:00:00.000Z', 2), 5);

  assert.equal(result.ok, false);
  assert.equal(board.currentScore, 3);
  assert.equal(board.history, history);
  assert.deepEqual(board.history, []);
});

test.todo('the incremental queue pauses and performs a health check after a network failure');
