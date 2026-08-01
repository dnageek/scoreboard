'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAtomicEntryPipeline, createScoreEntryRepository } = require('../lib/score-entry-repository');

function sampleEntry(overrides = {}) {
  return {
    id: 'entry-1',
    timestamp: new Date('2026-07-31T12:00:00.000Z'),
    reason: 'Telegram: workout',
    scoreChange: 5,
    reasonId: null,
    ...overrides
  };
}

test('atomic entry pipeline derives the next score from the stored MongoDB value', () => {
  const pipeline = buildAtomicEntryPipeline(sampleEntry(), 5);
  const set = pipeline[0].$set;

  assert.deepEqual(set.currentScore, {
    $add: [{ $ifNull: ['$currentScore', 0] }, { $literal: 5 }]
  });
  assert.deepEqual(set.history.$concatArrays[1][0].newScore, set.currentScore);
  assert.equal(set.lastUpdated, '$$NOW');
});

test('atomic reset pipeline sets the target and calculates the reset delta in MongoDB', () => {
  const pipeline = buildAtomicEntryPipeline(sampleEntry({
    reason: 'Manual reset', reasonId: null, scoreChange: 0
  }), 4);
  const storedEntry = pipeline[0].$set.history.$concatArrays[1][0];

  assert.deepEqual(pipeline[0].$set.currentScore, { $literal: 4 });
  assert.deepEqual(storedEntry.scoreChange, {
    $subtract: [{ $literal: 4 }, { $ifNull: ['$currentScore', 0] }]
  });
});

test('append filters by entry ID and returns a newly stored result', async () => {
  let receivedFilter;
  const model = {
    async findOneAndUpdate(filter) {
      receivedFilter = filter;
      return { currentScore: 8, history: [{ id: 'entry-1', newScore: 8 }] };
    },
    findOne() { throw new Error('duplicate lookup should not run'); }
  };
  const repository = createScoreEntryRepository(model);

  const result = await repository.append({ syncId: 'board', entry: sampleEntry(), targetScore: 8 });

  assert.deepEqual(receivedFilter, { syncId: 'board', 'history.id': { $ne: 'entry-1' } });
  assert.equal(result.duplicate, false);
  assert.equal(result.currentScore, 8);
});

test('entry retries are idempotent when MongoDB already contains the entry ID', async () => {
  const model = {
    async findOneAndUpdate() { return null; },
    async findOne() { return { currentScore: 8, history: [{ id: 'entry-1', newScore: 8 }] }; }
  };
  const repository = createScoreEntryRepository(model);

  const result = await repository.append({ syncId: 'board', entry: sampleEntry(), targetScore: 8 });

  assert.equal(result.boardFound, true);
  assert.equal(result.duplicate, true);
  assert.equal(result.entry.id, 'entry-1');
  assert.equal(result.currentScore, 8);
});

test('concurrent score updates use the stored score instead of a stale client score', () => {
  const first = buildAtomicEntryPipeline(sampleEntry({ id: 'first', scoreChange: 2 }), 2);
  const second = buildAtomicEntryPipeline(sampleEntry({ id: 'second', scoreChange: 3 }), 3);

  assert.equal(first[0].$set.currentScore.$add[0].$ifNull[0], '$currentScore');
  assert.equal(second[0].$set.currentScore.$add[0].$ifNull[0], '$currentScore');
});
