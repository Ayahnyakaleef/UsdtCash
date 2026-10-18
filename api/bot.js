import TelegramBot from 'node-telegram-bot-api';
import supabase from './db.js';

const bot = new TelegramBot(process.env.BOT_TOKEN_USER);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });
  const { message } = req.body;
  if (!message?.text) return res.status(200).json({ ok: true });

  if (message.text.startsWith('/start')) {
    const telegramId = message.from.id;
    const username = message.from.username || '';
    const firstName = message.from.first_name || '';

    const { data: existing } = await supabase.from('users').select('id').eq('telegram_id', telegramId).single();

    if (!existing) {
      const parts = message.text.split(' ');
      let invitedBy = null;

      if (parts[1] && parts[1].startsWith('ref_')) {
        const refId = parseInt(parts[1].replace('ref_', ''));
        if (refId && refId !== telegramId) {
          const { data: referrer } = await supabase.from('users').select('invite_count').eq('telegram_id', refId).single();
          if (referrer) {
            invitedBy = refId;
            await supabase.from('users').update({ invite_count: (referrer.invite_count || 0) + 1 }).eq('telegram_id', refId);
          }
        }
      }

      await supabase.from('users').insert({
        telegram_id: telegramId, username, first_name: firstName, invited_by: invitedBy, balance: 0
      });
    }

    const webAppUrl = `https://${req.headers.host}`;
    await bot.sendMessage(message.chat.id, `Selamat datang di *UsdtCash*!\n\nKumpulkan USDT dari menonton iklan dan check-in harian.\nMinimal withdraw 2 USDT + 2 teman diundang.`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: 'Buka UsdtCash', web_app: { url: webAppUrl } }]] }
    });
  }
  res.status(200).json({ ok: true });
}
