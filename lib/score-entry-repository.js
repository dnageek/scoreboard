'use strict';

function literal(value) {
  return { $literal: value };
}

function plainReason(reason) {
  return reason.toObject ? reason.toObject() : { ...reason };
}

function buildAtomicEntryPipeline(entry, targetScore, reasons) {
  const currentScore = { $ifNull: ['$currentScore', 0] };
  const isReset = entry.reason === 'Manual reset' && entry.reasonId === null;
  const nextScore = isReset
    ? literal(targetScore)
    : { $add: [currentScore, literal(entry.scoreChange)] };
  const scoreChange = isReset
    ? { $subtract: [literal(targetScore), currentScore] }
    : literal(entry.scoreChange);
  const storedEntry = {
    id: literal(entry.id),
    timestamp: literal(entry.timestamp),
    reason: literal(entry.reason),
    scoreChange,
    newScore: nextScore,
    reasonId: literal(entry.reasonId)
  };
  const set = {
    currentScore: nextScore,
    history: {
      $concatArrays: [
        { $ifNull: ['$history', []] },
        [storedEntry]
      ]
    },
    lastUpdated: '$$NOW'
  };

  if (reasons) {
    set.reasons = literal(reasons.map(plainReason));
  }

  return [{ $set: set }];
}

function createScoreEntryRepository(ScoreBoard) {
  async function append({ syncId, entry, targetScore, reasons }) {
    const board = await ScoreBoard.findOneAndUpdate(
      { syncId, 'history.id': { $ne: entry.id } },
      buildAtomicEntryPipeline(entry, targetScore, reasons),
      {
        new: true,
        projection: { currentScore: 1, history: { $slice: -1 } }
      }
    );

    if (board) {
      const storedEntry = board.history && board.history[board.history.length - 1];
      return { boardFound: true, duplicate: false, entry: storedEntry, currentScore: board.currentScore };
    }

    const existing = await ScoreBoard.findOne(
      { syncId, 'history.id': entry.id },
      { currentScore: 1, history: { $elemMatch: { id: entry.id } } }
    );
    if (existing) {
      return {
        boardFound: true,
        duplicate: true,
        entry: existing.history && existing.history[0],
        currentScore: existing.currentScore
      };
    }

    return { boardFound: false, duplicate: false };
  }

  async function getSummary(syncId) {
    return ScoreBoard.findOne({ syncId }, { currentScore: 1, reasons: 1 }).lean();
  }

  async function getHistory(syncId, limit = 10) {
    return ScoreBoard.findOne(
      { syncId },
      { currentScore: 1, history: { $slice: -limit } }
    ).lean();
  }

  return { append, getHistory, getSummary };
}

module.exports = { buildAtomicEntryPipeline, createScoreEntryRepository };
