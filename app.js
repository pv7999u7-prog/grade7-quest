'use strict';
// 國一闖關王（社會＋自然）
// 每日任務、錯題間隔複習、連續打卡、重點筆記、獎勵商店、家長頁
// 所有進度都存在這台裝置的 localStorage

const STORE_KEY = 'grade7-quest-v1';
const OLD_KEYS = ['social-quest-v1', 'science-quest-v1']; // 舊的社會闖關王、自然闖關王（同網域，可直接搬進度）

// ───────── 任務與獎勵規則 ─────────
const CHALLENGE_SIZE = 10;       // 每科挑戰題數
const TASK_COINS = 10;           // 每完成一項每日任務
const CHEST_COINS = 30;          // 四項任務全完成的每日寶箱
const DAILY_CAP = 100;           // 每天最多拿到的金幣（自動發的全部都算，家長手動加的不算）
const WEEK_GOAL = 5;             // 一週打卡幾天可以開週寶箱
const WEEK_COINS = 100;
const MILESTONES = [[3, 30], [7, 80], [14, 150], [30, 300], [60, 500], [100, 1000]]; // 連續天數里程碑 → 金幣
const SHIELD_COST = 200;         // 連續保護卡：漏掉一天也不會斷
const SHIELD_MAX = 2;
const NOTE_SECONDS = 20;         // 重點筆記至少要讀幾秒才能按「讀完了」
const NOTE_XP = 15;
const REVIEW_STEPS = [1, 3, 7];  // 錯題：答錯隔 1 天，之後答對隔 3 天、7 天，再答對就畢業
const DEFAULT_REWARDS = [
  { icon: '📱', name: '多玩 30 分鐘平板', cost: 450 },
  { icon: '🍦', name: '一份喜歡的點心', cost: 350 },
  { icon: '🍽️', name: '決定一次晚餐吃什麼', cost: 600 },
  { icon: '🎬', name: '週末電影之夜', cost: 900 },
  { icon: '🎁', name: '小禮物（爸媽決定）', cost: 1500 },
];
const OLD_REWARD_COSTS = { '多玩 30 分鐘平板': 150, '一份喜歡的點心': 200, '決定一次晚餐吃什麼': 300, '週末電影之夜': 500, '小禮物（爸媽決定）': 800 };
const TITLES = ['見習探險家', '用功小學徒', '知識獵人', '地圖達人', '時光旅人', '細胞偵探', '社會小博士', '自然小博士', '學霸', '闖關王'];
const AVATARS = ['🐣', '🐥', '🦊', '🐼', '🦉', '🐯', '🦁', '🐲', '🦄', '👑'];

const QMAP = Object.fromEntries(BANK.map(q => [q.id, q]));
const CH = Object.fromEntries(CHAPTERS.map(c => [c.key, c]));
const chOf = q => CH[`${q.s}-${q.ch}`];
const groupOf = q => SUBJ[q.s].group;
const app = document.getElementById('app');

// ───────── 日期 ─────────
function dayKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}
function weekStart(key) {
  const [y, m, d] = key.split('-').map(Number);
  const wd = (new Date(y, m - 1, d).getDay() + 6) % 7; // 週一 = 0
  return addDays(key, -wd);
}
const today = () => dayKey();
const shortDate = k => k.slice(5).replace('-', '/');

// ───────── 存檔 ─────────
let storageOk = true;
function freshState() {
  return {
    v: 1, xp: 0, coins: 0, streak: 0, bestStreak: 0, lastDone: null, lastMilestone: 0, shields: 0,
    pin: '0000',
    range: CHAPTERS.filter(c => c.exam === 2).map(c => c.key),
    q: {},          // 題目 id → { n 作答次數, r 答對, w 答錯, box 複習階段, due 下次複習日, book 是否在錯題本 }
    days: {},       // 日期 → 當天任務進度
    weeks: {},      // 週一日期 → { days: [打卡日], claimed }
    notesRead: {},  // 章節 key → 最後讀完的日期
    rewards: DEFAULT_REWARDS.map(r => ({ ...r })),
    rewardsVer: 2,
    pet: newPet(),  // 小雞養成（pet.js）
    redeems: [],    // 兌換紀錄：孩子申請（paid: false）→ 家長按兌換才扣金幣（done: true）
  };
}
// 把舊的社會闖關王、自然闖關王進度合併進來
function migrateOld(s) {
  let found = false;
  for (const k of OLD_KEYS) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const o = JSON.parse(raw);
      found = true;
      s.xp += o.xp || 0;
      s.coins += o.coins || 0;
      s.bestStreak = Math.max(s.bestStreak, o.bestStreak || 0);
      if (o.lastDone && (!s.lastDone || o.lastDone > s.lastDone || (o.lastDone === s.lastDone && (o.streak || 0) > s.streak))) {
        s.lastDone = o.lastDone; s.streak = o.streak || 0;
      }
      Object.assign(s.q, o.q || {});
      for (const [day, v] of Object.entries(o.days || {})) {
        const t = s.days[day] ||= { answered: 0, correct: 0 };
        t.answered += v.answered || 0; t.correct += v.correct || 0;
      }
      if (o.pin && o.pin !== '0000' && s.pin === '0000') s.pin = o.pin;
    } catch (e) { /* 舊資料壞掉就略過 */ }
  }
  return found;
}
// 舊版存檔：預設獎品改成新價格（家長自己改過的不動）；舊兌換紀錄當時已扣過金幣
function upgradeRewards(s) {
  if ((s.rewardsVer || 1) >= 2) return s;
  for (const r of s.rewards || []) {
    const d = DEFAULT_REWARDS.find(x => x.name === r.name);
    if (d && OLD_REWARD_COSTS[r.name] === r.cost) r.cost = d.cost;
  }
  for (const r of s.redeems || []) if (!('paid' in r)) r.paid = true;
  s.rewardsVer = 2;
  return s;
}
let migratedNow = false;
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return Object.assign(freshState(), upgradeRewards(JSON.parse(raw)));
    const s = freshState();
    migratedNow = migrateOld(s);
    return s;
  } catch (e) { storageOk = false; }
  return freshState();
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { storageOk = false; }
}
let S = load();
if (migratedNow) save();

// ───────── 工具 ─────────
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<mark>$1</mark>');
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
let toastQueue = [], toastBusy = false;
function toast(msg) {
  toastQueue.push(msg);
  if (!toastBusy) nextToast();
}
function nextToast() {
  const msg = toastQueue.shift();
  if (!msg) { toastBusy = false; return; }
  toastBusy = true;
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.remove(); nextToast(); }, 2300);
}
function burst(emoji = '⭐', n = 14) {
  const cx = innerWidth / 2, cy = innerHeight / 2.5;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div');
    s.className = 'burst'; s.textContent = emoji;
    const ang = Math.random() * Math.PI * 2, dist = 120 + Math.random() * 160;
    s.style.left = cx + 'px'; s.style.top = cy + 'px';
    s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    s.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1300);
  }
}
const rec = id => (S.q[id] ||= { n: 0, r: 0, w: 0, box: 0, due: null, book: false });
// 發金幣：受每日上限限制，回傳實際拿到的數量
function earn(n) {
  const d = ensureDay();
  const got = Math.max(0, Math.min(n, DAILY_CAP - (d.earned || 0)));
  d.earned = (d.earned || 0) + got;
  S.coins += got;
  if (got < n && !d.capNoticed) { d.capNoticed = true; toast(`🪙 今天的金幣已達上限 ${DAILY_CAP} 個，明天再來！`); }
  return got;
}
const chTitle = c => `${SUBJ[c.s].name} ${c.label} ${c.name}`;
const chipOf = q => {
  const c = chOf(q);
  return `<span class="chip ${q.s}">${SUBJ[q.s].icon} ${q.sec ? `${q.sec} ${esc(SECS[q.sec] || '')}` : `${SUBJ[q.s].name} ${c.label}`}</span>`;
};
const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);

