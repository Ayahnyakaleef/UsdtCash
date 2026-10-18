import supabase from './db.js';
import { verifyInitData } from './verify.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const { telegram_id, wallet_address, initData } = req.body;

  const verifiedUser = verifyInitData(initData, process.env.BOT_TOKEN_USER);
  if (!verifiedUser || verifiedUser.id !== telegram_id) return res.status(403).json({ success: false });
  if (!wallet_address || wallet_address.length < 20) return res.status(400).json({ success: false, message: 'Alamat wallet invalid.' });

  const { data: user } = await supabase.from('users').select('*').eq('telegram_id', telegram_id).single();
  if (!user) return res.status(404).json({ success: false });

  const { data: settings } = await supabase.from('settings').select('*');
  const cfg = Object.fromEntries(settings.map(s => [s.key, s.value]));
  const minWd = parseFloat(cfg.min_withdraw || '2');
  const minInvite = parseInt(cfg.min_invite_for_withdraw || '2');

  if ((user.balance || 0) < minWd) return res.status(200).json({ success: false, message: `Saldo minimal ${minWd}.` });
  if ((user.invite_count || 0) < minInvite) return res.status(200).json({ success: false, message: `Butuh ${minInvite} invite.` });

  await supabase.from('withdrawals').insert({ telegram_id, amount: user.balance, wallet_address, status: 'pending' });
  await supabase.from('users').update({ balance: 0 }).eq('telegram_id', telegram_id);

  res.status(200).json({ success: true, message: 'Withdraw dikirim ke admin.' });
}
