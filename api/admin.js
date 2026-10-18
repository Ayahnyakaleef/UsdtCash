import TelegramBot from 'node-telegram-bot-api';
import supabase from './db.js';

const bot = new TelegramBot(process.env.BOT_TOKEN_ADMIN);
const ADMIN_ID = parseInt(process.env.ADMIN_TELEGRAM_ID);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });
  const { message } = req.body;
  if (!message || message.from.id !== ADMIN_ID) return res.status(200).json({ ok: true });

  const chatId = message.chat.id;
  const text = message.text || '';

  if (text === '/start' || text === '/help') {
    await bot.sendMessage(chatId, `*UsdtCash Admin Panel*\n\n/stats\n/withdrawals\n/approve <id>\n/reject <id>\n/set <key> <value>\n/broadcast <pesan>\n/user <id>`, { parse_mode: 'Markdown' });
  } else if (text === '/stats') {
    const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { count: adCount } = await supabase.from('ad_impressions').select('*', { count: 'exact', head: true });
    await bot.sendMessage(chatId, `User: ${userCount}\nTayangan: ${adCount}`);
  } else if (text === '/withdrawals') {
    const { data } = await supabase.from('withdrawals').select('*').eq('status', 'pending');
    if (!data?.length) return bot.sendMessage(chatId, 'Tidak ada withdraw pending.');
    const list = data.map(w => `#${w.id} | ${w.telegram_id} | ${w.amount.toFixed(8)} USDT\n${w.wallet_address}`).join('\n\n');
    await bot.sendMessage(chatId, `*Pending:*\n\n${list}`, { parse_mode: 'Markdown' });
  } else if (text.startsWith('/approve ')) {
    const id = parseInt(text.split(' ')[1]);
    const { data: w } = await supabase.from('withdrawals').select('*').eq('id', id).single();
    if (w && w.status === 'pending') {
      await supabase.from('withdrawals').update({ status: 'approved', processed_at: new Date().toISOString() }).eq('id', id);
      await bot.sendMessage(chatId, `Withdraw #${id} approved.`);
      const userBot = new TelegramBot(process.env.BOT_TOKEN_USER);
      userBot.sendMessage(w.telegram_id, `Withdraw ${w.amount.toFixed(8)} USDT disetujui.`).catch(()=>{});
    }
  } else if (text.startsWith('/reject ')) {
    const id = parseInt(text.split(' ')[1]);
    const { data: w } = await supabase.from('withdrawals').select('*').eq('id', id).single();
    if (w && w.status === 'pending') {
      const { data: u } = await supabase.from('users').select('balance').eq('telegram_id', w.telegram_id).single();
      await supabase.from('users').update({ balance: (u?.balance || 0) + w.amount }).eq('telegram_id', w.telegram_id);
      await supabase.from('withdrawals').update({ status: 'rejected', processed_at: new Date().toISOString() }).eq('id', id);
      await bot.sendMessage(chatId, `Withdraw #${id} rejected.`);
      const userBot = new TelegramBot(process.env.BOT_TOKEN_USER);
      userBot.sendMessage(w.telegram_id, `Withdraw ${w.amount.toFixed(8)} USDT ditolak. Saldo dikembalikan.`).catch(()=>{});
    }
  } else if (text.startsWith('/set ')) {
    const parts = text.split(' ');
    if (parts.length >= 3) {
      await supabase.from('settings').upsert({ key: parts[1], value: parts.slice(2).join(' ') });
      await bot.sendMessage(chatId, `Setting ${parts[1]} diubah.`);
    }
  } else if (text.startsWith('/user ')) {
    const targetId = parseInt(text.split(' ')[1]);
    const { data: u } = await supabase.from('users').select('*').eq('telegram_id', targetId).single();
    if (u) await bot.sendMessage(chatId, `Saldo: ${u.balance.toFixed(8)}\nInvite: ${u.invite_count}`);
  } else if (text.startsWith('/broadcast ')) {
    const msg = text.replace('/broadcast ', '');
    const { data: users } = await supabase.from('users').select('telegram_id');
    const userBot = new TelegramBot(process.env.BOT_TOKEN_USER);
    let sent = 0;
    for (const u of users || []) { try { await userBot.sendMessage(u.telegram_id, msg); sent++; } catch (e) {} }
    await bot.sendMessage(chatId, `Broadcast ke ${sent} user.`);
  }
  res.status(200).json({ ok: true });
}
