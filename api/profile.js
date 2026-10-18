import supabase from './db.js';

export default async function handler(req, res) {
  const telegramId = parseInt(req.query.telegram_id);
  if (!telegramId) return res.status(400).json({ error: 'missing id' });
  const today = new Date().toISOString().slice(0, 10);

  const { data: user } = await supabase.from('users').select('*').eq('telegram_id', telegramId).single();
  if (!user) return res.status(404).json({ error: 'not found' });

  let adsToday = user.total_ads_today || 0;
  let earnedToday = user.earned_today || 0;
  if (user.last_ad_date !== today) {
    adsToday = 0; earnedToday = 0;
    await supabase.from('users').update({ total_ads_today: 0, earned_today: 0, last_ad_date: today }).eq('telegram_id', telegramId);
  }

  const { data: settings } = await supabase.from('settings').select('*');
  const cfg = Object.fromEntries(settings.map(s => [s.key, s.value]));

  res.status(200).json({
    balance: user.balance || 0,
    ads_today: adsToday,
    earned_today: earnedToday,
    daily_cap: parseFloat(cfg.daily_cap || '0.00005'),
    max_ads: parseInt(cfg.max_ads_per_day || '30'),
    can_checkin: user.last_checkin !== today,
    checkin_streak: user.checkin_streak || 0,
    invite_count: user.invite_count || 0,
    min_withdraw: parseFloat(cfg.min_withdraw || '2'),
    min_invite: parseInt(cfg.min_invite_for_withdraw || '2'),
    reward_per_ad: parseFloat(cfg.reward_per_ad || '0.0000015'),
    checkin_reward: parseFloat(cfg.checkin_reward || '0.000005'),
  });
}
