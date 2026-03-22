import { pool } from './db.js';

// Cache settings for 30s to avoid DB hit on every message
let settingsCache: Record<string, string> | null = null;
let settingsCacheTs = 0;
const SETTINGS_TTL = 30000;

async function getSettings(): Promise<Record<string, string>> {
  const now = Date.now();
  if (settingsCache && now - settingsCacheTs < SETTINGS_TTL) return settingsCache;
  try {
    const result = await pool.query('SELECT key, value FROM system_settings');
    const map: Record<string, string> = {};
    for (const row of result.rows) map[row.key] = row.value;
    settingsCache = map;
    settingsCacheTs = now;
    return map;
  } catch {
    return {};
  }
}

export function invalidateSettingsCache() {
  settingsCache = null;
}

export async function sendTelegramMessage(message: string): Promise<void> {
  const settings = await getSettings();

  // DB values take priority over .env
  const token = settings['telegram_bot_token'] || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = settings['telegram_group_chat_id'] || process.env.TELEGRAM_GROUP_CHAT_ID;
  const operatorName = settings['operator_name'] || '';
  const customMessage = settings['custom_message'] || '';

  if (!token || !chatId) {
    console.warn('Telegram not configured — BOT_TOKEN or GROUP_CHAT_ID missing');
    return;
  }

  // Prepend operator name + custom message if set
  let fullMessage = '';
  if (operatorName) fullMessage += `👤 <b>${operatorName}</b>\n`;
  if (customMessage) fullMessage += `💬 ${customMessage}\n\n`;
  fullMessage += message;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: fullMessage, parse_mode: 'HTML' }),
    });
    const data = await res.json() as any;
    if (!data.ok) {
      console.error('Telegram API error:', data.description);
    } else {
      console.log('Telegram message sent ✓');
    }
  } catch (err: any) {
    console.error('Telegram fetch error:', err?.message || err);
  }
}
