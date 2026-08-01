'use strict';

const crypto = require('crypto');

const MAX_ADJUSTMENT = 1000000;
const HISTORY_LIMIT = 10;
const UNDO_LOOKBACK = 50;
const SUPPORTED_CHAT_TYPES = new Set(['private', 'group', 'supergroup']);

function parseAllowedUserIds(value) {
  const ids = new Set();
  for (const rawId of String(value || '').split(',')) {
    const id = rawId.trim();
    if (!id) continue;
    if (!/^\d+$/.test(id)) throw new Error('TELEGRAM_ALLOWED_USER_IDS must contain numeric IDs');
    ids.add(id);
  }
  if (ids.size === 0) throw new Error('TELEGRAM_ALLOWED_USER_IDS must not be empty');
  return ids;
}

function parseReadyChatIds(value, fallbackIds) {
  if (!value) return new Set(fallbackIds);
  const ids = new Set();
  for (const rawId of String(value).split(',')) {
    const id = rawId.trim();
    if (!id) continue;
    if (!/^-?\d+$/.test(id) || id === '0' || id === '-0') {
      throw new Error('TELEGRAM_READY_CHAT_IDS must contain numeric chat IDs');
    }
    ids.add(id);
  }
  if (ids.size === 0) throw new Error('TELEGRAM_READY_CHAT_IDS must not be empty');
  return ids;
}

function parseBoardIds(defaultBoardId, value) {
  const boardIds = String(value || defaultBoardId || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);
  if (defaultBoardId && !boardIds.includes(defaultBoardId)) boardIds.unshift(defaultBoardId);
  const uniqueBoardIds = [...new Set(boardIds)];
  if (uniqueBoardIds.length === 0 || uniqueBoardIds.some(id => !/^[A-Za-z0-9_-]{1,64}$/.test(id))) {
    throw new Error('TELEGRAM_BOARD_IDS contains an invalid board ID');
  }
  return uniqueBoardIds;
}

function loadTelegramConfig(env) {
  const keys = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'TELEGRAM_BOARD_ID', 'PUBLIC_BASE_URL'];
  const telegramKeys = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'TELEGRAM_BOARD_ID', 'TELEGRAM_BOARD_IDS', 'TELEGRAM_ALLOWED_USER_IDS', 'TELEGRAM_READY_CHAT_IDS'];
  if (!telegramKeys.some(key => env[key])) return null;
  for (const key of keys) {
    if (!env[key]) throw new Error(`${key} is required when Telegram is enabled`);
  }
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(env.TELEGRAM_BOARD_ID)) {
    throw new Error('TELEGRAM_BOARD_ID is invalid');
  }
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(env.TELEGRAM_WEBHOOK_SECRET)) {
    throw new Error('TELEGRAM_WEBHOOK_SECRET contains unsupported characters');
  }
  const baseUrl = env.PUBLIC_BASE_URL.replace(/\/$/, '');
  if (!/^https:\/\//.test(baseUrl)) throw new Error('PUBLIC_BASE_URL must use HTTPS');
  const allowedUserIds = parseAllowedUserIds(env.TELEGRAM_ALLOWED_USER_IDS);
  return {
    token: env.TELEGRAM_BOT_TOKEN,
    webhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
    boardId: env.TELEGRAM_BOARD_ID,
    boardIds: parseBoardIds(env.TELEGRAM_BOARD_ID, env.TELEGRAM_BOARD_IDS),
    baseUrl,
    allowedUserIds,
    readyChatIds: parseReadyChatIds(env.TELEGRAM_READY_CHAT_IDS, allowedUserIds)
  };
}

function safeSecretEqual(received, expected) {
  if (typeof received !== 'string' || typeof expected !== 'string') return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function parseCommand(text, botUsername = '') {
  if (typeof text !== 'string' || !text.startsWith('/')) return null;
  const [head, ...parts] = text.trim().split(/\s+/);
  const [rawName, target = ''] = head.slice(1).split('@');
  if (target && target.toLowerCase() !== botUsername.toLowerCase()) return null;
  const name = rawName.toLowerCase();
  if (!['start', 'help', 'status', 'score', 'scores', 'history', 'undo', 'reasons', 'boards', 'board', 'add', 'subtract'].includes(name)) return null;
  if (name === 'board') return { name, boardId: parts.shift() || '' };
  if (name !== 'add' && name !== 'subtract') return { name };
  const amount = Number(parts.shift());
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_ADJUSTMENT) {
    return { name, error: `Amount must be a whole number from 1 to ${MAX_ADJUSTMENT}.` };
  }
  return { name, amount, description: parts.join(' ').trim() };
}

function reasonKey(reasonId) {
  return crypto.createHash('sha256').update(String(reasonId)).digest('base64url').slice(0, 16);
}

