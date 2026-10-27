'use strict';
// 小雞養成：照顧（花金幣餵食、玩耍）讓小雞長大，並在小雞商店買顏色、帽子、衣服、裝備、坐騎、背景
// 這個檔案要在 app.js 之前載入（app.js 的 freshState 會用到 newPet）；其餘函式執行時才用到 app.js 的 S、save、toast 等

// ───────── 成長階段 ─────────
const PET_STAGES = [
  { at: 0, name: '破殼小雞', emoji: '🐣', size: 0.40 },
  { at: 80, name: '毛茸茸小雞', emoji: '🐥', size: 0.44 },
  { at: 200, name: '活潑小雞', emoji: '🐤', size: 0.48 },
  { at: 400, name: '少年雞', emoji: '🐤', size: 0.54 },
  { at: 700, name: '大公雞', emoji: '🐔', size: 0.54 },
  { at: 1200, name: '傳說神雞', emoji: '🐓', size: 0.58 },
];

// ───────── 照顧（每項 20～50 金幣）─────────
// food 飽足、happy 心情、clean 清潔、grow 成長值
const PET_CARE = [
  { id: 'feed', icon: '🌾', name: '普通飼料', cost: 20, food: 30, grow: 10 },
  { id: 'meal', icon: '🍛', name: '營養大餐', cost: 40, food: 60, happy: 10, grow: 25 },
  { id: 'snack', icon: '🍰', name: '特製點心', cost: 30, food: 15, happy: 25, grow: 12 },
  { id: 'ball', icon: '🎾', name: '一起玩球', cost: 25, happy: 30, grow: 12 },
  { id: 'walk', icon: '🌳', name: '公園散步', cost: 35, happy: 40, grow: 18 },
  { id: 'bath', icon: '🛁', name: '洗香香', cost: 20, clean: 50, happy: 5, grow: 5 },
  { id: 'study', icon: '📚', name: '一起讀書', cost: 50, happy: 10, grow: 35 },
];
const PET_PATS_PER_DAY = 3;   // 每天免費摸摸頭的次數
const PET_DECAY = { food: 25, happy: 20, clean: 20 }; // 每天自然減少多少
const RENAME_COST = 10;       // 第一次改名免費

