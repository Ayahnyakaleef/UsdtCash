import supabase from './db.js';

export default async function handler(req, res) {
  const telegramId = parseInt(req.query.telegram_id);
  if (!telegramId) return res.status(400).json({ error: 'missing id' });

  const [adsRes, wdRes] = await Promise.all([
    supabase.from('ad_impressions').select('reward, source, created_at').eq('telegram_id', telegramId).order('created_at', { ascending: false }).limit(50),
    supabase.from('withdrawals').select('amount, wallet_address, status, created_at').eq('telegram_id', telegramId).order('created_at', { ascending: false }).limit(20)
  ]);

  const items = [];
  (adsRes.data || []).forEach(a => items.push({ type: a.source === 'checkin' ? 'checkin' : 'ad', reward: a.reward, created_at: a.created_at }));
  (wdRes.data || []).forEach(w => items.push({ type: 'withdraw', amount: w.amount, status: w.status, wallet: w.wallet_address, created_at: w.created_at }));
  items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  res.status(200).json({ items: items.slice(0, 60) });
}