// ───────── 等級、連續天數 ─────────
function levelOf(xp) {
  let lv = 1, need = 200;
  while (xp >= need) { xp -= need; lv++; need = 200 + (lv - 1) * 100; }
  return { lv, cur: xp, need };
}
const titleOf = lv => TITLES[Math.min(Math.floor((lv - 1) / 2), TITLES.length - 1)];
const avatarOf = lv => AVATARS[Math.min(Math.floor((lv - 1) / 2), AVATARS.length - 1)];
function shownStreak() {
  const t = today();
  if (S.lastDone === t || S.lastDone === addDays(t, -1)) return S.streak;
  if (S.shields > 0 && S.lastDone === addDays(t, -2)) return S.streak; // 保護卡還能救
  return 0;
}
const nextMilestone = () => MILESTONES.find(([n]) => n > shownStreak());

// 社會、自然兩個挑戰都完成 → 今天打卡
function markStreakDay() {
  const t = today();
  if (S.lastDone === t) return;
  if (S.lastDone === addDays(t, -1)) S.streak++;
  else if (S.lastDone === addDays(t, -2) && S.shields > 0) { S.shields--; S.streak++; toast('🛡️ 保護卡生效，連續天數保住了！'); }
  else { S.streak = 1; S.lastMilestone = 0; }
  S.lastDone = t;
  S.bestStreak = Math.max(S.bestStreak, S.streak);
  const w = S.weeks[weekStart(t)] ||= { days: [], claimed: false };
  if (!w.days.includes(t)) w.days.push(t);
  for (const [n, c] of MILESTONES) {
    if (S.streak >= n && S.lastMilestone < n) {
      S.lastMilestone = n;
      const got = earn(c);
      toast(`🔥 連續 ${n} 天達成！${got ? `獎勵 ${got} 金幣` : '（今天金幣已達上限）'}`);
      burst('🔥', 16);
    }
  }
}
const thisWeek = () => S.weeks[weekStart(today())] || { days: [], claimed: false };

// ───────── 題目池 ─────────
const rangePool = () => BANK.filter(q => S.range.includes(`${q.s}-${q.ch}`));
function groupPool(g) {
  const p = rangePool().filter(q => groupOf(q) === g);
  return p.length ? p : BANK.filter(q => groupOf(q) === g); // 家長沒選這一科的範圍時，就全部章節都出
}
const dueList = () => Object.keys(S.q).filter(id => QMAP[id] && S.q[id].book && S.q[id].due <= today());
const bookList = () => Object.keys(S.q).filter(id => QMAP[id] && S.q[id].book);
const isMastered = id => { const r = S.q[id]; return r && r.r >= 2 && !r.book; };
const chMastery = key => { const qs = BANK.filter(q => `${q.s}-${q.ch}` === key); return qs.length ? qs.filter(q => isMastered(q.id)).length / qs.length : 0; };

// 新題優先，其次是正確率低的題目
function pickWeighted(pool, n, exclude = []) {
  return pool.filter(q => !exclude.includes(q.id)).map(q => {
    const r = S.q[q.id];
    return { q, score: (!r || !r.n) ? Math.random() * 0.3 : (r.r / r.n) + Math.random() * 0.6 };
  }).sort((a, b) => a.score - b.score).slice(0, n).map(x => x.q);
}

// 今天建議讀的重點：段考範圍內、最近沒讀過、精熟度最低的章節；單雙日輪流社會、自然
function suggestNote() {
  const t = today();
  const g = Number(t.slice(-2)) % 2 ? 'soc' : 'sci';
  const inRange = CHAPTERS.filter(c => S.range.includes(c.key));
  const cand = (list) => list.filter(c => !S.notesRead[c.key] || S.notesRead[c.key] < addDays(t, -6));
  const tries = [inRange.filter(c => SUBJ[c.s].group === g), inRange, CHAPTERS.filter(c => SUBJ[c.s].group === g), CHAPTERS];
  for (const list of tries) {
    const c = cand(list);
    if (c.length) return c.sort((a, b) => chMastery(a.key) - chMastery(b.key))[0].key;
  }
  return CHAPTERS[0].key;
}

// ───────── 每日任務 ─────────
function ensureDay() {
  const k = today();
  const d = S.days[k] ||= { answered: 0, correct: 0 };
  if (!('soc' in d)) {
    Object.assign(d, { soc: false, sci: false, note: false, review: false, practice: false, chest: false, paid: {},
      dueAtStart: dueList().length, noteKey: suggestNote() });
    save();
  }
  return d;
}
function tasks() {
  const d = ensureDay();
  const c = CH[d.noteKey] || CHAPTERS[0];
  return [
    { id: 'soc', icon: '🌏', name: `社會挑戰 ${CHALLENGE_SIZE} 題`, sub: '地理・歷史・公民', done: d.soc, go: "startChallenge('soc')" },
    { id: 'sci', icon: '🔬', name: `自然挑戰 ${CHALLENGE_SIZE} 題`, sub: '生物', done: d.sci, go: "startChallenge('sci')" },
    { id: 'note', icon: '📖', name: '讀一篇重點筆記', sub: `今日推薦：${chTitle(c)}`, done: d.note, go: `openNote('${c.key}')` },
    d.dueAtStart > 0
      ? { id: 'review', icon: '📕', name: '複習到期錯題', sub: `今天有 ${d.dueAtStart} 題要複習`, done: d.review || dueList().length === 0, go: 'startReview()' }
      : { id: 'review', icon: '🎯', name: '加練一回', sub: '任選一章練習', done: d.practice, go: 'go(practiceMenu)' },
  ];
}
// 完成任務就發金幣（每項每天只發一次）
function payTasks() {
  const d = ensureDay();
  for (const t of tasks()) {
    if (t.done && !d.paid[t.id]) {
      d.paid[t.id] = true;
      const got = earn(TASK_COINS);
      toast(`✅ 任務完成：${t.name}${got ? `　+${got} 金幣` : ''}`);
    }
  }
  save();
}