// ───────── 小雞商店 ─────────
// 小東西 10～50、比較好的 100～500、最好的 1000
const PET_SHOP = {
  color: { name: '顏色', icon: '🎨', items: [
    { id: 'c-normal', name: '原本的黃色', cost: 0, filter: '' },
    { id: 'c-pink', name: '櫻花粉', cost: 20, filter: 'hue-rotate(300deg) saturate(1.2)' },
    { id: 'c-sky', name: '天空藍', cost: 20, filter: 'hue-rotate(170deg) saturate(1.3)' },
    { id: 'c-mint', name: '薄荷綠', cost: 30, filter: 'hue-rotate(95deg) saturate(1.2)' },
    { id: 'c-purple', name: '紫羅蘭', cost: 40, filter: 'hue-rotate(230deg) saturate(1.3)' },
    { id: 'c-choco', name: '巧克力', cost: 50, filter: 'sepia(1) saturate(1.8) hue-rotate(-20deg) brightness(.75)' },
    { id: 'c-ghost', name: '透明小幽靈', cost: 150, filter: 'grayscale(1) brightness(1.6) opacity(.75)' },
    { id: 'c-rainbow', name: '彩虹變色', cost: 500, cls: 'pet-rainbow' },
    { id: 'c-gold', name: '閃亮黃金', cost: 1000, filter: 'sepia(1) saturate(5) hue-rotate(-12deg) brightness(1.15) drop-shadow(0 0 6px #ffd54a)' },
  ] },
  hat: { name: '帽子', icon: '🎩', items: [
    { id: 'h-bow', emoji: '🎀', name: '蝴蝶結', cost: 10 },
    { id: 'h-cap', emoji: '🧢', name: '棒球帽', cost: 20 },
    { id: 'h-helmet', emoji: '⛑️', name: '救援帽', cost: 30 },
    { id: 'h-straw', emoji: '👒', name: '草帽', cost: 40 },
    { id: 'h-grad', emoji: '🎓', name: '學士帽', cost: 50 },
    { id: 'h-top', emoji: '🎩', name: '紳士帽', cost: 100 },
    { id: 'h-santa', emoji: '🎅', name: '聖誕帽', cost: 200 },
    { id: 'h-crown', emoji: '👑', name: '皇冠', cost: 500 },
  ] },
  outfit: { name: '衣服', icon: '👕', items: [
    { id: 'o-scarf', emoji: '🧣', name: '圍巾', cost: 15 },
    { id: 'o-tie', emoji: '👔', name: '帥氣領帶', cost: 30 },
    { id: 'o-vest', emoji: '🦺', name: '探險背心', cost: 40 },
    { id: 'o-coat', emoji: '🧥', name: '外套', cost: 60 },
    { id: 'o-karate', emoji: '🥋', name: '武術道服', cost: 120 },
    { id: 'o-kimono', emoji: '👘', name: '和服', cost: 150 },
    { id: 'o-dress', emoji: '👗', name: '公主禮服', cost: 300 },
    { id: 'o-medal', emoji: '🎖️', name: '英雄勳章', cost: 500 },
  ] },
  gear: { name: '裝備', icon: '🗡️', items: [
    { id: 'g-pencil', emoji: '✏️', name: '鉛筆', cost: 10 },
    { id: 'g-book', emoji: '📖', name: '課本', cost: 20 },
    { id: 'g-balloon', emoji: '🎈', name: '氣球', cost: 30 },
    { id: 'g-scope', emoji: '🔭', name: '望遠鏡', cost: 100 },
    { id: 'g-micro', emoji: '🔬', name: '顯微鏡', cost: 150 },
    { id: 'g-shield', emoji: '🛡️', name: '勇者盾牌', cost: 200 },
    { id: 'g-sword', emoji: '🗡️', name: '勇者之劍', cost: 300 },
    { id: 'g-trophy', emoji: '🏆', name: '冠軍獎盃', cost: 500 },
    { id: 'g-wand', emoji: '🪄', name: '魔法棒', cost: 1000 },
  ] },
  mount: { name: '坐騎', icon: '🛹', items: [
    { id: 'm-skate', emoji: '🛹', name: '滑板', cost: 50 },
    { id: 'm-bike', emoji: '🚲', name: '腳踏車', cost: 120 },
    { id: 'm-turtle', emoji: '🐢', name: '烏龜', cost: 200 },
    { id: 'm-horse', emoji: '🐎', name: '小馬', cost: 300 },
    { id: 'm-car', emoji: '🏎️', name: '跑車', cost: 500 },
    { id: 'm-rocket', emoji: '🚀', name: '火箭', cost: 800 },
    { id: 'm-dragon', emoji: '🐉', name: '神龍', cost: 1000 },
  ] },
  bg: { name: '背景', icon: '🖼️', items: [
    { id: 'b-sky', name: '藍天草地', cost: 0, bg: 'linear-gradient(#bfe6ff, #e9f7ff 62%, #9fdc8a 62%)', deco: [['☁️', 12, 12], ['☀️', 78, 8]] },
    { id: 'b-forest', name: '森林', cost: 50, bg: 'linear-gradient(#cdeccf, #e8f6e1 60%, #7cc06b 60%)', deco: [['🌲', 6, 34], ['🌳', 80, 30], ['🍄', 74, 74]] },
    { id: 'b-beach', name: '海灘', cost: 80, bg: 'linear-gradient(#9fdcff, #c9efff 50%, #4fb4e8 50%, #4fb4e8 62%, #f3dca2 62%)', deco: [['🌴', 6, 30], ['🐚', 80, 78]] },
    { id: 'b-sunset', name: '夕陽', cost: 120, bg: 'linear-gradient(#ff9a76, #ffd28a 58%, #c98b5b 58%)', deco: [['🌅', 74, 30]] },
    { id: 'b-night', name: '星空', cost: 150, bg: 'linear-gradient(#1c2350, #3b3f8f 62%, #2c5a3d 62%)', deco: [['🌙', 76, 8], ['⭐', 14, 10], ['✨', 40, 6]] },
    { id: 'b-mountain', name: '玉山頂', cost: 200, bg: 'linear-gradient(#b7d8ff, #e4f0ff 58%, #a7b8a0 58%)', deco: [['🏔️', 4, 26], ['🏔️', 72, 22]] },
    { id: 'b-castle', name: '古堡', cost: 250, bg: 'linear-gradient(#d9c7ff, #f1e9ff 62%, #b9a37a 62%)', deco: [['🏰', 74, 24], ['🚩', 10, 22]] },
    { id: 'b-rainbow', name: '彩虹', cost: 300, bg: 'linear-gradient(#ffe0f0, #fff6d8 62%, #a8e6a1 62%)', deco: [['🌈', 54, 6], ['☁️', 6, 16]] },
    { id: 'b-space', name: '外太空', cost: 500, bg: 'radial-gradient(circle at 30% 30%, #4b3a8f, #120d2e 70%)', deco: [['🪐', 74, 10], ['🌍', 6, 12], ['⭐', 40, 4], ['☄️', 82, 70]] },
    { id: 'b-palace', name: '黃金宮殿', cost: 1000, bg: 'linear-gradient(#ffe9a8, #fff6d6 60%, #e7b94b 60%)', deco: [['🏯', 72, 22], ['💎', 8, 20], ['✨', 44, 6]] },
  ] },
};
const PET_SLOTS = ['color', 'hat', 'outfit', 'gear', 'mount', 'bg'];
const PET_ITEM = Object.fromEntries(Object.values(PET_SHOP).flatMap(c => c.items).map(i => [i.id, i]));

