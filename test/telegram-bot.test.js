'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  boardKey,
  createTelegramBot,
  loadTelegramConfig,
  parseBoardIds,
  parseCommand,
  reasonKey,
  reasonKeyboard,
  safeSecretEqual
} = require('../lib/telegram-bot');

function config(overrides = {}) {
  return {
    token: 'token', webhookSecret: 'secret', boardId: 'board',
    baseUrl: 'https://example.onrender.com', allowedUserIds: new Set(['123']),
    boardIds: ['board', 'second'], ...overrides
  };
}

function fakeApi() {
  const calls = [];
  return {
    calls,
    async getMe() { return { username: 'score_bot' }; },
    async setWebhook(payload) { calls.push(['setWebhook', payload]); },
    async sendMessage(payload) { calls.push(['sendMessage', payload]); },
    async answerCallbackQuery(payload) { calls.push(['answerCallbackQuery', payload]); }
  };
}

function fakePreferences(initial = null) {
  let boardId = initial;
  const sets = [];
  return {
    sets,
    async get() { return boardId; },
    async set(chatId, selectedBoardId) {
      boardId = selectedBoardId;
      sets.push({ chatId: String(chatId), boardId: selectedBoardId });
      return boardId;
    }
  };
}

function fakeRepository(board = { currentScore: 10, reasons: [] }) {
  const appends = [];
  return {
    appends,
    async getSummary() { return board; },
    async append(change) {
      appends.push(change);
      return { boardFound: true, duplicate: false, currentScore: 15, entry: change.entry };
    }
  };
}

test('Telegram configuration is optional but fails closed when partially configured', () => {
  assert.equal(loadTelegramConfig({}), null);
  assert.equal(loadTelegramConfig({ PUBLIC_BASE_URL: 'https://example.com' }), null);
  assert.throws(() => loadTelegramConfig({ TELEGRAM_BOT_TOKEN: 'token' }), /required/);
  assert.throws(() => loadTelegramConfig({
    TELEGRAM_BOT_TOKEN: 'token', TELEGRAM_WEBHOOK_SECRET: 'bad secret',
    TELEGRAM_ALLOWED_USER_IDS: '123', TELEGRAM_BOARD_ID: 'board',
    PUBLIC_BASE_URL: 'https://example.com'
  }), /unsupported/);
});

test('loadTelegramConfig parses an allowlist and HTTPS base URL', () => {
  const result = loadTelegramConfig({
    TELEGRAM_BOT_TOKEN: 'token', TELEGRAM_WEBHOOK_SECRET: 'secret_123',
    TELEGRAM_ALLOWED_USER_IDS: '123, 456', TELEGRAM_BOARD_ID: 'board-1',
    PUBLIC_BASE_URL: 'https://example.com/'
  });

  assert.deepEqual([...result.allowedUserIds], ['123', '456']);
  assert.equal(result.baseUrl, 'https://example.com');
  assert.deepEqual(result.boardIds, ['board-1']);
});

test('webhook secrets require an exact match', () => {
  assert.equal(safeSecretEqual('secret', 'secret'), true);
  assert.equal(safeSecretEqual('secret', 'different'), false);
  assert.equal(safeSecretEqual(undefined, 'secret'), false);
});

test('parseBoardIds preserves the default and rejects invalid allowlists', () => {
  assert.deepEqual(parseBoardIds('default', 'second,third'), ['default', 'second', 'third']);
  assert.deepEqual(parseBoardIds('default', ''), ['default']);
  assert.throws(() => parseBoardIds('default', 'bad board'), /invalid/);
});

test('parseCommand validates targeting and whole-number adjustments', () => {
  assert.deepEqual(parseCommand('/score@score_bot', 'score_bot'), { name: 'score' });
  assert.deepEqual(parseCommand('/scores', 'score_bot'), { name: 'scores' });
  assert.equal(parseCommand('/score@another_bot', 'score_bot'), null);
  assert.deepEqual(parseCommand('/board second', 'score_bot'), { name: 'board', boardId: 'second' });
  assert.deepEqual(parseCommand('/add 5 workout', 'score_bot'), {
    name: 'add', amount: 5, description: 'workout'
  });
  assert.match(parseCommand('/subtract 1.5', 'score_bot').error, /whole number/);
  assert.match(parseCommand('/add 1000001', 'score_bot').error, /1000000/);
});

