const { buildContext, buildMemoryContext } = require('./aiContext');

let polling = false;
let abortController = null;
let lastUpdateId = 0;

async function sendTelegramMessage(db, text, parseMode = 'Markdown') {
  const token = db.prepare("SELECT value FROM settings WHERE key = 'telegram_bot_token'").get()?.value;
  const chatId = db.prepare("SELECT value FROM settings WHERE key = 'telegram_chat_id'").get()?.value;
  if (!token || !chatId) return null;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
      signal: AbortSignal.timeout(10000),
    });
    return await res.json();
  } catch (err) {
    console.error('Telegram send error:', err.message);
    return null;
  }
}

async function handleIncomingMessage(db, message) {
  const text = message.text;
  if (!text || text === '/start') {
    await sendTelegramMessage(db, 'RigBoard connected. You can chat with the AI assistant here.', 'Markdown');
    return;
  }

  // Build AI context (same as the dashboard AI widget)
  const aiUrl = db.prepare("SELECT value FROM settings WHERE key = 'ai_url'").get()?.value;
  const aiKey = db.prepare("SELECT value FROM settings WHERE key = 'ai_api_key'").get()?.value;
  const aiModel = db.prepare("SELECT value FROM settings WHERE key = 'ai_model'").get()?.value;
  const maxTokens = parseInt(db.prepare("SELECT value FROM settings WHERE key = 'ai_max_tokens'").get()?.value || '2000');

  if (!aiUrl) {
    await sendTelegramMessage(db, 'AI not configured. Set up an AI endpoint in RigBoard Settings > API.', 'Markdown');
    return;
  }

  try {
    const context = buildContext(db);
    const memoryContext = buildMemoryContext(db);

    const systemPrompt = `You are the RigBoard AI assistant, responding via Telegram. Be concise since this is a mobile/chat interface.

${context}

${memoryContext}

Keep responses short and actionable. Use plain text or simple Markdown.`;

    // Build endpoint URL
    let endpoint = aiUrl;
    if (!endpoint.endsWith('/chat/completions')) {
      endpoint = endpoint.replace(/\/+$/, '');
      if (!endpoint.endsWith('/v1')) endpoint += '/v1';
      endpoint += '/chat/completions';
    }

    const headers = { 'Content-Type': 'application/json' };
    if (aiKey) headers['Authorization'] = `Bearer ${aiKey}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: aiModel || 'default',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        max_tokens: Math.min(maxTokens, 1000), // Keep Telegram responses shorter
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(60000),
    });

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || 'No response from AI.';

    // Telegram has a 4096 char limit per message
    if (reply.length > 4000) {
      const chunks = reply.match(/.{1,4000}/gs) || [reply];
      for (const chunk of chunks) {
        await sendTelegramMessage(db, chunk, 'Markdown');
      }
    } else {
      await sendTelegramMessage(db, reply, 'Markdown');
    }
  } catch (err) {
    console.error('Telegram AI error:', err.message);
    await sendTelegramMessage(db, `Error: ${err.message}`, 'Markdown');
  }
}

async function pollUpdates(db) {
  const token = db.prepare("SELECT value FROM settings WHERE key = 'telegram_bot_token'").get()?.value;
  const chatId = db.prepare("SELECT value FROM settings WHERE key = 'telegram_chat_id'").get()?.value;
  if (!token || !chatId) return;

  polling = true;
  console.log('Telegram bot polling started');

  while (polling) {
    try {
      abortController = new AbortController();
      const res = await fetch(
        `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=30&allowed_updates=["message"]`,
        { signal: abortController.signal }
      );
      const data = await res.json();

      if (data.ok && data.result?.length > 0) {
        for (const update of data.result) {
          lastUpdateId = update.update_id;
          if (update.message && String(update.message.chat.id) === String(chatId)) {
            handleIncomingMessage(db, update.message).catch(err =>
              console.error('Telegram message handler error:', err.message)
            );
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') break;
      console.error('Telegram poll error:', err.message);
      // Backoff on error
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

function startTelegramBot(db) {
  const token = db.prepare("SELECT value FROM settings WHERE key = 'telegram_bot_token'").get()?.value;
  if (!token) {
    console.log('Telegram bot not configured, skipping');
    return;
  }
  pollUpdates(db);
}

function stopTelegramBot() {
  polling = false;
  if (abortController) abortController.abort();
}

function restartTelegramBot(db) {
  stopTelegramBot();
  setTimeout(() => startTelegramBot(db), 1000);
}

module.exports = { startTelegramBot, stopTelegramBot, restartTelegramBot, sendTelegramMessage };