function newPet() {
  return {
    name: '小雞', grow: 0, food: 70, happy: 70, clean: 70, last: Date.now(),
    owned: ['c-normal', 'b-sky'],
    equip: { color: 'c-normal', hat: null, outfit: null, gear: null, mount: null, bg: 'b-sky' },
    pats: {}, renamed: 0,
  };
}

// ───────── 狀態 ─────────
const petStage = p => { let s = 0; PET_STAGES.forEach((st, i) => { if (p.grow >= st.at) s = i; }); return s; };
function petTick() {
  const p = S.pet;
  const days = (Date.now() - (p.last || Date.now())) / 86400000;
  if (days > 0) {
    for (const k of Object.keys(PET_DECAY)) p[k] = Math.max(0, p[k] - PET_DECAY[k] * days);
    p.last = Date.now();
  }
}
function petMood(p) {
  const avg = (p.food + p.happy + p.clean) / 3;
  if (p.food < 20) return { face: '😵', text: '肚子好餓…' };
  if (p.clean < 20) return { face: '🫧', text: '身上髒髒的，想洗澡' };
  if (p.happy < 20) return { face: '😢', text: '好無聊，陪我玩～' };
  if (avg >= 75) return { face: '😆', text: '超開心！' };
  if (avg >= 45) return { face: '🙂', text: '心情不錯' };
  return { face: '😐', text: '有點需要照顧' };
}
const petNeedsCare = () => { petTick(); const p = S.pet; return p.food < 30 || p.happy < 30 || p.clean < 30; };