test('reason keyboards use compact callbacks and two buttons per row', () => {
  const reasons = [
    { id: 'one', text: 'One', score: 1, type: 'add' },
    { id: 'two', text: 'Two', score: 2, type: 'subtract' },
    { id: 'three', text: 'Three', score: 3, type: 'add' }
  ];
  const keyboard = reasonKeyboard(reasons, 'board');

  assert.equal(keyboard.inline_keyboard.length, 2);
  assert.equal(keyboard.inline_keyboard[0][0].callback_data, `r:${boardKey('board')}:${reasonKey('one')}`);
  assert.ok(keyboard.inline_keyboard.flat().every(button => Buffer.byteLength(button.callback_data) <= 64));
});

test('malformed webhook updates are ignored safely', async () => {
  const api = fakeApi();
  const repository = fakeRepository();
  const bot = createTelegramBot({ config: config(), repository, preferences: fakePreferences(), api, logger: { log() {} } });

  await assert.doesNotReject(bot.handleUpdate(null));
  assert.equal(api.calls.length, 0);
  assert.equal(repository.appends.length, 0);
});

test('unauthorized users cannot read or change a board', async () => {
  const api = fakeApi();
  const repository = fakeRepository();
  const bot = createTelegramBot({ config: config(), repository, preferences: fakePreferences(), api, logger: { log() {} } });

  await bot.handleUpdate({
    update_id: 1,
    message: { text: '/score', from: { id: 999 }, chat: { id: -1, type: 'group' } }
  });

  assert.equal(repository.appends.length, 0);
  assert.match(api.calls[0][1].text, /not authorized/i);
});

test('score commands work in groups when directed to this bot', async () => {
  const api = fakeApi();
  const repository = fakeRepository();
  const bot = createTelegramBot({ config: config(), repository, preferences: fakePreferences(), api, logger: { log() {} } });

  await bot.handleUpdate({
    update_id: 2,
    message: { text: '/score@score_bot', from: { id: 123 }, chat: { id: -10, type: 'supergroup' } }
  });

  assert.equal(api.calls.at(-1)[0], 'sendMessage');
  assert.equal(api.calls.at(-1)[1].text, 'Board: board\nScore: 10');
  assert.equal(api.calls.some(([method]) => method === 'setWebhook'), false);
});

test('/scores lists every allowlisted board and marks missing boards unavailable', async () => {
  const api = fakeApi();
  const repository = {
    async getSummary(boardId) {
      if (boardId === 'board') return { currentScore: 10, reasons: [] };
      return null;
    },
    async append() { throw new Error('not expected'); }
  };
  const bot = createTelegramBot({
    config: config(), repository, preferences: fakePreferences(), api, logger: { log() {} }
  });

  await bot.handleUpdate({
    update_id: 7,
    message: { text: '/scores', from: { id: 123 }, chat: { id: 10, type: 'private' } }
  });

  assert.equal(api.calls.at(-1)[1].text, 'Scores:\nboard: 10\nsecond: unavailable');
});

test('/boards displays allowed boards and the persisted chat selection', async () => {
  const api = fakeApi();
  const repository = fakeRepository();
  const preferences = fakePreferences('second');
  const bot = createTelegramBot({ config: config(), repository, preferences, api, logger: { log() {} } });

  await bot.handleUpdate({
    update_id: 8,
    message: { text: '/boards', from: { id: 123 }, chat: { id: -10, type: 'group' } }
  });

  const message = api.calls.at(-1)[1];
  assert.equal(message.text, 'Selected board: second');
  assert.equal(message.reply_markup.inline_keyboard[1][0].text, '✓ second');
});