// ───────── 畫面：首頁 ─────────
function home() {
  stopNoteTimer();
  const d = ensureDay();
  if (!d.rangeSet) { rangePage(true); return; }
  const L = levelOf(S.xp);
  const ts = tasks();
  const allDone = ts.every(t => t.done);
  const due = dueList().length;
  const wk = thisWeek();
  const ws = weekStart(today());
  const nm = nextMilestone();
  const pending = pendingReqs().length;
  app.innerHTML = `
    <div class="card hero">
      <button class="avatar pet-mini" onclick="go(petPage)" aria-label="我的小雞">${petMini()}</button>
      <div class="hero-main">
        <div class="title-line">Lv.${L.lv} ${titleOf(L.lv)}</div>
        <div class="xpbar"><div style="width:${(L.cur / L.need * 100).toFixed(1)}%"></div></div>
        <div class="small muted">經驗值 ${L.cur} / ${L.need}</div>
      </div>
    </div>
    <div class="stats loose">
      <div class="stat"><b>🔥 ${shownStreak()}</b><span>連續天數${S.shields ? `　🛡️×${S.shields}` : ''}</span></div>
      <div class="stat"><b>🪙 ${S.coins}</b><span>金幣</span></div>
      <div class="stat"><b>📕 ${bookList().length}</b><span>錯題本</span></div>
    </div>

    <div class="card" style="margin-top:14px">
      <div class="row between"><h2>📋 今日任務</h2><span class="small muted">${shortDate(today())}・今日 🪙 ${d.earned || 0}/${DAILY_CAP}</span></div>
      ${ts.map(t => `
        <div class="task">
          <div class="check ${t.done ? 'on' : ''}">${t.done ? '✓' : t.icon}</div>
          <div class="task-main"><div class="task-name">${esc(t.name)}</div><div class="small muted">${esc(t.sub)}</div></div>
          ${t.done ? '<span class="done-tag">完成</span>' : `<button class="go-btn" onclick="${t.go}">開始</button>`}
        </div>`).join('')}
      <div style="margin-top:12px">
        ${allDone && !d.chest ? `<button class="big-btn gold" onclick="openChest()">🎁 打開今日寶箱（+${CHEST_COINS} 🪙）</button>`
          : allDone ? `<div class="rest">🎉 今天的任務全部完成！好好休息，明天見～</div>`
          : `<div class="small muted center">社會＋自然挑戰都完成就算打卡 🔥；四項全做完可以開寶箱 🎁</div>`}
      </div>
    </div>

    <div class="card range-card" onclick="go(() => rangePage(false))">
      <div class="row between"><h3>🎯 練習範圍</h3><button class="btn-sm">更改</button></div>
      <div class="small" style="margin-top:6px">${rangeSummary()}</div>
    </div>

    <div class="card">
      <div class="row between"><h3>📅 本週打卡</h3><span class="small muted">${wk.days.length} / ${WEEK_GOAL} 天 → 週寶箱 +${WEEK_COINS} 🪙</span></div>
      <div class="week-dots">${['一', '二', '三', '四', '五', '六', '日'].map((w, i) => {
        const k = addDays(ws, i);
        const on = wk.days.includes(k);
        return `<div class="wd ${on ? 'on' : ''} ${k === today() ? 'today' : ''}"><span>${on ? '🔥' : ''}</span>${w}</div>`;
      }).join('')}</div>
      ${wk.days.length >= WEEK_GOAL && !wk.claimed ? `<button class="big-btn gold" style="margin-top:12px" onclick="claimWeek()">🏆 打開週寶箱（+${WEEK_COINS} 🪙）</button>` : ''}
      ${wk.claimed ? '<div class="small center" style="margin-top:8px">🏆 本週寶箱已領取，太厲害了！</div>' : ''}
      ${nm ? `<div class="small muted center" style="margin-top:8px">再連續 ${nm[0] - shownStreak()} 天，達成 🔥${nm[0]} 天獎勵 +${nm[1]} 🪙</div>` : ''}
    </div>

    <div class="grid2">
      <button class="tile" onclick="go(practiceMenu)"><span class="ico">🎯</span>自由練習</button>
      <button class="tile" onclick="go(notesMenu)"><span class="ico">📖</span>重點筆記</button>
      <button class="tile" onclick="go(bookPage)"><span class="ico">📕</span>錯題本${due ? `<span class="badge">${due}</span>` : ''}</button>
      <button class="tile" onclick="go(shopPage)"><span class="ico">🎁</span>獎勵商店${pending ? `<span class="badge gold-badge">${pending}</span>` : ''}</button>
      <button class="tile" onclick="go(achievePage)"><span class="ico">🏅</span>我的紀錄</button>
      <button class="tile" onclick="go(pinPage)"><span class="ico">👨‍👩‍👧</span>家長</button>
    </div>
    ${storageOk ? '' : '<p class="small" style="color:var(--bad)">⚠️ 這台裝置無法儲存進度（可能是無痕模式）。</p>'}
  `;
}

function openChest() {
  const d = ensureDay();
  if (d.chest) return;
  d.chest = true;
  const got = earn(CHEST_COINS);
  save();
  burst('🪙', 18);
  toast(got ? `寶箱打開了！獲得 ${got} 金幣` : '寶箱打開了！（今天金幣已達上限）');
  home();
}
function claimWeek() {
  const w = S.weeks[weekStart(today())];
  if (!w || w.claimed || w.days.length < WEEK_GOAL) return;
  w.claimed = true;
  const got = earn(WEEK_COINS);
  save();
  burst('🏆', 20);
  toast(got ? `週寶箱！獲得 ${got} 金幣` : '週寶箱打開了！（今天金幣已達上限）');
  home();
}

// ───────── 答題流程 ─────────
let sess = null;

function startSession(mode, qs, label, group) {
  stopNoteTimer();
  if (!qs.length) { toast('沒有可以練習的題目'); return; }
  sess = { mode, label, group, qs, i: 0, correct: 0, combo: 0, maxCombo: 0, xp: 0, coins: 0, graduated: [], wrongIds: [] };
  renderQ();
  scrollTo(0, 0);
}
function startChallenge(g) {
  const due = shuffle(dueList().filter(id => groupOf(QMAP[id]) === g)).slice(0, 4).map(id => QMAP[id]);
  const rest = pickWeighted(groupPool(g), CHALLENGE_SIZE - due.length, due.map(q => q.id));
  startSession('challenge', shuffle([...due, ...rest]), `${GROUPS[g].icon} ${GROUPS[g].name}挑戰`, g);
}
function startReview() {
  startSession('review', shuffle(dueList()).map(id => QMAP[id]), '📕 錯題複習');
}
function startPractice(key) {
  if (key) {
    const qs = BANK.filter(q => `${q.s}-${q.ch}` === key);
    startSession('practice', shuffle(pickWeighted(qs, 10)), chTitle(CH[key]));
  }
}
function startRangePractice(g) {
  startSession('practice', shuffle(pickWeighted(groupPool(g), 10)), `${GROUPS[g].name}段考範圍綜合練習`);
}
function startBookAll() {
  startSession('practice', shuffle(bookList()).slice(0, 10).map(id => QMAP[id]), '錯題練習');
}

function renderQ() {
  const q = sess.qs[sess.i];
  sess.answered = false;
  sess.optOrder = shuffle(q.o.map((_, i) => i));
  sess.picked = [];
  const head = `
    <div class="qhead">
      <button class="back" onclick="quitSession()">✕</button>
      <div class="qbar"><div style="width:${sess.i / sess.qs.length * 100}%"></div></div>
      <div class="combo">${sess.combo >= 2 ? `🔥×${sess.combo}` : `${sess.i + 1}/${sess.qs.length}`}</div>
    </div>
    <div class="row wrap">${chipOf(q)}
      ${S.q[q.id]?.book ? '<span class="chip" style="background:var(--bad)">錯題複習</span>' : ''}</div>
    <div class="question">${esc(q.q)}</div>`;
  if (q.t === 'order') {
    app.innerHTML = head + `<div class="small muted">依序點選下面的項目，點錯可以再點一次取消。</div><div id="qbody"></div>`;
    renderOrder();
  } else {
    app.innerHTML = head + `
      <div class="opts">${sess.optOrder.map((oi, k) =>
        `<button class="opt" data-oi="${oi}" onclick="answerMC(${oi})">${'ABCD'[k]}．${esc(q.o[oi])}</button>`).join('')}</div>
      <div id="fb"></div>`;
  }
}

function answerMC(oi) {
  if (sess.answered) return;
  sess.answered = true;
  const q = sess.qs[sess.i];
  const ok = oi === q.a;
  document.querySelectorAll('.opt').forEach(b => {
    const v = +b.dataset.oi;
    b.disabled = true;
    if (v === q.a) b.classList.add('right');
    else if (v === oi) b.classList.add('wrong');
    else b.classList.add('dim');
  });
  afterAnswer(q, ok, ok ? '' : `正確答案：${q.o[q.a]}`);
}

