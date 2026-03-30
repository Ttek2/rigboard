const express = require('express');
const router = express.Router();

// GET /api/v1/telegram/status
router.get('/status', async (req, res) => {
  const db = req.app.locals.db;
  const token = db.prepare("SELECT value FROM settings WHERE key = 'telegram_bot_token'").get()?.value;
  const chatId = db.prepare("SELECT value FROM settings WHERE key = 'telegram_chat_id'").get()?.value;

  if (!token) return res.json({ enabled: false, connected: false, bot_username: null });

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(5000) });
    const data = await r.json();
    res.json({
      enabled: !!token && !!chatId,
      connected: data.ok,
      bot_username: data.result?.username || null,
      chat_id: chatId || null,
    });
  } catch (err) {
    res.json({ enabled: false, connected: false, error: err.message });
  }
});

// POST /api/v1/telegram/test — send a test message
router.post('/test', async (req, res) => {
  const db = req.app.locals.db;
  const { sendTelegramMessage } = require('../services/telegramBot');
  const result = await sendTelegramMessage(db, 'RigBoard connected. Notifications will be sent here.');
  if (result?.ok) {
    res.json({ success: true });
  } else {
    res.status(400).json({ error: result?.description || 'Failed to send message' });
  }
});

// PUT /api/v1/telegram/settings — update token and chat ID, restart bot
router.put('/settings', (req, res) => {
  const db = req.app.locals.db;
  const { bot_token, chat_id } = req.body;
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');

  if (bot_token !== undefined) upsert.run('telegram_bot_token', bot_token);
  if (chat_id !== undefined) upsert.run('telegram_chat_id', chat_id);

  // Restart the bot with new settings
  const { restartTelegramBot } = require('../services/telegramBot');
  restartTelegramBot(db);

  res.json({ success: true });
});

module.exports = router;