test('/board selects an allowed board for the current chat', async () => {
  const api = fakeApi();
  const reason = { id: 'exercise', text: 'Exercise', score: 5, type: 'add' };
  const repository = fakeRepository({ currentScore: 20, reasons: [reason] });
  const preferences = fakePreferences();
  const bot = createTelegramBot({ config: config(), repository, preferences, api, logger: { log() {} } });

  await bot.handleUpdate({
    update_id: 9,
    message: { text: '/board second', from: { id: 123 }, chat: { id: -10, type: 'group' } }
  });

  assert.deepEqual(preferences.sets, [{ chatId: '-10', boardId: 'second' }]);
  assert.match(api.calls.at(-1)[1].text, /Selected board: second/);
  assert.equal(
    api.calls.at(-1)[1].reply_markup.inline_keyboard[0][0].callback_data,
    `r:${boardKey('second')}:${reasonKey('exercise')}`
  );
});

test('board callbacks persist selection for the shared chat', async () => {
  const api = fakeApi();
  const repository = fakeRepository({ currentScore: 20, reasons: [] });
  const preferences = fakePreferences();
  const bot = createTelegramBot({ config: config(), repository, preferences, api, logger: { log() {} } });

  await bot.handleUpdate({
    update_id: 10,
    callback_query: {
      id: 'board-callback', data: `b:${boardKey('second')}`, from: { id: 123 },
      message: { chat: { id: -10, type: 'group' } }
    }
  });

  assert.equal(preferences.sets[0].boardId, 'second');
  assert.equal(api.calls.at(-1)[0], 'answerCallbackQuery');
});

test('registerWebhook configures the protected Render endpoint without dropping updates', async () => {
  const api = fakeApi();
  const bot = createTelegramBot({
    config: config(), repository: fakeRepository(), preferences: fakePreferences(), api, logger: { log() {} }
  });

  await bot.registerWebhook();

  const call = api.calls.find(([method]) => method === 'setWebhook');
  assert.equal(call[1].url, 'https://example.onrender.com/api/telegram/webhook');
  assert.equal(call[1].secret_token, 'secret');
  assert.deepEqual(call[1].allowed_updates, ['message', 'callback_query']);
  assert.equal(call[1].drop_pending_updates, false);
});

test('numeric adjustments use deterministic Telegram entry IDs', async () => {
  const api = fakeApi();
  const repository = fakeRepository();
  const bot = createTelegramBot({ config: config(), repository, preferences: fakePreferences(), api, logger: { log() {} } });

  await bot.handleUpdate({
    update_id: 42,
    message: { text: '/subtract 3 late', from: { id: 123 }, chat: { id: 10, type: 'private' } }
  });

  assert.equal(repository.appends[0].entry.id, 'telegram-42');
  assert.equal(repository.appends[0].entry.scoreChange, -3);
  assert.equal(repository.appends[0].entry.reason, 'Telegram: late');
});

test('score changes apply to the board persisted for that chat', async () => {
  const api = fakeApi();
  const repository = fakeRepository();
  const bot = createTelegramBot({
    config: config(), repository, preferences: fakePreferences('second'), api, logger: { log() {} }
  });

  await bot.handleUpdate({
    update_id: 50,
    message: { text: '/add 2 bonus', from: { id: 123 }, chat: { id: -10, type: 'group' } }
  });

  assert.equal(repository.appends[0].syncId, 'second');
});

test('reason callbacks re-fetch and apply the configured reason', async () => {
  const reason = { id: 'exercise', text: 'Exercise', score: 5, type: 'add' };
  const api = fakeApi();
  const repository = fakeRepository({ currentScore: 10, reasons: [reason] });
  const bot = createTelegramBot({ config: config(), repository, preferences: fakePreferences(), api, logger: { log() {} } });

  await bot.handleUpdate({
    update_id: 77,
    callback_query: {
      id: 'callback', data: `r:${boardKey('board')}:${reasonKey(reason.id)}`, from: { id: 123 },
      message: { chat: { id: -10, type: 'group' } }
    }
  });

  assert.equal(repository.appends[0].entry.reasonId, 'exercise');
  assert.equal(repository.appends[0].entry.scoreChange, 5);
  assert.equal(api.calls.at(-1)[0], 'answerCallbackQuery');
});