function boardKey(boardId) {
  return reasonKey(boardId);
}

function boardKeyboard(boardIds, selectedBoardId) {
  return {
    inline_keyboard: boardIds.map(boardId => [{
      text: `${boardId === selectedBoardId ? '✓ ' : ''}${boardId}`,
      callback_data: `b:${boardKey(boardId)}`
    }])
  };
}

function reasonKeyboard(reasons, boardId) {
  const buttons = reasons.map(reason => ({
    text: `${reason.type === 'subtract' ? '−' : '+'}${reason.score} ${reason.text}`,
    callback_data: `r:${boardKey(boardId)}:${reasonKey(reason.id)}`
  }));
  const rows = [];
  for (let index = 0; index < buttons.length; index += 2) rows.push(buttons.slice(index, index + 2));
  return { inline_keyboard: rows };
}

function undoKeyboard(boardId, entryId) {
  const suffix = `${boardKey(boardId)}:${reasonKey(entryId)}`;
  return {
    inline_keyboard: [[
      { text: 'Undo change', callback_data: `u:${suffix}` },
      { text: 'Cancel', callback_data: `uc:${suffix}` }
    ]]
  };
}

function formatUptime(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds % 86400 / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  if (days) return `${days}d ${hours}h ${minutes}m`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function createTelegramApi(token, fetchImpl = globalThis.fetch) {
  async function call(method, payload) {
    const response = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000)
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(`Telegram ${method} failed: ${result.description || response.status}`);
    return result.result;
  }
  return {
    answerCallbackQuery: payload => call('answerCallbackQuery', payload),
    getMe: () => call('getMe', {}),
    sendMessage: payload => call('sendMessage', payload),
    setWebhook: payload => call('setWebhook', payload)
  };
}

