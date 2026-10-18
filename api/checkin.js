import supabase from './db.js';
import { verifyInitData } from './verify.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const { telegram_id, initData } = req.body;

  const verifiedUser = verifyInitData(initData, process.env.BOT_TOKEN_USER);
  if (!verifiedUser || verifiedUser.id !== telegram_id) return res.status(403).json({ success: false });

  const today = new Date().toISOString().slice(0, 10);
  const { data: user } = await supabase.from('users').select('*').eq('telegram_id', telegram_id).single();
  if (!user || user.last_checkin === today) return res.status(200).json({ success: false, message: 'Sudah check-in.' });

  const { data: settings } = await supabase.from('settings').select('*');
  const cfg = Object.fromEntries(settings.map(s => [s.key, s.value]));
  const reward = parseFloat(cfg.checkin_reward || '0.000005');
  const dailyCap = parseFloat(cfg.daily_cap || '0.00005');

  let earnedToday = user.earned_today || 0;
  if (user.last_ad_date !== today) earnedToday = 0;
  const actualReward = Math.min(reward, dailyCap - earnedToday);
  if (actualReward <= 0) return res.status(200).json({ success: false, message: 'Plafon harian tercapai.' });

  const newBalance = (user.balance || 0) + actualReward;
  await supabase.from('users').update({ balance: newBalance, last_checkin: today, checkin_streak: (user.checkin_streak || 0) + 1, earned_today: earnedToday + actualReward, last_ad_date: today }).eq('telegram_id', telegram_id);
  await supabase.from('ad_impressions').insert({ telegram_id, source: 'checkin', reward: actualReward });

  res.status(200).json({ success: true, balance: newBalance, reward: actualReward, earned_today: earnedToday + actualReward });
}