function renderOrder() {
  const q = sess.qs[sess.i];
  const body = document.getElementById('qbody');
  const n = q.o.length;
  body.innerHTML = `
    <div class="slots">${Array.from({ length: n }, (_, k) => {
      const oi = sess.picked[k];
      return `<button class="slot ${oi !== undefined ? 'filled' : ''}" ${oi !== undefined && !sess.answered ? `onclick="unpick(${k})"` : 'disabled'} data-k="${k}">
        <span class="n">${k + 1}</span>${oi !== undefined ? esc(q.o[oi]) : ''}</button>`;
    }).join('')}</div>
    <div class="pool">${sess.optOrder.filter(oi => !sess.picked.includes(oi)).map(oi =>
      `<button class="opt" onclick="pick(${oi})" ${sess.answered ? 'disabled' : ''}>${esc(q.o[oi])}</button>`).join('')}</div>
    ${!sess.answered ? `<div style="margin-top:16px"><button class="big-btn" onclick="checkOrder()" ${sess.picked.length === n ? '' : 'disabled'}>確認順序</button></div>` : ''}
    <div id="fb"></div>`;
}
function pick(oi) { if (!sess.answered) { sess.picked.push(oi); renderOrder(); } }
function unpick(k) { if (!sess.answered) { sess.picked.splice(k, 1); renderOrder(); } }
function checkOrder() {
  const q = sess.qs[sess.i];
  sess.answered = true;
  const ok = sess.picked.every((oi, k) => oi === k);
  renderOrder();
  document.querySelectorAll('.slot').forEach(el => {
    const k = +el.dataset.k;
    el.classList.add(sess.picked[k] === k ? 'right' : 'wrong');
  });
  afterAnswer(q, ok, ok ? '' : `正確順序：${q.o.map((t, i) => `${i + 1}. ${t}`).join('　')}`);
}

