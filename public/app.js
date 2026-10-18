const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const AD_GUID = 'GANTI_GUID_MONETAG';
const AD_UNIT_ID = 'GANTI_UNIT_ID_MONETAG';

const $ = id => document.getElementById(id);
let userId = null;
let initData = '';
let state = {};

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

function initUser() {
  const u = tg?.initDataUnsafe?.user;
  if (!u) { toast('Buka dari Telegram'); return false; }
  userId = u.id;
  initData = tg.initData;
  $('greeting').textContent = `Halo, ${u.first_name}`;
  $('username').textContent = u.username ? `@${u.username}` : '';
  $('avatar').textContent = (u.first_name || '?')[0].toUpperCase();
  return true;
}

async function loadProfile() {
  const res = await fetch(`/api/profile?telegram_id=${userId}`);
  if (!res.ok) return;
  state = await res.json();
  render();
}

function render() {
  $('balance').textContent = (state.balance || 0).toFixed(8);
  $('streak').textContent = state.checkin_streak || 0;
  $('adsProgress').textContent = `${state.ads_today} / ${state.max_ads}`;
  $('rewardInfo').textContent = `+${state.reward_per_ad} USDT/iklan · Maks ${state.daily_cap} USDT/hari`;
  $('progressFill').style.width = `${(state.ads_today / state.max_ads) * 100}%`;
  $('checkinStatus').textContent = state.can_checkin ? 'Siap' : 'Selesai';
  $('checkinBtn').disabled = !state.can_checkin;
  $('inviteStatus').textContent = `${state.invite_count}/${state.min_invite}`;
  $('withdrawNote').textContent = `Minimal ${state.min_withdraw} USDT + ${state.min_invite} invite`;

  const capReached = (state.earned_today || 0) >= state.daily_cap;
  $('watchBtn').disabled = state.ads_today >= state.max_ads || capReached;
  if (capReached) {
    $('watchBtn').innerHTML = 'Plafon Harian Tercapai';
  } else if (state.ads_today >= state.max_ads) {
    $('watchBtn').innerHTML = 'Batas Iklan Tercapai';
  } else {
    $('watchBtn').innerHTML = '<span class="play-icon">▶</span> Tonton Iklan';
  }
}

async function doCheckin() {
  $('checkinBtn').disabled = true;
  const res = await fetch('/api/checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegram_id: userId, initData })
  });
  const data = await res.json();
  if (data.success) {
    state.balance = data.balance;
    state.earned_today = data.earned_today;
    state.can_checkin = false;
    state.checkin_streak++;
    render();
    toast(`+${data.reward.toFixed(8)} USDT`);
  } else {
    toast(data.message || 'Gagal check-in');
    $('checkinBtn').disabled = false;
  }
}

async function watchAd() {
  if (!userId) return toast('Buka dari Telegram');
  const btn = $('watchBtn');
  btn.disabled = true;
  btn.textContent = 'Memuat iklan...';

  const onReward = async () => {
    const res = await fetch('/api/watch-ad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegram_id: userId, initData, source: 'rewarded' })
    });
    const data = await res.json();
    if (data.success) {
      state.balance = data.balance;
      state.ads_today = data.ads_today;
      state.earned_today = data.earned_today;
      render();
      toast(`+${data.reward.toFixed(8)} USDT`);
    } else {
      toast(data.message || 'Gagal');
      btn.disabled = false;
      btn.textContent = 'Tonton Iklan';
    }
  };

  if (window.monetag?.showRewarded) {
    window.monetag.showRewarded({
      adUnitId: AD_UNIT_ID,
      onReward,
      onClose: () => { if (btn.textContent.includes('Memuat')) { btn.disabled = false; btn.textContent = 'Tonton Iklan'; } },
      onError: () => { toast('Iklan gagal'); btn.disabled = false; btn.textContent = 'Tonton Iklan'; }
    });
  } else if (window.entryAds) {
    try {
      const instance = await window.entryAds({ guid: AD_GUID });
      await instance.show({ onAdComplete: onReward });
    } catch(e) {
      toast('Iklan gagal'); btn.disabled = false; btn.textContent = 'Tonton Iklan';
    }
  } else {
    setTimeout(onReward, 1500);
  }
}

async function doWithdraw() {
  const wallet = $('walletInput').value.trim();
  if (!wallet) return toast('Isi alamat wallet dulu');
  $('withdrawBtn').disabled = true;
  const res = await fetch('/api/withdraw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegram_id: userId, initData, wallet_address: wallet })
  });
  const data = await res.json();
  if (data.success) {
    toast(data.message);
    state.balance = 0;
    render();
  } else {
    toast(data.message || 'Gagal withdraw');
  }
  $('withdrawBtn').disabled = false;
}

async function loadHistory() {
  const res = await fetch(`/api/history?telegram_id=${userId}`);
  const data = await res.json();
  const list = $('historyList');
  if (!data.items || data.items.length === 0) {
    list.innerHTML = '<div class="empty">Belum ada riwayat.</div>';
    return;
  }
  list.innerHTML = data.items.map(item => {
    const d = new Date(item.created_at);
    const timeStr = d.toLocaleDateString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    if (item.type === 'withdraw') {
      return `<div class="history-item">
        <div class="history-left">
          <div class="history-title">Withdraw USDT <span class="history-status ${item.status}">${item.status}</span></div>
          <div class="history-date">${timeStr}</div>
        </div>
        <div class="history-amount wd">-${item.amount.toFixed(8)}</div>
      </div>`;
    } else {
      const title = item.type === 'checkin' ? 'Check-in Harian' : 'Tonton Iklan';
      return `<div class="history-item">
        <div class="history-left">
          <div class="history-title">${title}</div>
          <div class="history-date">${timeStr}</div>
        </div>
        <div class="history-amount">+${item.reward.toFixed(8)}</div>
      </div>`;
    }
  }).join('');
}

$('checkinBtn').addEventListener('click', doCheckin);
$('watchBtn').addEventListener('click', watchAd);
$('withdrawBtn').addEventListener('click', doWithdraw);

$('inviteBtn').addEventListener('click', async () => {
  const res = await fetch(`/api/invite?telegram_id=${userId}`);
  const data = await res.json();
  if (data.link) {
    navigator.clipboard.writeText(data.link).then(() => {
      toast('Link invite disalin!');
    }).catch(() => {
      toast(data.link);
    });
  }
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    if (target === 'home') {
      $('tab-home').classList.remove('hidden');
      $('tab-history').classList.add('hidden');
    } else {
      $('tab-home').classList.add('hidden');
      $('tab-history').classList.remove('hidden');
      loadHistory();
    }
  });
});

if (initUser()) {
  loadProfile();
}
