'use strict';

const crypto = require('crypto');

const MAX_ADJUSTMENT = 1000000;
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

function loadTelegramConfig(env) {
  const keys = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'TELEGRAM_BOARD_ID', 'PUBLIC_BASE_URL'];
  const telegramKeys = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'TELEGRAM_BOARD_ID', 'TELEGRAM_ALLOWED_USER_IDS'];
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
  return {
    token: env.TELEGRAM_BOT_TOKEN,
    webhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
    boardId: env.TELEGRAM_BOARD_ID,
    baseUrl,
    allowedUserIds: parseAllowedUserIds(env.TELEGRAM_ALLOWED_USER_IDS)
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
  if (!['start', 'help', 'score', 'reasons', 'add', 'subtract'].includes(name)) return null;
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

function reasonKeyboard(reasons) {
  const buttons = reasons.map(reason => ({
    text: `${reason.type === 'subtract' ? '−' : '+'}${reason.score} ${reason.text}`,
    callback_data: `r:${reasonKey(reason.id)}`
  }));
  const rows = [];
  for (let index = 0; index < buttons.length; index += 2) rows.push(buttons.slice(index, index + 2));
  return { inline_keyboard: rows };
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

function createTelegramBot({ config, repository, api, logger = console }) {
  let botUsername = '';
  let identityPromise = null;
  const help = [
    'Scoreboard commands:',
    '/score — show the current score',
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

  async function applyChange(updateId, chatId, scoreChange, reason, reasonId = null) {
    const result = await repository.append({
      syncId: config.boardId,
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
    return send(chatId, `✅ ${sign}${scoreChange} — ${reason}\nScore: ${result.currentScore}`);
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
      const match = /^r:([A-Za-z0-9_-]{16})$/.exec(update.callback_query.data || '');
      if (!match) return;
      const board = await repository.getSummary(config.boardId);
      if (!board) return send(ctx.chatId, 'Configured scoreboard was not found.');
      const reason = (board.reasons || []).find(item => reasonKey(item.id) === match[1]);
      if (!reason) {
        await api.answerCallbackQuery({ callback_query_id: update.callback_query.id, text: 'This reason is no longer available.', show_alert: true });
        return;
      }
      const scoreChange = reason.type === 'subtract' ? -reason.score : reason.score;
      await applyChange(update.update_id, ctx.chatId, scoreChange, reason.text, reason.id);
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
    const board = await repository.getSummary(config.boardId);
    if (!board) return send(ctx.chatId, 'Configured scoreboard was not found.');
    if (command.name === 'score') return send(ctx.chatId, `Score: ${board.currentScore}`);
    if (command.name === 'reasons') {
      if (!board.reasons || board.reasons.length === 0) return send(ctx.chatId, 'No reasons are configured.');
      return send(ctx.chatId, 'Choose a reason:', { reply_markup: reasonKeyboard(board.reasons) });
    }
    const scoreChange = command.name === 'subtract' ? -command.amount : command.amount;
    const description = command.description || 'Telegram adjustment';
    return applyChange(update.update_id, ctx.chatId, scoreChange, `Telegram: ${description}`);
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

  return { handleUpdate, registerWebhook };
}

module.exports = {
  createTelegramApi,
  createTelegramBot,
  loadTelegramConfig,
  parseAllowedUserIds,
  parseCommand,
  reasonKey,
  reasonKeyboard,
  safeSecretEqual
};