function createTelegramBot({ config, repository, preferences, api, statusProvider = () => ({}), logger = console }) {
  let botUsername = '';
  let identityPromise = null;
  const help = [
    'Scoreboard commands:',
    '/status — show server status',
    '/score — show the current score',
    '/scores — show scores from all boards',
    '/history — show recent score changes',
    '/undo — reverse the latest score change',
    '/boards — choose a scoreboard',
    '/board board-id — select a scoreboard',
    '/reasons — choose a configured reason',
    '/add 5 optional note',
    '/subtract 2 optional note'
  ].join('\n');

  async function send(chatId, text, extra = {}) {
    return api.sendMessage({ chat_id: chatId, text, ...extra });
  }

  async function ensureIdentity() {
    if (botUsername) return botUsername;
    if (!identityPromise) {
      identityPromise = api.getMe()
        .then(me => {
          botUsername = me.username || '';
          return botUsername;
        })
        .finally(() => {
          identityPromise = null;
        });
    }
    return identityPromise;
  }

  async function selectedBoard(chatId) {
    const storedBoardId = await preferences.get(chatId);
    return config.boardIds.includes(storedBoardId) ? storedBoardId : config.boardId;
  }

  async function selectBoard(chatId, boardId) {
    if (!config.boardIds.includes(boardId)) {
      return send(chatId, 'That scoreboard is not available to this bot.');
    }
    const board = await repository.getSummary(boardId);
    if (!board) return send(chatId, `Scoreboard "${boardId}" was not found.`);
    await preferences.set(chatId, boardId);
    const extra = board.reasons && board.reasons.length > 0
      ? { reply_markup: reasonKeyboard(board.reasons, boardId) }
      : {};
    return send(chatId, `Selected board: ${boardId}\nScore: ${board.currentScore}`, extra);
  }

  async function applyChange(updateId, chatId, boardId, scoreChange, reason, reasonId = null) {
    const result = await repository.append({
      syncId: boardId,
      entry: {
        id: `telegram-${updateId}`,
        timestamp: new Date(),
        reason,
        scoreChange,
        reasonId
      },
      targetScore: 0
    });
    if (!result.boardFound) return send(chatId, 'Configured scoreboard was not found.');
    const sign = scoreChange > 0 ? '+' : '';
    return send(chatId, `✅ ${sign}${scoreChange} — ${reason}\nBoard: ${boardId}\nScore: ${result.currentScore}`);
  }

  async function requestUndo(chatId, boardId) {
    const board = await repository.getHistory(boardId, 1);
    if (!board) return send(chatId, 'Configured scoreboard was not found.');
    const entry = board.history && board.history[board.history.length - 1];
    if (!entry) return send(chatId, `No score history for ${boardId}.`);
    if (!Number.isFinite(entry.scoreChange) || entry.scoreChange === 0) {
      return send(chatId, 'The latest history entry has no score change to undo.');
    }
    const sign = entry.scoreChange > 0 ? '+' : '';
    const reason = String(entry.reason || 'Score change').slice(0, 120);
    return send(chatId, `Undo the latest change on ${boardId}?\n${sign}${entry.scoreChange} — ${reason}\nCurrent score: ${board.currentScore}`, {
      reply_markup: undoKeyboard(boardId, entry.id)
    });
  }

  async function confirmUndo(callbackId, chatId, boardId, entryHash) {
    const board = await repository.getHistory(boardId, UNDO_LOOKBACK);
    if (!board) {
      await api.answerCallbackQuery({ callback_query_id: callbackId, text: 'Scoreboard was not found.', show_alert: true });
      return;
    }
    const entry = (board.history || []).find(item => reasonKey(item.id) === entryHash);
    if (!entry || !Number.isFinite(entry.scoreChange) || entry.scoreChange === 0) {
      await api.answerCallbackQuery({ callback_query_id: callbackId, text: 'This undo request has expired.', show_alert: true });
      return;
    }
    const scoreChange = -entry.scoreChange;
    const originalReason = String(entry.reason || 'Score change').slice(0, 120);
    const result = await repository.append({
      syncId: boardId,
      entry: {
        id: `telegram-undo-${reasonKey(entry.id)}`,
        timestamp: new Date(),
        reason: `Undo: ${originalReason}`,
        scoreChange,
        reasonId: null
      },
      targetScore: 0
    });
    await api.answerCallbackQuery({ callback_query_id: callbackId });
    if (!result.boardFound) return send(chatId, 'Configured scoreboard was not found.');
    if (result.duplicate) return send(chatId, 'This change was already undone.');
    const sign = scoreChange > 0 ? '+' : '';
    return send(chatId, `↩️ ${sign}${scoreChange} — Undo: ${originalReason}\nBoard: ${boardId}\nScore: ${result.currentScore}`);
  }

  function context(update) {
    if (!update || typeof update !== 'object') return null;
    const source = update.message || update.callback_query && update.callback_query.message;
    const user = update.message && update.message.from || update.callback_query && update.callback_query.from;
    if (!source || !user || !SUPPORTED_CHAT_TYPES.has(source.chat.type)) return null;
    return { chatId: source.chat.id, userId: String(user.id) };
  }

  async function handleUpdate(update) {
    const ctx = context(update);
    if (!ctx) return;
    if (!config.allowedUserIds.has(ctx.userId)) {
      if (update.callback_query) {
        await api.answerCallbackQuery({ callback_query_id: update.callback_query.id, text: 'Not authorized', show_alert: true });
      } else {
        await send(ctx.chatId, 'You are not authorized to use this bot.');
      }
      return;
    }

    if (update.callback_query) {
      const data = update.callback_query.data || '';
      const undoCancelMatch = /^uc:([A-Za-z0-9_-]{16}):([A-Za-z0-9_-]{16})$/.exec(data);
      if (undoCancelMatch) {
        await api.answerCallbackQuery({ callback_query_id: update.callback_query.id, text: 'Undo cancelled' });
        return;
      }
      const undoMatch = /^u:([A-Za-z0-9_-]{16}):([A-Za-z0-9_-]{16})$/.exec(data);
      if (undoMatch) {
        const boardId = config.boardIds.find(id => boardKey(id) === undoMatch[1]);
        if (!boardId) {
          await api.answerCallbackQuery({ callback_query_id: update.callback_query.id, text: 'This undo request has expired.', show_alert: true });
          return;
        }
        await confirmUndo(update.callback_query.id, ctx.chatId, boardId, undoMatch[2]);
        return;
      }
      const boardMatch = /^b:([A-Za-z0-9_-]{16})$/.exec(data);
      if (boardMatch) {
        const boardId = config.boardIds.find(id => boardKey(id) === boardMatch[1]);
        if (!boardId) return;
        await selectBoard(ctx.chatId, boardId);
        await api.answerCallbackQuery({ callback_query_id: update.callback_query.id });
        return;
      }
      const match = /^r:([A-Za-z0-9_-]{16}):([A-Za-z0-9_-]{16})$/.exec(data);
      if (!match) return;
      const boardId = config.boardIds.find(id => boardKey(id) === match[1]);
      if (!boardId) return;
      const board = await repository.getSummary(boardId);
      if (!board) return send(ctx.chatId, 'Configured scoreboard was not found.');
      const reason = (board.reasons || []).find(item => reasonKey(item.id) === match[2]);
      if (!reason) {
        await api.answerCallbackQuery({ callback_query_id: update.callback_query.id, text: 'This reason is no longer available.', show_alert: true });
        return;
      }
      const scoreChange = reason.type === 'subtract' ? -reason.score : reason.score;
      await applyChange(update.update_id, ctx.chatId, boardId, scoreChange, reason.text, reason.id);
      await api.answerCallbackQuery({ callback_query_id: update.callback_query.id });
      return;
    }

    if (!botUsername && typeof update.message.text === 'string' && update.message.text.includes('@')) {
      await ensureIdentity();
    }
    const command = parseCommand(update.message.text, botUsername);
    if (!command) return;
    if (command.error) return send(ctx.chatId, command.error);
    if (command.name === 'start' || command.name === 'help') return send(ctx.chatId, help);
    if (command.name === 'status') {
      const status = statusProvider() || {};
      const startedAt = new Date(status.startedAt || Date.now());
      let databaseReady = Boolean(status.databaseReady);
      let statusBoardId = config.boardId;
      if (databaseReady) {
        try {
          statusBoardId = await selectedBoard(ctx.chatId);
        } catch (err) {
          databaseReady = false;
        }
      }
      return send(ctx.chatId, [
        'Server: ready',
        `Database: ${databaseReady ? 'connected' : 'unavailable'}`,
        `Uptime: ${formatUptime(status.uptimeSeconds)}`,
        `Started: ${Number.isNaN(startedAt.getTime()) ? 'unknown' : startedAt.toISOString()}`,
        `Board: ${statusBoardId}`
      ].join('\n'));
    }
    const boardId = await selectedBoard(ctx.chatId);
    if (command.name === 'boards' || command.name === 'board' && !command.boardId) {
      return send(ctx.chatId, `Selected board: ${boardId}`, {
        reply_markup: boardKeyboard(config.boardIds, boardId)
      });
    }
    if (command.name === 'board') return selectBoard(ctx.chatId, command.boardId);
    if (command.name === 'scores') {
      const boards = await Promise.all(config.boardIds.map(async id => ({
        id,
        board: await repository.getSummary(id)
      })));
      const lines = boards.map(({ id, board }) => (
        board ? id + ': ' + board.currentScore : id + ': unavailable'
      ));
      return send(ctx.chatId, ['Scores:', ...lines].join('\n'));
    }
    if (command.name === 'history') {
      const historyBoard = await repository.getHistory(boardId, HISTORY_LIMIT);
      if (!historyBoard) return send(ctx.chatId, 'Configured scoreboard was not found.');
      const entries = (historyBoard.history || []).slice().reverse();
      if (entries.length === 0) return send(ctx.chatId, `No score history for ${boardId}.`);
      const lines = entries.map((entry, index) => {
        const sign = entry.scoreChange > 0 ? '+' : '';
        const date = new Date(entry.timestamp);
        const timestamp = Number.isNaN(date.getTime()) ? 'unknown time' : date.toISOString();
        const reason = String(entry.reason || 'Score change').slice(0, 120);
        return `${index + 1}. ${sign}${entry.scoreChange} — ${reason} → ${entry.newScore} (${timestamp})`;
      });
      return send(ctx.chatId, [`Recent history — ${boardId}:`, ...lines].join('\n'));
    }
    if (command.name === 'undo') return requestUndo(ctx.chatId, boardId);
    const board = await repository.getSummary(boardId);
    if (!board) return send(ctx.chatId, 'Configured scoreboard was not found.');
    if (command.name === 'score') return send(ctx.chatId, `Board: ${boardId}\nScore: ${board.currentScore}`);
    if (command.name === 'reasons') {
      if (!board.reasons || board.reasons.length === 0) return send(ctx.chatId, 'No reasons are configured.');
      return send(ctx.chatId, `Choose a reason for ${boardId}:`, { reply_markup: reasonKeyboard(board.reasons, boardId) });
    }
    const scoreChange = command.name === 'subtract' ? -command.amount : command.amount;
    const description = command.description || 'Telegram adjustment';
    return applyChange(update.update_id, ctx.chatId, boardId, scoreChange, `Telegram: ${description}`);
  }

  async function registerWebhook() {
    await ensureIdentity();
    await api.setWebhook({
      url: `${config.baseUrl}/api/telegram/webhook`,
      secret_token: config.webhookSecret,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false
    });
    logger.log(`Telegram webhook enabled for @${botUsername || 'bot'}`);
  }

  async function notifyReady() {
    const message = '✅ Scoreboard server is ready.\nBot commands are available again.';
    const chatIds = [...config.readyChatIds];
    const results = await Promise.allSettled(chatIds.map(chatId => send(chatId, message)));
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error(`Telegram ready notification failed for chat ${chatIds[index]}: ${result.reason.message}`);
      }
    });
  }

  return { handleUpdate, notifyReady, registerWebhook };
}

module.exports = {
  boardKey,
  boardKeyboard,
  createTelegramApi,
  createTelegramBot,
  loadTelegramConfig,
  parseAllowedUserIds,
  parseBoardIds,
  parseCommand,
  parseReadyChatIds,
  reasonKey,
  reasonKeyboard,
  safeSecretEqual,
  undoKeyboard
};