// ───────── 畫小雞 ─────────
// px：場景大小；mini：首頁左上角的小頭像（只畫背景、小雞、帽子、坐騎）
function petSceneHtml(px, mini = false) {
  const p = S.pet;
  const st = PET_STAGES[petStage(p)];
  const color = PET_ITEM[p.equip.color] || {};
  const bg = PET_ITEM[p.equip.bg] || PET_SHOP.bg.items[0];
  const mount = p.equip.mount && PET_ITEM[p.equip.mount];
  const hat = p.equip.hat && PET_ITEM[p.equip.hat];
  const outfit = p.equip.outfit && PET_ITEM[p.equip.outfit];
  const gear = p.equip.gear && PET_ITEM[p.equip.gear];
  const petSize = px * st.size * (mount ? 0.85 : 1);
  const ground = mount ? px * 0.26 : px * 0.12;
  const at = (emoji, size, left, bottom, extra = '') =>
    `<span class="pet-part" style="font-size:${size}px;left:${left}px;bottom:${bottom}px;${extra}">${emoji}</span>`;
  let h = `<div class="pet-scene" style="width:${px}px;height:${px}px;background:${bg.bg}">`;
  if (!mini) h += (bg.deco || []).map(([e, x, y]) => `<span class="pet-deco" style="font-size:${px * 0.13}px;left:${x}%;top:${y}%">${e}</span>`).join('');
  if (mount) h += at(mount.emoji, px * 0.36, px / 2 - px * 0.2, px * 0.02);
  h += `<span class="pet-part pet-body ${color.cls || ''}" style="font-size:${petSize}px;left:${px / 2 - petSize * 0.58}px;bottom:${ground}px;${color.filter ? `filter:${color.filter};` : ''}">${st.emoji}</span>`;
  if (outfit && !mini) h += at(outfit.emoji, petSize * 0.42, px / 2 - petSize * 0.26, ground + petSize * 0.02);
  if (hat) h += at(hat.emoji, petSize * 0.5, px / 2 - petSize * 0.3, ground + petSize * 0.82);
  if (gear && !mini) h += at(gear.emoji, petSize * 0.45, px / 2 + petSize * 0.32, ground + petSize * 0.25, 'transform:rotate(-12deg);');
  return h + '</div>';
}
function petMini() {
  return petSceneHtml(64, true) + (petNeedsCare() ? '<span class="pet-alert">!</span>' : '');
}

