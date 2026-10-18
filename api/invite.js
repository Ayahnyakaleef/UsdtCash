import supabase from './db.js';

export default async function handler(req, res) {
  const telegramId = parseInt(req.query.telegram_id);
  if (!telegramId) return res.status(400).json({ error: 'missing id' });

  const botUsername = process.env.BOT_USERNAME || 'UsdtCashBot';
  const link = `https://t.me/${botUsername}?start=ref_${telegramId}`;
  const { data: user } = await supabase.from('users').select('invite_count').eq('telegram_id', telegramId).single();

  res.status(200).json({ link, invite_count: user?.invite_count || 0 });
}