function afterAnswer(q, ok, correctLine) {
  const r = rec(q.id);
  const d = ensureDay();
  const wasDue = r.book && r.due <= today();
  r.n++; d.answered++;
  let grad = false;
  if (ok) {
    r.r++; d.correct++;
    petLearn(); // 答對也會照顧小雞（pet.js）
    sess.correct++; sess.combo++;
    sess.maxCombo = Math.max(sess.maxCombo, sess.combo);
    sess.xp += 10 + Math.min(sess.combo - 1, 5) * 2;
    sess.coins += 1;
    if (wasDue) {
      r.box++;
      if (r.box >= REVIEW_STEPS.length) { r.book = false; r.due = null; r.box = 0; grad = true; sess.graduated.push(q.id); }
      else r.due = addDays(today(), REVIEW_STEPS[r.box]);
    }
  } else {
    r.w++;
    sess.combo = 0;
    r.book = true; r.box = 0; r.due = addDays(today(), REVIEW_STEPS[0]);
    if (!sess.wrongIds.includes(q.id)) sess.wrongIds.push(q.id);
  }
  save();

  const praise = ['答對了！', '太棒了！', '完全正確！', '好厲害！', '沒錯！'];
  const fb = document.getElementById('fb');
  const last = sess.i === sess.qs.length - 1;
  const c = chOf(q);
  fb.innerHTML = `
    <div class="feedback ${ok ? 'ok' : 'bad'}">
      <h3>${ok ? '✅ ' + praise[Math.floor(Math.random() * praise.length)] : '❌ 再想想看'}${grad ? '　🎓 這題從錯題本畢業了！' : ''}</h3>
      ${correctLine ? `<div style="font-weight:700;margin-bottom:6px">${esc(correctLine)}</div>` : ''}
      <div>💡 ${esc(q.e)}</div>
      ${!ok ? `<div class="row between wrap" style="margin-top:8px"><span class="small muted">已放進錯題本，明天會再出現喔。</span>
        <button class="btn-sm" onclick="showNoteModal('${c.key}')">📖 看這章重點</button></div>` : ''}
    </div>
    <div style="margin-top:14px"><button class="big-btn ${ok ? 'green' : ''}" onclick="nextQ()">${last ? '看結果' : '下一題 ➜'}</button></div>`;
  if (ok && sess.combo >= 3 && sess.combo % 3 === 0) burst('🔥', 8);
  if (!ok) app.querySelector('.question')?.classList.add('shake');
  fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function nextQ() {
  sess.i++;
  if (sess.i < sess.qs.length) { renderQ(); scrollTo(0, 0); }
  else finishSession();
}

function quitSession() {
  if (sess.i > 0 && !confirm('確定要離開嗎？已經作答的題目會保留紀錄，但這一回不會算完成。')) return;
  S.xp += sess.xp; earn(sess.coins); save();
  sess = null;
  home();
}

function finishSession() {
  const d = ensureDay();
  const total = sess.qs.length;
  const perfect = sess.correct === total;
  let bonus = false;
  if (perfect && total >= 5) { bonus = true; sess.xp += 20; sess.coins += 5; }
  if (sess.mode === 'challenge') {
    d[sess.group] = true;
    if (d.soc && d.sci) markStreakDay();
  } else if (sess.mode === 'review') d.review = true;
  else d.practice = true;
  const lvBefore = levelOf(S.xp).lv;
  S.xp += sess.xp;
  sess.coins = earn(sess.coins);
  const lvAfter = levelOf(S.xp).lv;
  save();
  payTasks();

  const ratio = sess.correct / total;
  const emoji = perfect ? '🏆' : ratio >= 0.8 ? '🎉' : ratio >= 0.6 ? '👍' : '💪';
  const msg = perfect ? '全對！太強了！' : ratio >= 0.8 ? '表現很棒！' : ratio >= 0.6 ? '不錯喔，錯的題目再看一下重點！' : '別灰心，錯題本會幫你記住！';
  const other = sess.mode === 'challenge' ? (sess.group === 'soc' ? (!d.sci ? 'sci' : null) : (!d.soc ? 'soc' : null)) : null;
  const weakCh = sess.wrongIds.length ? chOf(QMAP[sess.wrongIds[0]]) : null;
  app.innerHTML = `
    <div class="card result">
      <div class="emoji">${emoji}</div>
      <div class="muted">${esc(sess.label)}</div>
      <div class="score">${sess.correct} / ${total}</div>
      <div style="font-size:20px;font-weight:700">${msg}</div>
      <div class="gains">
        <span class="gain">⭐ 經驗 +${sess.xp}</span>
        <span class="gain">🪙 金幣 +${sess.coins}</span>
        ${sess.maxCombo >= 3 ? `<span class="gain">🔥 最高連對 ${sess.maxCombo}</span>` : ''}
        ${bonus ? `<span class="gain">🏆 全對獎勵</span>` : ''}
      </div>
      ${sess.mode === 'challenge' && d.soc && d.sci ? `<div class="gain" style="display:inline-block">🔥 今日打卡完成！連續 ${S.streak} 天</div>` : ''}
      ${lvAfter > lvBefore ? `<div style="font-size:22px;font-weight:800;margin-top:12px">🎊 升級！Lv.${lvAfter} ${titleOf(lvAfter)}</div>` : ''}
      ${sess.graduated.length ? `<p>🎓 有 ${sess.graduated.length} 題從錯題本畢業了！</p>` : ''}
    </div>
    ${sess.wrongIds.length ? `
      <div class="card">
        <h3>這回答錯的題目</h3>
        ${sess.wrongIds.map(id => { const q = QMAP[id]; return `
          <div class="bk">${chipOf(q)} <div style="margin-top:4px">${esc(q.q)}</div>
          <div class="small" style="margin-top:4px">✔ ${esc(q.t === 'order' ? q.o.join(' → ') : q.o[q.a])}</div></div>`; }).join('')}
        ${weakCh ? `<button class="btn-sm" style="margin-top:10px" onclick="openNote('${weakCh.key}')">📖 讀「${esc(weakCh.name)}」重點</button>` : ''}
      </div>` : ''}
    ${other ? `<button class="big-btn green" onclick="startChallenge('${other}')">接著做${GROUPS[other].name}挑戰 ➜</button><div style="height:10px"></div>` : ''}
    <button class="big-btn ${other ? 'ghost' : ''}" onclick="home()">回首頁</button>`;
  if (perfect || lvAfter > lvBefore) burst(perfect ? '🌟' : '🎊', 20);
  sess = null;
  scrollTo(0, 0);
}

// ───────── 畫面：自由練習 ─────────
let tab = 'soc';
function setTab(g, fn) { tab = g; fn(); }
function tabsHtml(fn) {
  return `<div class="tabs">${Object.entries(GROUPS).map(([g, info]) =>
    `<button class="${tab === g ? 'on' : ''}" onclick="setTab('${g}', ${fn})">${info.icon} ${info.name}</button>`).join('')}</div>`;
}
function examTag(c) { return `<span class="exam-tag e${c.exam}">${['', '一段', '二段', '三段'][c.exam]}</span>`; }
function practiceMenu() {
  app.innerHTML = `
    <div class="top-bar"><button class="back" onclick="home()">← 首頁</button><h2>🎯 自由練習</h2></div>
    ${tabsHtml('practiceMenu')}
    <button class="big-btn" onclick="startRangePractice('${tab}')">${GROUPS[tab].name}段考範圍綜合練習（10 題）</button>
    <div style="height:14px"></div>
    ${GROUPS[tab].subjects.map(s => `
      <div class="card">
        <div class="subj-h"><span>${SUBJ[s].icon}</span>${SUBJ[s].name}</div>
        ${CHAPTERS.filter(c => c.s === s).map(c => {
          const qs = BANK.filter(q => `${q.s}-${q.ch}` === c.key);
          return `<button class="ch-btn" onclick="startPractice('${c.key}')">
            <span>${examTag(c)} ${c.label} ${c.name}</span>
            <span class="meta">精熟 ${Math.round(chMastery(c.key) * 100)}%・${qs.length} 題</span></button>`;
        }).join('')}
      </div>`).join('')}`;
}

// ───────── 畫面：重點筆記 ─────────
function notesMenu() {
  stopNoteTimer();
  app.innerHTML = `
    <div class="top-bar"><button class="back" onclick="home()">← 首頁</button><h2>📖 重點筆記</h2></div>
    ${tabsHtml('notesMenu')}
    <div class="card small">每天讀一篇重點可以完成任務 📖。答錯題目時也可以直接打開那一章的重點。</div>
    ${GROUPS[tab].subjects.map(s => `
      <div class="card">
        <div class="subj-h"><span>${SUBJ[s].icon}</span>${SUBJ[s].name}</div>
        ${CHAPTERS.filter(c => c.s === s).map(c => `
          <button class="ch-btn" onclick="openNote('${c.key}')">
            <span>${examTag(c)} ${c.label} ${c.name}</span>
            <span class="meta">${S.notesRead[c.key] ? `✓ ${shortDate(S.notesRead[c.key])} 讀過` : `<span class="stars">${stars(c.star)}</span>`}</span>
          </button>`).join('')}
      </div>`).join('')}`;
}
function noteHtml(c) {
  return `
    <div class="note">
      <div class="row between wrap"><span class="chip ${c.s}">${SUBJ[c.s].icon} ${SUBJ[c.s].name} ${c.label}</span>
        <span class="small muted">考試重要度 <span class="stars">${stars(c.star)}</span></span></div>
      <h2 style="margin:10px 0 6px">${esc(c.name)}</h2>
      <div class="goal">🎯 ${esc(c.goal)}</div>
      ${c.blocks.map(([h, items]) => `
        <div class="note-block"><h3>${esc(h)}</h3><ul>${items.map(t => `<li>${md(t)}</li>`).join('')}</ul></div>`).join('')}
      ${c.tip ? `<div class="note-box tip"><b>💡 記憶口訣</b><div>${md(c.tip)}</div></div>` : ''}
      ${c.trap ? `<div class="note-box trap"><b>⚠️ 易錯陷阱</b><div>${md(c.trap)}</div></div>` : ''}
      ${c.often ? `<div class="note-box exam"><b>📝 常考題型</b><div>${md(c.often)}</div></div>` : ''}
    </div>`;
}
let noteTimer = null;
function stopNoteTimer() { if (noteTimer) { clearInterval(noteTimer); noteTimer = null; } }
function openNote(key) {
  stopNoteTimer();
  const c = CH[key];
  const readToday = S.notesRead[key] === today();
  app.innerHTML = `
    <div class="top-bar"><button class="back" onclick="go(notesMenu)">← 筆記</button><button class="back" onclick="home()">首頁</button></div>
    <div class="card">${noteHtml(c)}</div>
    <button id="readBtn" class="big-btn green" onclick="finishNote('${key}')" ${readToday ? 'disabled' : 'disabled'}>
      ${readToday ? '✓ 今天已經讀過這篇' : `再讀 ${NOTE_SECONDS} 秒…`}</button>
    <div style="height:10px"></div>
    <button class="big-btn ghost" onclick="startPractice('${key}')">🎯 練習這一章（10 題）</button>`;
  scrollTo(0, 0);
  if (readToday) return;
  let left = NOTE_SECONDS;
  noteTimer = setInterval(() => {
    const b = document.getElementById('readBtn');
    if (!b) { stopNoteTimer(); return; }
    left--;
    if (left > 0) b.textContent = `再讀 ${left} 秒…`;
    else { stopNoteTimer(); b.disabled = false; b.textContent = `✓ 我讀完了（+${NOTE_XP} 經驗）`; }
  }, 1000);
}
function finishNote(key) {
  if (S.notesRead[key] === today()) return;
  S.notesRead[key] = today();
  S.xp += NOTE_XP;
  ensureDay().note = true;
  save();
  payTasks();
  burst('📖', 10);
  const b = document.getElementById('readBtn');
  if (b) { b.disabled = true; b.textContent = '✓ 讀完了！'; }
  setTimeout(home, 1200);
}
function showNoteModal(key) {
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="modal-card">${noteHtml(CH[key])}
    <button class="big-btn" style="margin-top:14px" onclick="this.closest('.modal').remove()">關閉，回到題目</button></div>`;
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  document.body.appendChild(m);
}

// ───────── 畫面：錯題本 ─────────
function bookPage() {
  const ids = bookList().sort((a, b) => S.q[a].due.localeCompare(S.q[b].due));
  const due = dueList().length;
  const t = today();
  app.innerHTML = `
    <div class="top-bar"><button class="back" onclick="home()">← 首頁</button><h2>📕 錯題本</h2></div>
    <div class="card small">答錯的題目會在 <b>1 天、3 天、7 天</b>後回來考你，<b>連續答對 3 次</b>就能畢業 🎓</div>
    ${due ? `<button class="big-btn" onclick="startReview()">複習今天到期的 ${due} 題</button><div style="height:10px"></div>` : ''}
    ${ids.length ? `<button class="big-btn ghost" onclick="startBookAll()">隨機練習錯題（不影響複習進度）</button><div style="height:14px"></div>` : ''}
    <div class="card">
      ${ids.length ? ids.map(id => {
        const q = QMAP[id], r = S.q[id];
        const when = r.due <= t ? '<b style="color:var(--bad)">今天要複習</b>' : r.due === addDays(t, 1) ? '明天複習' : `${shortDate(r.due)} 複習`;
        return `<div class="bk">
          <div class="row between wrap">${chipOf(q)}<span class="small">${when}</span></div>
          <div style="margin-top:6px">${esc(q.q)}</div>
          <div class="small muted">畢業進度 <span class="dots">${'●'.repeat(r.box)}${'○'.repeat(REVIEW_STEPS.length - r.box)}</span>　答錯 ${r.w} 次</div>
        </div>`;
      }).join('') : '<div class="rest">錯題本是空的，太厲害了！✨</div>'}
    </div>`;
}

// ───────── 畫面：獎勵商店 ─────────
// 孩子在這裡「申請兌換」，金幣先保留；爸媽在家長頁按「兌換」才真的扣金幣
const pendingReqs = () => S.redeems.filter(r => !r.done && !r.paid);
const reserved = () => pendingReqs().reduce((a, r) => a + r.cost, 0);
const spendable = () => S.coins - reserved();
function shopPage() {
  const free = spendable();
  app.innerHTML = `
    <div class="top-bar"><button class="back" onclick="home()">← 首頁</button><h2>🎁 獎勵商店</h2></div>
    <div class="card center"><div class="small muted">我的金幣</div><div class="coin-big">🪙 ${S.coins}</div>
      ${reserved() ? `<div class="small pending">其中 ${reserved()} 個保留給申請中的獎勵，還能用 ${free} 個</div>` : ''}
      <div class="small muted">答對 1 題 +1、每項任務 +${TASK_COINS}、每日寶箱 +${CHEST_COINS}、週寶箱和連續天數里程碑還有加碼。<b>每天最多拿 ${DAILY_CAP} 個金幣。</b></div></div>
    <div class="card">
      <h3>🎁 兌換獎勵</h3>
      <p class="small muted">按「申請兌換」後拿給爸媽看，爸媽在家長頁按「兌換」就完成了。</p>
      ${S.rewards.length ? S.rewards.map((r, i) => `
        <div class="shop-row">
          <span class="shop-ico">${esc(r.icon || '🎁')}</span>
          <div class="task-main"><div class="task-name">${esc(r.name)}</div><div class="small muted">🪙 ${r.cost}</div></div>
          <button class="go-btn" onclick="requestRedeem(${i})" ${free >= r.cost ? '' : 'disabled'}>${free >= r.cost ? '申請兌換' : `差 ${r.cost - free}`}</button>
        </div>`).join('') : '<p class="muted">爸媽還沒有設定獎勵。</p>'}
    </div>
    <div class="card">
      <h3>🛡️ 連續保護卡</h3>
      <p class="small muted">哪天忘了打卡，保護卡會自動幫你保住連續天數（最多同時擁有 ${SHIELD_MAX} 張）。目前有 ${S.shields} 張。</p>
      <button class="go-btn" onclick="buyShield()" ${free >= SHIELD_COST && S.shields < SHIELD_MAX ? '' : 'disabled'}>🪙 ${SHIELD_COST} 購買</button>
    </div>
    ${S.redeems.length ? `
      <div class="card">
        <h3>📜 兌換紀錄</h3>
        ${S.redeems.slice(0, 15).map(r => `<div class="bk row between"><span>${esc(r.name)}<span class="small muted">　${shortDate(r.date)}・🪙 ${r.cost}</span></span>
          <span class="small ${r.done ? '' : 'pending'}">${r.done ? '✓ 已兌換' : '等爸媽兌換'}</span></div>`).join('')}
      </div>` : ''}`;
}
function requestRedeem(i) {
  const r = S.rewards[i];
  if (!r || spendable() < r.cost) return;
  if (!confirm(`申請用 ${r.cost} 金幣兌換「${r.name}」嗎？`)) return;
  S.redeems.unshift({ id: Date.now(), name: r.name, cost: r.cost, date: today(), done: false, paid: false });
  save();
  burst('🎁', 12);
  toast('已送出申請！拿給爸媽看吧');
  shopPage();
}
function buyShield() {
  if (spendable() < SHIELD_COST || S.shields >= SHIELD_MAX) return;
  if (!confirm(`用 ${SHIELD_COST} 金幣買一張連續保護卡嗎？`)) return;
  S.coins -= SHIELD_COST; S.shields++;
  S.shieldSpent = (S.shieldSpent || 0) + SHIELD_COST;
  const sd = ensureDay(); sd.shieldSpent = (sd.shieldSpent || 0) + SHIELD_COST;
  save();
  toast('🛡️ 獲得一張保護卡');
  shopPage();
}

// ───────── 畫面：我的紀錄 ─────────
function achievePage() {
  const L = levelOf(S.xp);
  const all = Object.values(S.q);
  const answered = Object.values(S.days).reduce((a, d) => a + (d.answered || 0), 0);
  const right = all.reduce((a, r) => a + r.r, 0), tries = all.reduce((a, r) => a + r.n, 0);
  const mastered = BANK.filter(q => isMastered(q.id)).length;
  const notes = Object.keys(S.notesRead).length;
  const grpMastery = g => { const qs = BANK.filter(q => groupOf(q) === g); return qs.filter(q => isMastered(q.id)).length / qs.length; };
  const badges = [
    { ico: '🌱', name: '第一步', ok: answered >= 1, how: '答第 1 題' },
    { ico: '🔥', name: '三天連續', ok: S.bestStreak >= 3, how: '連續打卡 3 天' },
    { ico: '📅', name: '一週不間斷', ok: S.bestStreak >= 7, how: '連續打卡 7 天' },
    { ico: '🌙', name: '一個月達人', ok: S.bestStreak >= 30, how: '連續打卡 30 天' },
    { ico: '💯', name: '百題達成', ok: answered >= 100, how: '累積答 100 題' },
    { ico: '🚀', name: '五百題', ok: answered >= 500, how: '累積答 500 題' },
    { ico: '🎓', name: '錯題剋星', ok: all.some(r => r.w > 0 && !r.book && r.r > 0), how: '讓 1 題從錯題本畢業' },
    { ico: '📖', name: '讀書蟲', ok: notes >= 10, how: '讀過 10 篇不同的重點' },
    { ico: '🌏', name: '社會通', ok: grpMastery('soc') >= 0.6, how: '社會題目精熟 60%' },
    { ico: '🔬', name: '自然通', ok: grpMastery('sci') >= 0.6, how: '自然題目精熟 60%' },
  ];
  app.innerHTML = `
    <div class="top-bar"><button class="back" onclick="home()">← 首頁</button><h2>🏅 我的紀錄</h2></div>
    <div class="card">
      <div class="title-line">${avatarOf(L.lv)} Lv.${L.lv} ${titleOf(L.lv)}</div>
      <div class="stats">
        <div class="stat"><b>${answered}</b><span>累積答題</span></div>
        <div class="stat"><b>${tries ? Math.round(right / tries * 100) : 0}%</b><span>正確率</span></div>
        <div class="stat"><b>${mastered}/${BANK.length}</b><span>精熟題數</span></div>
      </div>
      <p class="small muted">「精熟」＝答對 2 次以上，而且不在錯題本裡。最長連續 ${S.bestStreak} 天，讀過 ${notes} 篇重點。</p>
    </div>
    <div class="card">
      <h3>徽章</h3>
      <div class="grid2" style="margin-top:10px">
        ${badges.map(b => `<div class="stat" style="${b.ok ? '' : 'opacity:.4;filter:grayscale(1)'}">
          <b style="font-size:34px">${b.ico}</b><div style="font-weight:700">${b.name}</div><span>${b.how}</span></div>`).join('')}
      </div>
    </div>`;
}

// ───────── 家長：PIN ─────────
let pinBuf = '';
function pinPage() { pinBuf = ''; drawPin(); }
function drawPin(msg = '') {
  app.innerHTML = `
    <div class="top-bar"><button class="back" onclick="home()">← 首頁</button><h2>👨‍👩‍👧 家長專區</h2></div>
    <div class="card" style="text-align:center">
      <div>請輸入 4 位數家長密碼</div>
      <div class="pin-dots">${[0, 1, 2, 3].map(i => `<i class="${i < pinBuf.length ? 'on' : ''}"></i>`).join('')}</div>
      <div class="small" style="color:var(--bad);min-height:24px">${msg}</div>
      <div class="keypad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button onclick="pinKey('${n}')">${n}</button>`).join('')}
        <button onclick="pinKey('C')">⌫</button><button onclick="pinKey('0')">0</button><span></span>
      </div>
      ${S.pin === '0000' ? '<p class="small muted">預設密碼是 0000，進去後記得改掉。</p>' : ''}
    </div>`;
}
function pinKey(k) {
  if (k === 'C') pinBuf = pinBuf.slice(0, -1);
  else if (pinBuf.length < 4) pinBuf += k;
  if (pinBuf.length === 4) {
    if (pinBuf === S.pin) { pinBuf = ''; parentPage(); return; }
    pinBuf = ''; drawPin('密碼錯誤'); return;
  }
  drawPin();
}

// ───────── 家長：主頁 ─────────
function accColor(p) {
  if (p === null) return 'background:var(--bg);color:var(--muted)';
  if (p >= 0.8) return 'background:var(--ok-soft);color:var(--ok)';
  if (p >= 0.6) return 'background:#fff4dc;color:#a76a00';
  return 'background:var(--bad-soft);color:var(--bad)';
}
function parentPage() {
  const t = today();
  const week = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6));
  const maxA = Math.max(10, ...week.map(k => S.days[k]?.answered || 0));
  const stat = key => {
    const qs = BANK.filter(q => `${q.s}-${q.ch}` === key);
    let n = 0, r = 0, inBook = 0;
    qs.forEach(q => { const x = S.q[q.id]; if (x) { n += x.n; r += x.r; if (x.book) inBook++; } });
    return { n, acc: n ? r / n : null, inBook };
  };
  const worst = Object.entries(S.q).filter(([id, r]) => QMAP[id] && r.w > 0)
    .sort((a, b) => b[1].w - a[1].w || (a[1].r / a[1].n) - (b[1].r / b[1].n)).slice(0, 10);
  const pending = pendingReqs();

  app.innerHTML = `
    <div class="top-bar"><button class="back" onclick="home()">← 首頁</button><h2>👨‍👩‍👧 家長專區</h2></div>

    ${pending.length ? `
      <div class="card" style="border:2px solid var(--gold)">
        <h3>🎁 孩子申請的獎勵</h3>
        ${pending.map(r => `<div class="shop-row"><div class="task-main"><div class="task-name">${esc(r.name)}</div>
          <div class="small muted">${shortDate(r.date)} 申請・🪙 ${r.cost}</div></div>
          <button class="btn-sm danger" onclick="cancelRedeem(${r.id})">取消</button>
          <button class="go-btn" onclick="approveRedeem(${r.id})">兌換</button></div>`).join('')}
      </div>` : ''}

    <div class="card">
      <h3>🪙 兌換獎勵（扣金幣）</h3>
      <p class="small muted">孩子目前有 ${S.coins} 金幣。按「兌換」會直接扣掉金幣並留下紀錄。</p>
      ${S.rewards.map((r, i) => `<div class="shop-row"><span class="shop-ico">${esc(r.icon || '🎁')}</span>
        <div class="task-main"><div class="task-name">${esc(r.name)}</div><div class="small muted">🪙 ${r.cost}</div></div>
        <button class="go-btn" onclick="parentRedeem(${i})" ${S.coins >= r.cost ? '' : 'disabled'}>兌換</button></div>`).join('')}
    </div>

    ${coinFlowHtml()}

    <div class="card">
      <h3>近 7 天答題數</h3>
      <div class="week">${week.map(k => {
        const v = S.days[k]?.answered || 0;
        const done = thisWeekDone(k);
        return `<div class="col"><span class="v">${v || ''}</span><div class="bar" style="height:${v / maxA * 80}%;${done ? '' : 'background:#c9bff5'}"></div>${k.slice(8)}日</div>`;
      }).join('')}</div>
      <p class="small muted">深色長條＝當天社會、自然挑戰都完成（打卡）。目前連續 ${shownStreak()} 天，最長 ${S.bestStreak} 天，金幣 ${S.coins}，保護卡 ${S.shields} 張。</p>
    </div>

    <div class="card">
      <h3>段考範圍（每日挑戰的出題章節）</h3>
      <div class="btn-row">${[1, 2, 3].map(n => `<button class="btn-sm" onclick="setExam(${n})">${EXAMS[n]}</button>`).join('')}
        <button class="btn-sm" onclick="setExam(0)">全部章節</button></div>
      ${Object.entries(SUBJ).map(([s, info]) => `
        <div class="range-subj">${info.icon} ${info.name}</div>
        ${CHAPTERS.filter(c => c.s === s).map(c => `
          <label class="check-row"><input type="checkbox" ${S.range.includes(c.key) ? 'checked' : ''} onchange="toggleRange('${c.key}', this.checked)">
          ${examTag(c)} ${c.label} ${c.name}</label>`).join('')}`).join('')}
    </div>

    <div class="card">
      <h3>各章正確率</h3>
      <table><tr><th>章節</th><th class="num">作答</th><th class="num">正確率</th><th class="num">錯題</th><th class="num">筆記</th></tr>
      ${CHAPTERS.map(c => { const x = stat(c.key); return `<tr><td><span class="chip ${c.s}">${SUBJ[c.s].name}</span> ${c.label} ${c.name}</td>
        <td class="num">${x.n}</td>
        <td class="num"><span class="acc" style="${accColor(x.acc)}">${x.acc === null ? '—' : Math.round(x.acc * 100) + '%'}</span></td>
        <td class="num">${x.inBook}</td><td class="num">${S.notesRead[c.key] ? '✓' : ''}</td></tr>`; }).join('')}
      </table>
    </div>

    <div class="card">
      <h3>最常答錯的題目</h3>
      ${worst.length ? worst.map(([id, r]) => { const q = QMAP[id]; return `
        <div class="bk">${chipOf(q)} <span class="small muted">錯 ${r.w} 次／共 ${r.n} 次</span>
          <div style="margin-top:4px">${esc(q.q)}</div>
          <div class="small">✔ ${esc(q.t === 'order' ? q.o.join(' → ') : q.o[q.a])}</div></div>`; }).join('')
        : '<p class="muted">還沒有答錯的紀錄。</p>'}
    </div>

    <div class="card">
      <h3>🎁 獎勵商店設定</h3>
      <p class="small muted">可以改名稱、價格，或新增自己家的獎勵。</p>
      ${S.rewards.map((r, i) => `
        <div class="edit-row">
          <input type="text" class="ico-in" value="${esc(r.icon || '')}" onchange="editReward(${i}, 'icon', this.value)">
          <input type="text" class="name-in" value="${esc(r.name)}" onchange="editReward(${i}, 'name', this.value)">
          <input type="tel" class="cost-in" value="${r.cost}" onchange="editReward(${i}, 'cost', this.value)">
          <button class="btn-sm danger" onclick="delReward(${i})">刪除</button>
        </div>`).join('')}
      <div class="edit-row">
        <input id="nr-ico" type="text" class="ico-in" placeholder="🎁">
        <input id="nr-name" type="text" class="name-in" placeholder="新獎勵名稱">
        <input id="nr-cost" type="tel" class="cost-in" placeholder="金幣">
        <button class="btn-sm" onclick="addReward()">新增</button>
      </div>
    </div>

    <div class="card">
      <h3>🪙 調整金幣</h3>
      <p class="small muted">表現特別好可以加碼，或扣回誤領的金幣。</p>
      <div class="row wrap">
        <input id="adj" type="tel" placeholder="數量" style="width:100px">
        <button class="btn-sm" onclick="adjustCoins(1)">＋ 加金幣</button>
        <button class="btn-sm danger" onclick="adjustCoins(-1)">－ 扣金幣</button>
      </div>
    </div>

    <div class="card">
      <h3>修改家長密碼</h3>
      <div class="row" style="margin-top:8px">
        <input id="newpin" type="tel" inputmode="numeric" maxlength="4" placeholder="新的 4 位數">
        <button class="btn-sm" onclick="changePin()">儲存</button>
      </div>
    </div>

    <div class="card">
      <h3>備份與還原</h3>
      <p class="small muted">進度只存在這台 iPad。換裝置或清除 Safari 資料前，請先備份。</p>
      <div class="btn-row">
        <button class="btn-sm" onclick="exportData()">⬇️ 匯出備份檔</button>
        <label class="btn-sm" style="cursor:pointer">⬆️ 匯入備份檔<input type="file" accept=".json,application/json" style="display:none" onchange="importData(this)"></label>
        <button class="btn-sm danger" onclick="resetAll()">🗑️ 清除所有進度</button>
      </div>
    </div>
    <p class="small muted center">題庫共 ${BANK.length} 題・重點筆記 ${CHAPTERS.length} 篇</p>`;
}
function thisWeekDone(k) { const w = S.weeks[weekStart(k)]; return !!(w && w.days.includes(k)); }
function setExam(n) {
  S.range = CHAPTERS.filter(c => !n || c.exam === n).map(c => c.key);
  save(); toast(n ? `已設定為${EXAMS[n]}範圍` : '已設定為全部章節'); parentPage();
}
// ───────── 孩子自己選出題範圍 ─────────
const groupChapters = g => CHAPTERS.filter(c => SUBJ[c.s].group === g);
const groupRange = g => groupChapters(g).filter(c => S.range.includes(c.key));
function rangeSummary() {
  return Object.entries(GROUPS).map(([g, info]) => {
    const r = groupRange(g);
    const lab = c => (info.subjects.length > 1 ? SUBJ[c.s].name : '') + c.label; // 社會有地理、歷史、公民，要標出科目
    const names = r.length > 4 ? `${r.slice(0, 4).map(lab).join('、')}…共 ${r.length} 個` : r.map(lab).join('、') || '（還沒選）';
    return `${info.icon} <b>${info.name}</b>：${esc(names)}`;
  }).join('<br>');
}
function rangePage(daily) {
  const d = ensureDay();
  app.innerHTML = `
    <div class="top-bar">${daily ? '' : '<button class="back" onclick="home()">← 首頁</button>'}<h2>🎯 今天要練哪些章節？</h2></div>
    <p class="small muted">勾選要出題的章節，挑戰題和每日推薦的重點筆記都會從這裡出。${daily ? '每天第一次打開會問一次，之後在首頁也能改。' : ''}</p>
    ${Object.entries(GROUPS).map(([g, info]) => `
      <div class="card">
        <div class="row between wrap"><h3>${info.icon} ${info.name}</h3><span class="small muted">已選 ${groupRange(g).length} / ${groupChapters(g).length}</span></div>
        <div class="btn-row" style="margin:8px 0">${EXAMS.map((name, n) => n ? `<button class="btn-sm" onclick="setGroupExam('${g}', ${n}, ${daily})">${name}</button>` : '').join('')}
          <button class="btn-sm" onclick="setGroupExam('${g}', 0, ${daily})">全部</button></div>
        ${groupChapters(g).map((c, i, a) => `${info.subjects.length > 1 && (i === 0 || a[i - 1].s !== c.s) ? `<div class="range-subj">${SUBJ[c.s].icon} ${SUBJ[c.s].name}</div>` : ''}
          <label class="check-row"><input type="checkbox" ${S.range.includes(c.key) ? 'checked' : ''} onchange="toggleRange('${c.key}', this.checked); rangePage(${daily})">
          ${examTag(c)} ${c.label} ${esc(c.name)}</label>`).join('')}
      </div>`).join('')}
    <button class="big-btn green" onclick="confirmRange()">✓ 就練這些！</button>
    <div style="height:20px"></div>`;
}
function setGroupExam(g, n, daily) {
  S.range = S.range.filter(k => SUBJ[CH[k].s].group !== g).concat(groupChapters(g).filter(c => !n || c.exam === n).map(c => c.key));
  save();
  rangePage(daily);
}
function confirmRange() {
  const empty = Object.keys(GROUPS).find(g => !groupRange(g).length);
  if (empty) { toast(`${GROUPS[empty].name}至少要選一個章節喔`); return; }
  const d = ensureDay();
  d.rangeSet = true;
  if (!d.note) d.noteKey = suggestNote(); // 範圍改了，今天推薦的筆記也跟著換
  save();
  home();
  scrollTo(0, 0);
}
function toggleRange(key, on) {
  S.range = S.range.filter(k => k !== key);
  if (on) S.range.push(key);
  save();
}
function approveRedeem(id) {
  const r = S.redeems.find(x => x.id === id);
  if (!r || r.done) return;
  if (!r.paid) {
    if (S.coins < r.cost) { toast('金幣不夠，無法兌換'); return; }
    if (!confirm(`兌換「${r.name}」，扣 ${r.cost} 金幣？`)) return;
    S.coins -= r.cost; r.paid = true;
  }
  r.done = true; r.doneDate = today();
  save(); toast(`已兌換「${r.name}」，剩 ${S.coins} 金幣`); parentPage();
}
function cancelRedeem(id) {
  if (!confirm('取消這筆申請？（不會扣金幣）')) return;
  S.redeems = S.redeems.filter(x => x.id !== id);
  save(); parentPage();
}
function parentRedeem(i) {
  const r = S.rewards[i];
  if (!r) return;
  if (S.coins < r.cost) { toast('金幣不夠，無法兌換'); return; }
  if (!confirm(`兌換「${r.name}」，扣 ${r.cost} 金幣？`)) return;
  S.coins -= r.cost;
  S.redeems.unshift({ id: Date.now(), name: r.name, cost: r.cost, date: today(), done: true, paid: true });
  save(); toast(`已兌換「${r.name}」，剩 ${S.coins} 金幣`); parentPage();
}
function editReward(i, field, v) {
  const r = S.rewards[i];
  if (!r) return;
  if (field === 'cost') { const n = parseInt(v, 10); if (!(n > 0)) { toast('價格要是正整數'); parentPage(); return; } r.cost = n; }
  else r[field] = v.trim();
  save();
}
function delReward(i) {
  if (!confirm(`刪除「${S.rewards[i].name}」？`)) return;
  S.rewards.splice(i, 1); save(); parentPage();
}
function addReward() {
  const name = document.getElementById('nr-name').value.trim();
  const cost = parseInt(document.getElementById('nr-cost').value, 10);
  if (!name || !(cost > 0)) { toast('請填寫名稱和金幣數'); return; }
  S.rewards.push({ icon: document.getElementById('nr-ico').value.trim() || '🎁', name, cost });
  save(); parentPage();
}
function adjustCoins(sign) {
  const n = parseInt(document.getElementById('adj').value, 10);
  if (!(n > 0)) { toast('請輸入數量'); return; }
  S.coins = Math.max(0, S.coins + sign * n);
  save(); toast(`金幣 ${sign > 0 ? '+' : '−'}${n}，目前 ${S.coins}`); parentPage();
}
function changePin() {
  const v = document.getElementById('newpin').value.trim();
  if (!/^\d{4}$/.test(v)) { toast('請輸入 4 位數字'); return; }
  S.pin = v; save(); toast('密碼已更新');
  document.getElementById('newpin').value = '';
}
async function exportData() {
  const name = `國一闖關王備份-${today()}.json`;
  const blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function importData(input) {
  const f = input.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data.q !== 'object' || typeof data.days !== 'object') throw new Error('格式不符');
      if (!confirm('匯入會覆蓋目前這台裝置上的進度，確定嗎？')) return;
      S = Object.assign(freshState(), upgradeRewards(data)); save();
      toast('匯入完成'); parentPage();
    } catch (e) { toast('這不是有效的備份檔'); }
  };
  reader.readAsText(f);
}
function resetAll() {
  if (!confirm('確定要清除所有學習進度嗎？（家長密碼、段考範圍、獎勵設定會保留）')) return;
  if (!confirm('真的確定？清除後無法復原。')) return;
  const keep = { pin: S.pin, range: S.range, rewards: S.rewards };
  S = Object.assign(freshState(), keep); save();
  toast('已清除'); parentPage();
}

// ───────── 啟動 ─────────
function go(fn) { stopNoteTimer(); fn(); scrollTo(0, 0); }
home();
if (migratedNow) toast('已把社會闖關王、自然闖關王的舊進度搬過來了！');

// 跨日時（例如平板隔天才再打開）自動回到新的一天的首頁
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !sess && !(S.days[today()] && 'soc' in S.days[today()])) home();
});

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