// ───────── 小雞頁 ─────────
let petTab = 'care';
function petPage() {
  petTick(); save();
  const p = S.pet;
  const si = petStage(p), st = PET_STAGES[si], next = PET_STAGES[si + 1];
  const mood = petMood(p);
  const free = spendable();
  const pats = p.pats[today()] || 0;
  const bar = (icon, label, v, color) => `
    <div class="pet-stat"><span>${icon} ${label}</span><div class="pet-bar"><div style="width:${Math.round(v)}%;background:${color}"></div></div><b>${Math.round(v)}</b></div>`;
  const tabs = [['care', '🍽️ 照顧'], ...PET_SLOTS.map(k => [k, `${PET_SHOP[k].icon} ${PET_SHOP[k].name}`])];
  app.innerHTML = `
    <div class="top-bar"><button class="back" onclick="home()">← 首頁</button><h2>🐣 我的小雞</h2><span class="small muted" style="margin-left:auto">可用 🪙 ${free}</span></div>
    <div class="card pet-card">
      <div class="pet-stage-wrap" onclick="petPat()">${petSceneHtml(Math.min(300, innerWidth - 80))}</div>
      <div class="pet-info">
        <div class="row between wrap"><div class="title-line">${esc(p.name)} <span class="small muted">${st.name}</span></div>
          <button class="btn-sm" onclick="petRename()">✏️ 改名${p.renamed ? `（🪙 ${RENAME_COST}）` : '（免費）'}</button></div>
        <div class="small" style="margin:4px 0 8px">${mood.face} ${mood.text}</div>
        ${next ? `<div class="small muted">成長 ${p.grow} / ${next.at} → 下一階段「${next.name}」</div>
          <div class="xpbar"><div style="width:${((p.grow - st.at) / (next.at - st.at) * 100).toFixed(1)}%;background:var(--ok)"></div></div>`
          : `<div class="small">🌟 已經是最高階段「${st.name}」了！成長值 ${p.grow}</div>`}
        <div style="margin-top:10px">
          ${bar('🍗', '飽足', p.food, '#f5a524')}${bar('😊', '心情', p.happy, '#ec6aa0')}${bar('🫧', '清潔', p.clean, '#3fa7e0')}
        </div>
        <div class="small muted" style="margin-top:6px">點小雞可以免費摸摸頭（今天還有 ${Math.max(0, PET_PATS_PER_DAY - pats)} 次）。肚子太餓時長得比較慢喔！</div>
      </div>
    </div>
    <div class="pet-tabs">${tabs.map(([k, label]) => `<button class="${petTab === k ? 'on' : ''}" onclick="petTab='${k}';petPage()">${label}</button>`).join('')}</div>
    <div class="card">${petTab === 'care' ? petCareHtml(free) : petShopHtml(petTab, free)}</div>`;
}
function petCareHtml(free) {
  return `<div class="pet-grid">${PET_CARE.map(c => {
    const fx = [c.food && `🍗+${c.food}`, c.happy && `😊+${c.happy}`, c.clean && `🫧+${c.clean}`, `🌱+${c.grow}`].filter(Boolean).join(' ');
    return `<button class="pet-item" onclick="petCare('${c.id}')" ${free >= c.cost ? '' : 'disabled'}>
      <span class="pi-ico">${c.icon}</span><b>${c.name}</b><span class="small muted">${fx}</span><span class="pi-cost">🪙 ${c.cost}</span></button>`;
  }).join('')}</div>`;
}
function petShopHtml(slot, free) {
  const p = S.pet;
  return `<div class="pet-grid">${PET_SHOP[slot].items.map(it => {
    const owned = p.owned.includes(it.id);
    const on = p.equip[slot] === it.id;
    const preview = slot === 'color' ? `<span class="pi-ico ${it.cls || ''}" style="${it.filter ? `filter:${it.filter}` : ''}">🐤</span>`
      : slot === 'bg' ? `<span class="pi-ico pi-bg" style="background:${it.bg}"></span>` : `<span class="pi-ico">${it.emoji}</span>`;
    const label = on ? (slot === 'color' || slot === 'bg' ? '使用中' : '使用中（點一下卸下）') : owned ? '點一下換上' : it.cost ? `🪙 ${it.cost}` : '免費';
    return `<button class="pet-item ${on ? 'on' : ''}" onclick="petShopTap('${slot}','${it.id}')" ${!owned && free < it.cost ? 'disabled' : ''}>
      ${preview}<b>${it.name}</b><span class="pi-cost ${owned ? 'owned' : ''}">${label}</span></button>`;
  }).join('')}</div>`;
}

// ───────── 動作 ─────────
function petSpend(cost, what) {
  if (spendable() < cost) { toast('金幣不夠喔'); return false; }
  if (cost >= 100 && !confirm(`用 ${cost} 金幣買「${what}」嗎？`)) return false;
  S.coins -= cost;
  return true;
}
function petGrow(n) {
  const p = S.pet;
  const before = petStage(p);
  const got = p.food < 20 ? Math.ceil(n / 2) : n; // 太餓長得慢
  p.grow += got;
  const after = petStage(p);
  if (after > before) {
    setTimeout(() => { burst('🎉', 20); toast(`🎊 ${p.name} 長大了！變成「${PET_STAGES[after].name}」`); }, 300);
  }
  return got;
}
function petCare(id) {
  const c = PET_CARE.find(x => x.id === id);
  petTick();
  if (!c || !petSpend(c.cost, c.name)) return;
  const p = S.pet;
  for (const k of ['food', 'happy', 'clean']) if (c[k]) p[k] = Math.min(100, p[k] + c[k]);
  const got = petGrow(c.grow);
  save();
  burst(c.icon, 8);
  toast(`${c.icon} ${p.name}：謝謝你！成長 +${got}`);
  petPage();
}
function petPat() {
  const p = S.pet, t = today();
  const used = p.pats[t] || 0;
  if (used >= PET_PATS_PER_DAY) { toast(`${p.name} 今天被摸夠了，明天再來～`); return; }
  p.pats = { [t]: used + 1 };
  p.happy = Math.min(100, p.happy + 8);
  petGrow(2);
  save();
  burst('💗', 6);
  petPage();
}
function petRename() {
  const p = S.pet;
  const cost = p.renamed ? RENAME_COST : 0;
  if (cost && spendable() < cost) { toast('金幣不夠喔'); return; }
  const name = (prompt(`幫小雞取新名字（最多 8 個字）${cost ? `，要花 ${cost} 金幣` : ''}：`, p.name) || '').trim().slice(0, 8);
  if (!name || name === p.name) return;
  if (cost) S.coins -= cost;
  p.name = name; p.renamed++;
  save();
  toast(`小雞的新名字是「${name}」！`);
  petPage();
}
function petShopTap(slot, id) {
  const p = S.pet, it = PET_ITEM[id];
  if (!it) return;
  if (!p.owned.includes(id)) {
    if (!petSpend(it.cost, it.name)) return;
    p.owned.push(id);
    p.equip[slot] = id;
    burst('✨', 12);
    toast(`買到「${it.name}」，已經換上了！`);
  } else if (p.equip[slot] === id) {
    // 顏色和背景一定要有一個，其他可以卸下
    if (slot === 'color' || slot === 'bg') return;
    p.equip[slot] = null;
  } else {
    p.equip[slot] = id;
  }
  save();
  petPage();
}

