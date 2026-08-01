'use strict';

function createTelegramPreferenceRepository(Preference) {
  async function get(chatId) {
    const preference = await Preference.findOne({ chatId: String(chatId) }).lean();
    return preference ? preference.boardId : null;
  }

  async function set(chatId, boardId) {
    const preference = await Preference.findOneAndUpdate(
      { chatId: String(chatId) },
      { $set: { boardId, updatedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return preference.boardId;
  }

  return { get, set };
}

module.exports = { createTelegramPreferenceRepository };
