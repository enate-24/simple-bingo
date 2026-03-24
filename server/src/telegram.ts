import { pool } from './db.js';

// Per-user settings cache: userId -> { map, ts }
const userSettingsCache: Record<number, { map: Record<string, string>; ts: number }> = {};
const SETTINGS_TTL = 30000;

async function getSettingsForUser(userId: number): Promise<Record<string, string>> {
  const now = Date.now();
  const cached = userSettingsCache[userId];
  if (cached && now - cached.ts < SETTINGS_TTL) return cached.map;
  try {
    const result = await pool.query(
      'SELECT key, value FROM system_settings WHERE user_id = $1',
      [userId]
    );
    const map: Record<string, string> = {};
    for (const row of result.rows) map[row.key] = row.value;
    userSettingsCache[userId] = { map, ts: now };
    return map;
  } catch {
    return {};
  }
}

export function invalidateSettingsCache(userId?: number) {
  if (userId !== undefined) {
    delete userSettingsCache[userId];
  } else {
    // Clear all
    for (const key of Object.keys(userSettingsCache)) delete userSettingsCache[Number(key)];
  }
}

export async function sendTelegramMessage(message: string, userId?: number): Promise<void> {
  let token: string | undefined;
  let chatId: string | undefined;
  let operatorName = '';
  let customMessage = '';

  if (userId !== undefined) {
    const settings = await getSettingsForUser(userId);
    token = settings['telegram_bot_token'] || process.env.TELEGRAM_BOT_TOKEN;
    chatId = settings['telegram_group_chat_id'] || process.env.TELEGRAM_GROUP_CHAT_ID;
    operatorName = settings['operator_name'] || '';
    customMessage = settings['custom_message'] || '';
  } else {
    token = process.env.TELEGRAM_BOT_TOKEN;
    chatId = process.env.TELEGRAM_GROUP_CHAT_ID;
  }

  console.log('[Telegram] token:', token ? token.slice(0, 10) + '...' : 'MISSING');
  console.log('[Telegram] chatId:', chatId || 'MISSING');

  if (!token || !chatId) {
    console.warn('[Telegram] Not configured — BOT_TOKEN or GROUP_CHAT_ID missing');
    return;
  }

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
      console.error('[Telegram] API error:', data.description);
    } else {
      console.log('[Telegram] Message sent ✓ id:', data.result?.message_id);
    }
  } catch (err: any) {
    console.error('[Telegram] fetch error:', err?.message || err);
  }
}
