'use strict';

const MAX_REASON_ORDER_SIZE = 10000;

function cleanText(value, maxLength = 500) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function sanitizeReason(reason) {
  if (!reason || typeof reason !== 'object') return null;

  const id = cleanText(reason.id, 80);
  const text = cleanText(reason.text, 300);
  const score = reason.score;
  const type = reason.type === 'subtract' ? 'subtract' : 'add';

  if (!id || !text || !isFiniteNumber(score) || score <= 0) {
    return null;
  }

  return { id, text, score, type };
}

function applyReasonOrder(scoreBoard, reasonOrder) {
  if (reasonOrder === undefined) return true;
  if (!Array.isArray(reasonOrder) || reasonOrder.length > MAX_REASON_ORDER_SIZE) return false;

  const sanitizedOrder = reasonOrder.map(id => cleanText(id, 80));
  const reasonById = new Map((scoreBoard.reasons || []).map(reason => [reason.id, reason]));

  if (
    sanitizedOrder.some(id => !id || !reasonById.has(id)) ||
    new Set(sanitizedOrder).size !== reasonById.size ||
    sanitizedOrder.length !== reasonById.size
  ) {
    return false;
  }

  scoreBoard.reasons = sanitizedOrder.map(id => reasonById.get(id));
  return true;
}

function sanitizeHistoryEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;

  const id = cleanText(entry.id, 80);
  const reason = cleanText(entry.reason, 500);
  const scoreChange = entry.scoreChange;
  const timestamp = entry.timestamp ? new Date(entry.timestamp) : new Date();
  const reasonId = entry.reasonId ? cleanText(entry.reasonId, 80) : null;

  if (!id || !reason || !isFiniteNumber(scoreChange) || Number.isNaN(timestamp.getTime())) {
    return null;
  }

  const sanitized = { id, timestamp, reason, scoreChange, reasonId };
  if (isFiniteNumber(entry.newScore)) sanitized.newScore = entry.newScore;
  return sanitized;
}

function isManualResetEntry(entry) {
  return entry.reason === 'Manual reset' && entry.reasonId === null && isFiniteNumber(entry.newScore);
}

function synchronizeBoardHistory(scoreBoard) {
  const sortedHistory = [...(scoreBoard.history || [])].sort((a, b) => (
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  ));

  if (sortedHistory.length === 0) {
    scoreBoard.history = [];
    scoreBoard.currentScore = 0;
    return;
  }

  let runningScore = 0;
  scoreBoard.history = sortedHistory.map(entry => {
    const nextEntry = entry.toObject ? entry.toObject() : { ...entry };

    if (isManualResetEntry(nextEntry)) {
      nextEntry.scoreChange = nextEntry.newScore - runningScore;
      runningScore = nextEntry.newScore;
    } else {
      runningScore += nextEntry.scoreChange;
      nextEntry.newScore = runningScore;
    }

    return nextEntry;
  });
  scoreBoard.currentScore = runningScore;
}

function applyEntryToBoard(scoreBoard, rawEntry, targetScore, reasonOrder) {
  const sanitizedEntry = sanitizeHistoryEntry(rawEntry);
  if (!sanitizedEntry || !isFiniteNumber(targetScore)) {
    return { ok: false, message: 'A valid history entry and current score are required' };
  }
  if (!applyReasonOrder(scoreBoard, reasonOrder)) {
    return { ok: false, message: 'The reason order is invalid' };
  }

  const isResetEntry = sanitizedEntry.reason === 'Manual reset' && sanitizedEntry.reasonId === null;
  const previousScore = scoreBoard.currentScore;
  const entryToStore = { ...sanitizedEntry };

  if (isResetEntry) {
    entryToStore.scoreChange = targetScore - previousScore;
    entryToStore.newScore = targetScore;
    scoreBoard.currentScore = targetScore;
  } else {
    scoreBoard.currentScore += entryToStore.scoreChange;
    entryToStore.newScore = scoreBoard.currentScore;
  }

  const history = scoreBoard.history || (scoreBoard.history = []);
  const previousEntry = history[history.length - 1];
  const isChronologicalAppend = !previousEntry ||
    new Date(entryToStore.timestamp).getTime() >= new Date(previousEntry.timestamp).getTime();

  history.push(entryToStore);
  if (!isChronologicalAppend) synchronizeBoardHistory(scoreBoard);

  return { ok: true, entryToStore, isChronologicalAppend };
}

module.exports = {
  applyEntryToBoard,
  applyReasonOrder,
  cleanText,
  isFiniteNumber,
  sanitizeHistoryEntry,
  sanitizeReason,
  synchronizeBoardHistory
};
