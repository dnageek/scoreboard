'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createTelegramPreferenceRepository } = require('../lib/telegram-preference-repository');

test('chat preferences return the persisted board ID', async () => {
  let receivedFilter;
  const model = {
    findOne(filter) {
      receivedFilter = filter;
      return { async lean() { return { chatId: '-10', boardId: 'second' }; } };
    }
  };
  const repository = createTelegramPreferenceRepository(model);

  assert.equal(await repository.get(-10), 'second');
  assert.deepEqual(receivedFilter, { chatId: '-10' });
});

test('chat preferences return null before a board is selected', async () => {
  const model = {
    findOne() {
      return { async lean() { return null; } };
    }
  };
  const repository = createTelegramPreferenceRepository(model);

  assert.equal(await repository.get(10), null);
});

test('chat preferences persist selection with an upsert', async () => {
  let received;
  const model = {
    findOneAndUpdate(filter, update, options) {
      received = { filter, update, options };
      return { async lean() { return { chatId: '-10', boardId: 'second' }; } };
    }
  };
  const repository = createTelegramPreferenceRepository(model);

  assert.equal(await repository.set(-10, 'second'), 'second');
  assert.deepEqual(received.filter, { chatId: '-10' });
  assert.equal(received.update.$set.boardId, 'second');
  assert.equal(received.options.upsert, true);
  assert.equal(received.options.new, true);
});