// ───────── 樣式 ─────────
(function petStyles() {
  const css = `
  .avatar.pet-mini { padding: 0; overflow: visible; position: relative; background: none; }
  .avatar.pet-mini .pet-scene { border-radius: 18px; box-shadow: 0 2px 6px rgba(0,0,0,.12); }
  .pet-alert { position: absolute; top: -6px; right: -6px; width: 22px; height: 22px; border-radius: 50%; background: var(--bad); color: #fff; font-weight: 800; font-size: 15px; display: grid; place-items: center; animation: pop .4s infinite alternate; }
  .pet-scene { position: relative; overflow: hidden; border-radius: 24px; flex: none; }
  .pet-part, .pet-deco { position: absolute; line-height: 1; }
  .pet-body { animation: petBob 2.4s ease-in-out infinite; }
  @keyframes petBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4%); } }
  .pet-rainbow { animation: petBob 2.4s ease-in-out infinite, petHue 3s linear infinite; }
  @keyframes petHue { from { filter: hue-rotate(0deg) saturate(1.4); } to { filter: hue-rotate(360deg) saturate(1.4); } }
  .pet-card { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; }
  .pet-stage-wrap { cursor: pointer; margin: 0 auto; }
  .pet-info { flex: 1; min-width: 240px; }
  .pet-stat { display: grid; grid-template-columns: 76px 1fr 34px; align-items: center; gap: 8px; font-size: 15px; margin: 5px 0; }
  .pet-bar { height: 12px; border-radius: 99px; background: var(--bg); overflow: hidden; }
  .pet-bar > div { height: 100%; border-radius: 99px; transition: width .4s; }
  .pet-stat b { text-align: right; font-size: 14px; }
  .pet-tabs { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 12px; -webkit-overflow-scrolling: touch; }
  .pet-tabs button { flex: none; padding: 9px 14px; border-radius: 12px; background: var(--card); box-shadow: var(--shadow); font-weight: 700; font-size: 16px; }
  .pet-tabs button.on { background: var(--brand); color: #fff; }
  .pet-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
  .pet-item { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 12px 8px; border-radius: 16px; background: var(--bg); border: 3px solid transparent; text-align: center; }
  .pet-item.on { border-color: var(--ok); background: var(--ok-soft); }
  .pet-item:disabled { opacity: .45; }
  .pet-item b { font-size: 16px; }
  .pi-ico { font-size: 38px; line-height: 1.1; display: inline-block; }
  .pi-bg { width: 56px; height: 40px; border-radius: 10px; }
  .pi-cost { font-size: 14px; font-weight: 700; color: #a76a00; }
  .pi-cost.owned { color: var(--ok); }
  `;
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
})();
