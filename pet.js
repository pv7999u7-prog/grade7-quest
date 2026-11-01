'use strict';
// 小雞養成：照顧（花金幣餵食、玩耍）讓小雞長大，並在小雞商店買顏色、帽子、衣服、裝備、坐騎、背景
// 這個檔案要在 app.js 之前載入（app.js 的 freshState 會用到 newPet）；其餘函式執行時才用到 app.js 的 S、save、toast 等

// ───────── 成長階段 ─────────
// 門檻依「每天約 43 成長值」（答題約 20＋摸摸頭 6＋照顧約 17）估算：10/27 開始約 70 天養成，
// 也就是 1/5 左右，比期末考（約 1/10）早幾天，留一點緩衝
const PET_STAGES = [
  { at: 0, name: '破殼小雞', emoji: '🐣', size: 0.40, desc: '剛從蛋裡探出頭' },
  { at: 260, name: '毛茸茸小雞', emoji: '🐥', size: 0.44, desc: '全身黃黃的絨毛' },
  { at: 700, name: '活潑小雞', emoji: '🐤', size: 0.48, desc: '到處跑來跑去' },
  { at: 1300, name: '少年雞', emoji: '🐔', size: 0.50, desc: '長出漂亮的羽毛' },
  { at: 2100, name: '大公雞', emoji: '🐓', size: 0.54, desc: '每天早上喔喔叫' },
  { at: 3000, name: '傳說神鳥', emoji: '🦚', size: 0.58, desc: '展開閃亮的尾羽！' },
];
const PET_GOAL = { date: '2027-01-10', label: '期末考前' }; // 養成目標日（顯示用）
// 每週（週一～週日）最多成長多少：避免一直刷題或把存下的金幣一次花光就很快養成。
// 330 × 9 週 ＝ 2970 ＜ 3000 → 從 10/26 那週開始，最快也要第 10 週（12/28 週一）才養成，約期末考（1/10）前兩週；
// 一般節奏每週約 300，不會被卡到
const PET_WEEK_CAP = 330;

// ───────── 答題也會照顧小雞 ─────────
// 每答對 1 題：飽足、心情、清潔各 +3（只補到 60，想更高要花金幣照顧），成長 +1
const PET_LEARN = { per: 3, floor: 60, grow: 1 };

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
    { id: 'o-cape', emoji: '🦸', name: '英雄披風', cost: 200 },
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
    // ── 世界地標（art 是畫在背景上的 SVG，座標 0～100）──
    { id: 'b-sunmoon', name: '日月潭', cost: 200, bg: 'linear-gradient(#bfe6ff, #eef9ff 50%, #4aa3d8 50%, #3b8fc4 70%, #8fcf7a 70%)',
      art: '<path d="M0 50 L14 34 L26 46 L40 30 L56 48 L70 32 L86 46 L100 36 L100 50 Z" fill="#5f9e6e"/><ellipse cx="62" cy="58" rx="6" ry="2.2" fill="#6fb07a"/>', deco: [['🛶', 72, 52, 0.12], ['☁️', 10, 8]] },
    { id: 'b-101', name: '台北 101', cost: 400, bg: 'linear-gradient(#a9d8ff, #e9f6ff 70%, #9ccf8a 70%)',
      art: '<rect x="4" y="54" width="9" height="16" fill="#9fb4c8"/><rect x="15" y="58" width="8" height="12" fill="#b5c6d6"/><rect x="88" y="56" width="9" height="14" fill="#9fb4c8"/>' +
        Array.from({ length: 8 }, (_, i) => { const y = 51 - i * 4.4; return `<path d="M68.5 ${y + 4.4} L81.5 ${y + 4.4} L83 ${y} L67 ${y} Z" fill="${i % 2 ? '#6aa5b6' : '#7fb8c8'}"/>`; }).join('') +
        '<rect x="66" y="51" width="18" height="19" fill="#5e95a6"/><rect x="72" y="11" width="6" height="5" fill="#5e95a6"/><path d="M75 11 V2" stroke="#4d5b66" stroke-width="1.2"/>', deco: [['☁️', 8, 10]] },
    { id: 'b-pyramid', name: '埃及金字塔', cost: 400, bg: 'linear-gradient(#ffcf8a, #fff0c9 64%, #e9c46a 64%)',
      art: '<path d="M30 64 L53 26 L54 64 Z" fill="#e6b45c"/><path d="M53 26 L80 64 L54 64 Z" fill="#c98f35"/><path d="M72 64 L85 44 L86 64 Z" fill="#e6b45c"/><path d="M85 44 L99 64 L86 64 Z" fill="#c98f35"/><path d="M0 64 Q30 61 60 64 T100 63" stroke="#d9ad52" stroke-width="1" fill="none"/>', deco: [['☀️', 6, 6], ['🐪', 4, 54, 0.13]] },
    { id: 'b-liberty', name: '紐約自由女神', cost: 400, bg: 'linear-gradient(#bfe0ff, #eaf5ff 62%, #3d8bd9 62%)',
      art: '<path d="M0 62 V54 H6 V48 H11 V56 H16 V44 H21 V52 H27 V58 H33 V50 H38 V62 Z" fill="#9db0c6"/><rect x="62" y="56" width="22" height="7" fill="#9b8a72"/>', deco: [['🗽', 60, 14, 0.36], ['☁️', 8, 8]] },
    { id: 'b-eiffel', name: '巴黎鐵塔', cost: 400, bg: 'linear-gradient(#ffd6e3, #fff3f6 66%, #a9d98e 66%)',
      art: '<path d="M66 66 L72 42 L74 22 L75.3 6 L76.6 22 L78.6 42 L84.6 66 H80.6 Q75.3 56 70 66 Z" fill="#8a6a48"/><rect x="69.5" y="41" width="11.6" height="2.4" fill="#6f5338"/><rect x="72.2" y="24" width="6.2" height="2" fill="#6f5338"/>', deco: [['🎈', 14, 12, 0.11], ['☁️', 30, 6]] },
    { id: 'b-wall', name: '萬里長城', cost: 400, bg: 'linear-gradient(#bfe6ff, #eef8ff 50%, #7fc46f 50%)',
      art: '<path d="M0 60 Q20 44 40 54 T80 46 T100 50 V100 H0 Z" fill="#5fae5b"/><path d="M0 56 Q20 40 40 50 T80 42 T100 46" stroke="#b9936b" stroke-width="5" fill="none"/><path d="M0 52.5 Q20 36.5 40 46.5 T80 38.5 T100 42.5" stroke="#a27f58" stroke-width="2.2" stroke-dasharray="2 1.6" fill="none"/><rect x="36" y="40" width="7" height="9" fill="#a27f58"/><rect x="76" y="32" width="7" height="9" fill="#a27f58"/>', deco: [['☁️', 10, 8]] },
    { id: 'b-sydney', name: '雪梨歌劇院', cost: 450, bg: 'linear-gradient(#a6dcff, #e8f7ff 60%, #2f86c9 60%)',
      art: '<rect x="50" y="57" width="46" height="6" fill="#d8c6a3"/><path d="M54 57 Q60 36 70 34 Q64 44 66 57 Z" fill="#fff" stroke="#d6dde6" stroke-width=".6"/><path d="M64 57 Q72 32 84 30 Q76 42 78 57 Z" fill="#fff" stroke="#d6dde6" stroke-width=".6"/><path d="M77 57 Q84 40 94 38 Q88 47 90 57 Z" fill="#fff" stroke="#d6dde6" stroke-width=".6"/>', deco: [['⛵', 10, 50, 0.12], ['☁️', 14, 8]] },
    { id: 'b-tokyo', name: '東京鐵塔與富士山', cost: 300, bg: 'linear-gradient(#ffd9e8, #fff4f8 64%, #a5d58f 64%)', deco: [['🗻', 2, 26, 0.3], ['🗼', 66, 12, 0.34], ['🌸', 40, 8]] },
    { id: 'b-moai', name: '復活節島摩艾', cost: 250, bg: 'linear-gradient(#b8e4ff, #e9f8ff 52%, #3a9bd5 52%, #3a9bd5 60%, #86c96e 60%)', deco: [['🗿', 2, 34, 0.26], ['🗿', 74, 36, 0.24]] },
    { id: 'b-greek', name: '希臘神殿', cost: 250, bg: 'linear-gradient(#9fd6ff, #eef9ff 64%, #e8d9b0 64%)', deco: [['🏛️', 64, 22, 0.32], ['🫒', 8, 50, 0.12]] },
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

// ───────── 畫小雞（自己畫的 SVG，衣服會依身體形狀「穿」上去）─────────
// 每個階段的身體幾何（座標 0～100，腳踩在 y≈96）
// body 身體橢圓、head 頭（null＝圓滾滾一顆）、face 朝向、neck 衣服從哪裡開始、hat 帽子位置與大小、gear 拿東西的位置
const PET_BODY = [
  { size: 0.50, body: { cx: 50, cy: 68, rx: 21, ry: 15 }, head: { cx: 50, cy: 48, r: 18 }, face: 'front', egg: true, neck: 58, hat: { x: 50, y: 31, s: 34 }, gear: { x: 82, y: 70 } },
  { size: 0.56, body: { cx: 50, cy: 62, rx: 30, ry: 30 }, head: null, face: 'ball', neck: 67, hat: { x: 50, y: 34, s: 38 }, gear: { x: 86, y: 76 } },
  { size: 0.62, body: { cx: 54, cy: 66, rx: 26, ry: 21 }, head: { cx: 40, cy: 41, r: 17 }, face: 'left', neck: 50, hat: { x: 40, y: 25, s: 32 }, gear: { x: 18, y: 78 } },
  { size: 0.68, body: { cx: 56, cy: 62, rx: 28, ry: 21 }, head: { cx: 37, cy: 34, r: 14 }, face: 'left', comb: 1, tail: 1, neck: 47, hat: { x: 37, y: 20, s: 28 }, gear: { x: 16, y: 72 } },
  { size: 0.74, body: { cx: 57, cy: 60, rx: 29, ry: 21 }, head: { cx: 34, cy: 29, r: 13 }, face: 'left', comb: 2, tail: 2, wattle: 1, neck: 45, hat: { x: 34, y: 15, s: 27 }, gear: { x: 14, y: 70 } },
  { size: 0.80, body: { cx: 52, cy: 66, rx: 19, ry: 21 }, head: { cx: 45, cy: 33, r: 11 }, face: 'left', crest: 1, fan: 1, neck: 49, hat: { x: 45, y: 21, s: 24 }, gear: { x: 22, y: 74 } },
];
// 顏色：[身體, 翅膀陰影]
const PET_COLORS = {
  'c-normal': ['#FFD43B', '#F2B705'], 'c-pink': ['#FFA9CC', '#F27BAF'], 'c-sky': ['#8ED4FF', '#4DAEEF'],
  'c-mint': ['#8DE8B2', '#47C482'], 'c-purple': ['#CDA8FF', '#9F6CF2'], 'c-choco': ['#B98153', '#8C5A31'],
  'c-ghost': ['#F4F8FF', '#CBD6E8'], 'c-rainbow': ['#FFD43B', '#F2B705'], 'c-gold': ['#FFD43B', '#D99A00'],
};
let petUid = 0;

// 衣服：back 畫在身體後面（披風）；on 會被裁成身體的形狀；front 畫在最上層（領帶、勳章、裙擺…）
function petOutfit(id, b, top, chestX, left, u) {
  const L = b.cx - b.rx - 2, W = b.rx * 2 + 4, bot = b.cy + b.ry + 2, waist = b.cy + b.ry * 0.25;
  const below = fill => `<rect x="${L}" y="${top}" width="${W}" height="${bot - top}" fill="${fill}"/>`;
  const dir = left ? -1 : 1;
  switch (id) {
    case 'o-scarf': return {
      on: `<rect x="${L}" y="${top - 1}" width="${W}" height="7" fill="#e63946"/><rect x="${L}" y="${top + 1.6}" width="${W}" height="1.6" fill="#fff" opacity=".75"/>`,
      front: `<g transform="rotate(${dir * 14} ${chestX} ${top + 3})"><rect x="${chestX - 3}" y="${top + 3}" width="6" height="15" rx="1.5" fill="#d62f3c"/><rect x="${chestX - 3}" y="${top + 8}" width="6" height="1.6" fill="#fff" opacity=".75"/><path d="M${chestX - 2.4} ${top + 18}v3M${chestX - .8} ${top + 18}v3M${chestX + .8} ${top + 18}v3M${chestX + 2.4} ${top + 18}v3" stroke="#d62f3c" stroke-width="1"/></g>` };
    case 'o-tie': return {
      on: below('#ffffff') + `<rect x="${L}" y="${top}" width="${W}" height="${bot - top}" fill="#000" opacity=".04"/>`,
      front: `<path d="M${chestX - 8} ${top - 1} L${chestX} ${top + 5} L${chestX - 3} ${top + 8} Z M${chestX + 8} ${top - 1} L${chestX} ${top + 5} L${chestX + 3} ${top + 8} Z" fill="#fff" stroke="#c9ced6" stroke-width=".7"/>` +
        `<path d="M${chestX - 2.6} ${top + 3} h5.2 l-1.2 3.4 l2.8 13 l-4.2 4.2 l-4.2 -4.2 l2.8 -13 z" fill="#2b4c9a"/><path d="M${chestX - 2} ${top + 11} l4 -2 M${chestX - 2.4} ${top + 16} l4.8 -2.4" stroke="#f2c14e" stroke-width="1.2"/>` };
    case 'o-vest': return {
      on: `<rect x="${L}" y="${top}" width="${chestX - 4 - L}" height="${bot - top}" fill="#ff8c1a"/><rect x="${chestX + 4}" y="${top}" width="${L + W - chestX - 4}" height="${bot - top}" fill="#ff8c1a"/>` +
        `<rect x="${L}" y="${b.cy + 2}" width="${chestX - 4 - L}" height="3" fill="#f3f0b0"/><rect x="${chestX + 4}" y="${b.cy + 2}" width="${L + W - chestX - 4}" height="3" fill="#f3f0b0"/>`,
      front: `<rect x="${chestX + 6}" y="${b.cy - 6}" width="7" height="6" rx="1" fill="#e6750a"/>` };
    case 'o-coat': return {
      on: below('#3d5a80'),
      front: `<path d="M${chestX - 9} ${top} L${chestX} ${top + 13} L${chestX + 9} ${top} L${chestX + 4} ${top} L${chestX} ${top + 7} L${chestX - 4} ${top} Z" fill="#2a4363"/>` +
        [0, 1, 2].map(i => `<circle cx="${chestX}" cy="${top + 16 + i * 6}" r="1.3" fill="#f2c14e"/>`).join('') };
    case 'o-karate': return {
      on: below('#fbfbf8') + `<path d="M${chestX - 13} ${top - 1} L${chestX + 7} ${top + 22}" stroke="#d2d2cc" stroke-width="2.4"/><rect x="${L}" y="${waist + 2}" width="${W}" height="5" fill="#222"/>`,
      front: `<rect x="${chestX - 2.5}" y="${waist + 1.5}" width="5" height="6" rx="1" fill="#111"/><path d="M${chestX - 1} ${waist + 7} l-3 8 M${chestX + 1} ${waist + 7} l3 8" stroke="#111" stroke-width="2.2"/>` };
    case 'o-kimono': return {
      defs: `<pattern id="pk${u}" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#d7263d"/><circle cx="3" cy="3" r="1.1" fill="#ffd6dc"/></pattern>`,
      on: below(`url(#pk${u})`) + `<path d="M${chestX - 10} ${top - 1} L${chestX + 4} ${top + 16} M${chestX + 10} ${top - 1} L${chestX - 2} ${top + 12}" stroke="#fff" stroke-width="2.4"/><rect x="${L}" y="${waist - 3}" width="${W}" height="8" fill="#f4c430"/>`,
      front: `<circle cx="${chestX + dir * -9}" cy="${waist + 1}" r="3" fill="#e0a800"/><circle cx="${chestX + dir * -14}" cy="${waist + 1}" r="3" fill="#e0a800"/>` };
    case 'o-dress': {
      const hem = bot - 1, x = b.cx, r = b.rx;
      return {
        on: `<rect x="${L}" y="${top}" width="${W}" height="${waist - top}" fill="#ff8fc7"/>`,
        front: `<path d="M${x - r * .9} ${waist} L${x - r * 1.22} ${hem} Q${x - r * .9} ${hem + 4} ${x - r * .6} ${hem} Q${x - r * .3} ${hem + 4} ${x} ${hem} Q${x + r * .3} ${hem + 4} ${x + r * .6} ${hem} Q${x + r * .9} ${hem + 4} ${x + r * 1.22} ${hem} L${x + r * .9} ${waist} Z" fill="#ff6fb5"/>` +
          `<path d="M${x - r * 1.15} ${hem - 3} Q${x} ${hem + 1} ${x + r * 1.15} ${hem - 3}" stroke="#ffd1e8" stroke-width="1.6" fill="none"/>` +
          `<path d="M${chestX} ${waist} l-6 -3.5 v7 z M${chestX} ${waist} l6 -3.5 v7 z" fill="#ff3d9a"/><circle cx="${chestX}" cy="${waist}" r="1.8" fill="#ffd1e8"/>` };
    }
    case 'o-cape': return {
      back: `<path d="M${b.cx - b.rx * .65} ${top} Q${b.cx - b.rx * 1.3} ${b.cy + b.ry * .6} ${b.cx - b.rx * 1.2} ${bot + 1} L${b.cx + b.rx * 1.2} ${bot + 1} Q${b.cx + b.rx * 1.3} ${b.cy + b.ry * .6} ${b.cx + b.rx * .65} ${top} Z" fill="#c1121f"/><path d="M${b.cx - b.rx * 1.1} ${bot} L${b.cx + b.rx * 1.1} ${bot}" stroke="#f2c14e" stroke-width="1.5"/>`,
      front: `<path d="M${chestX - 7} ${top} Q${chestX} ${top + 3} ${chestX + 7} ${top}" stroke="#c1121f" stroke-width="2.5" fill="none"/><circle cx="${chestX}" cy="${top + 2}" r="2.6" fill="#f2c14e" stroke="#c99a1a" stroke-width=".6"/>` };
    case 'o-medal': return {
      front: `<path d="M${chestX - 6} ${top - 1} L${chestX} ${top + 12} L${chestX + 6} ${top - 1}" stroke="#2b4c9a" stroke-width="3" fill="none"/><path d="M${chestX - 3} ${top - 1} L${chestX} ${top + 8} L${chestX + 3} ${top - 1}" stroke="#e63946" stroke-width="1.6" fill="none"/>` +
        `<circle cx="${chestX}" cy="${top + 16}" r="5.5" fill="#f5c542" stroke="#c99a1a" stroke-width="1"/><path d="M${chestX} ${top + 12.6} l1.1 2.3 2.5 .3 -1.8 1.7 .5 2.5 -2.3 -1.2 -2.3 1.2 .5 -2.5 -1.8 -1.7 2.5 -.3z" fill="#fff6c9"/>` };
    default: return {};
  }
}

// 畫一隻小雞：stage 階段、colorId 顏色、outfitId 衣服、gearId 手上拿的、hatId 帽子
function petSvg(stage, colorId, outfitId, gearId, hatId) {
  const u = ++petUid;
  const B = PET_BODY[stage], b = B.body, h = B.head;
  const [base, shade] = PET_COLORS[colorId] || PET_COLORS['c-normal'];
  const gold = colorId === 'c-gold';
  const fill = gold ? `url(#pg${u})` : base;
  const anim = colorId === 'c-rainbow' ? '<animate attributeName="fill" values="#FFD43B;#FF9EC4;#8ED4FF;#8DE8B2;#CDA8FF;#FFD43B" dur="4s" repeatCount="indefinite"/>' : '';
  const left = B.face === 'left';
  const chestX = left ? b.cx - b.rx * 0.32 : b.cx;
  const o = outfitId ? petOutfit(outfitId, b, B.neck, chestX, left, u) : {};
  const orange = '#FF9F1C', ink = '#3a2e2a';
  let s = `<svg viewBox="0 0 100 100" class="pet-svg" style="overflow:visible"${colorId === 'c-ghost' ? ' opacity=".82"' : ''}><defs>` +
    `<linearGradient id="pg${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF5B0"/><stop offset=".5" stop-color="#FFD43B"/><stop offset="1" stop-color="#E0A100"/></linearGradient>` +
    `<clipPath id="pc${u}"><ellipse cx="${b.cx}" cy="${b.cy}" rx="${b.rx}" ry="${b.ry}"/></clipPath>${o.defs || ''}</defs>`;
  // 傳說神鳥的孔雀尾羽
  if (B.fan) {
    for (let i = 0; i < 11; i++) {
      const a = -160 + i * 14;
      s += `<g transform="rotate(${a + 90} ${b.cx} ${b.cy + 4})"><ellipse cx="${b.cx}" cy="${b.cy - 30}" rx="6" ry="24" fill="${i % 2 ? '#1a9e8f' : '#2fb36b'}"/><circle cx="${b.cx}" cy="${b.cy - 46}" r="5" fill="#f9c74f"/><circle cx="${b.cx}" cy="${b.cy - 46}" r="2.6" fill="#3a0ca3"/></g>`;
    }
  }
  if (o.back) s += o.back;
  // 公雞尾巴
  if (B.tail) {
    // 從屁股往上扇形展開的尾羽
    const big = B.tail === 2, n = big ? 5 : 3, tx = b.cx + b.rx * 0.8, ty = b.cy - b.ry * 0.3, len = big ? 22 : 14;
    const colors = big ? ['#1b4332', '#2d6a4f', '#bc4b51', '#40916c', '#1b4332'] : ['#e9a23b', '#d98324', '#e9a23b'];
    for (let i = 0; i < n; i++) {
      const ang = -85 + i * (big ? 19 : 26);
      s += `<ellipse cx="${tx + len * 0.5}" cy="${ty}" rx="${len * 0.55}" ry="${big ? 3.4 : 2.8}" fill="${colors[i]}" transform="rotate(${ang} ${tx} ${ty})"/>`;
    }
  }
  // 腳
  if (!B.egg) {
    const fy = 96, legTop = b.cy + b.ry - 2;
    for (const fx of [b.cx - 7, b.cx + 6]) s += `<path d="M${fx} ${legTop} V${fy - 1}" stroke="${orange}" stroke-width="2.4"/><path d="M${fx - 5} ${fy} L${fx} ${fy - 2} L${fx + 5} ${fy} M${fx} ${fy - 2} V${fy + .5}" stroke="${orange}" stroke-width="2" stroke-linecap="round" fill="none"/>`;
  }
  // 脖子（在身體後面）
  if (h && left) s += `<ellipse cx="${(h.cx + b.cx) / 2 - 2}" cy="${(h.cy + b.cy) / 2}" rx="${h.r * 0.75}" ry="${(b.cy - h.cy) / 2 + 2}" fill="${fill}">${anim}</ellipse>`;
  // 小翅膀（圓滾滾、正面的在兩側）
  if (!left) for (const sx of [-1, 1]) s += `<ellipse cx="${b.cx + sx * b.rx * 0.95}" cy="${b.cy + 2}" rx="${b.rx * 0.28}" ry="${b.ry * 0.38}" fill="${shade}" transform="rotate(${sx * 25} ${b.cx + sx * b.rx * 0.95} ${b.cy + 2})"/>`;
  // 身體
  s += `<ellipse cx="${b.cx}" cy="${b.cy}" rx="${b.rx}" ry="${b.ry}" fill="${fill}">${anim}</ellipse>`;
  if (left) s += `<ellipse cx="${b.cx + b.rx * 0.18}" cy="${b.cy + 1}" rx="${b.rx * 0.55}" ry="${b.ry * 0.42}" fill="${shade}" transform="rotate(-12 ${b.cx} ${b.cy})"/>`;
  // 衣服
  if (o.on) s += `<g clip-path="url(#pc${u})">${o.on}</g>`;
  if (o.front) s += o.front;
  // 頭
  if (h) s += `<circle cx="${h.cx}" cy="${h.cy}" r="${h.r}" fill="${fill}">${anim}</circle>`;
  // 雞冠、肉垂、羽冠、頭頂毛
  if (B.comb) { const r = B.comb === 2 ? 4.2 : 3; for (let i = -1; i <= 1; i++) s += `<circle cx="${h.cx + i * r * 1.1}" cy="${h.cy - h.r - r * 0.3 + Math.abs(i) * r * 0.5}" r="${r}" fill="#e63946"/>`; }
  if (B.wattle) s += `<ellipse cx="${h.cx - h.r * 0.55}" cy="${h.cy + h.r * 0.75}" rx="2.4" ry="3.6" fill="#e63946"/>`;
  if (B.crest) for (let i = -1; i <= 1; i++) s += `<path d="M${h.cx + i * 2} ${h.cy - h.r} l${i * 3} -9" stroke="#1a9e8f" stroke-width="1.2"/><circle cx="${h.cx + i * 5}" cy="${h.cy - h.r - 9}" r="1.8" fill="#f9c74f"/>`;
  if (B.face === 'ball') s += `<path d="M46 33 q2 -6 4 0 q2 -7 4 0" stroke="${shade}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  // 臉
  if (left) {
    const ex = h.cx - h.r * 0.38, ey = h.cy - h.r * 0.12;
    s += `<circle cx="${ex}" cy="${ey}" r="${h.r * 0.17}" fill="${ink}"/><circle cx="${ex - h.r * 0.05}" cy="${ey - h.r * 0.07}" r="${h.r * 0.06}" fill="#fff"/>` +
      `<path d="M${h.cx - h.r * 0.82} ${h.cy - h.r * 0.02} l${-h.r * 0.5} ${h.r * 0.16} l${h.r * 0.5} ${h.r * 0.2} z" fill="${orange}"/>` +
      `<ellipse cx="${h.cx - h.r * 0.1}" cy="${h.cy + h.r * 0.35}" rx="${h.r * 0.2}" ry="${h.r * 0.12}" fill="#ff8fab" opacity=".6"/>`;
  } else {
    const fx = h ? h.cx : b.cx, fy = h ? h.cy : b.cy - 10, rr = h ? h.r : 26;
    for (const sx of [-1, 1]) s += `<circle cx="${fx + sx * rr * 0.32}" cy="${fy - rr * 0.08}" r="${rr * 0.12}" fill="${ink}"/><circle cx="${fx + sx * rr * 0.32 - rr * 0.04}" cy="${fy - rr * 0.13}" r="${rr * 0.045}" fill="#fff"/><ellipse cx="${fx + sx * rr * 0.5}" cy="${fy + rr * 0.18}" rx="${rr * 0.13}" ry="${rr * 0.08}" fill="#ff8fab" opacity=".6"/>`;
    s += `<path d="M${fx - rr * 0.13} ${fy + rr * 0.08} L${fx + rr * 0.13} ${fy + rr * 0.08} L${fx} ${fy + rr * 0.3} Z" fill="${orange}"/>`;
  }
  // 蛋殼（破殼小雞）
  if (B.egg) s += `<path d="M17 66 L25 59 L32 66 L40 58 L50 65 L59 58 L67 65 L75 58 L83 66 C83 87 71 98 50 98 C29 98 17 87 17 66 Z" fill="#fffaf0" stroke="#e5d8bf" stroke-width="1"/><path d="M30 80 q4 -3 8 0 M60 86 q4 -3 8 0" stroke="#efe3cc" stroke-width="1.4" fill="none"/>`;
  // 帽子、拿的東西（表情圖案）
  const hat = hatId && PET_ITEM[hatId], gear = gearId && PET_ITEM[gearId];
  if (hat) s += `<text x="${B.hat.x}" y="${B.hat.y + B.hat.s * 0.36}" font-size="${B.hat.s}" text-anchor="middle">${hat.emoji}</text>`;
  if (gear) s += `<text x="${B.gear.x}" y="${B.gear.y}" font-size="22" text-anchor="middle" transform="rotate(${left ? 12 : -12} ${B.gear.x} ${B.gear.y})">${gear.emoji}</text>`;
  return s + '</svg>';
}

// px：場景大小；mini：首頁左上角的小頭像（不畫小裝飾和手上的東西）
function petSceneHtml(px, mini = false) {
  const p = S.pet;
  const si = petStage(p);
  const bg = PET_ITEM[p.equip.bg] || PET_SHOP.bg.items[0];
  const mount = p.equip.mount && PET_ITEM[p.equip.mount];
  const petPx = px * PET_BODY[si].size * (mount ? 0.8 : 1);
  const ground = mount ? px * 0.24 : px * 0.05;
  let h = `<div class="pet-scene" style="width:${px}px;height:${px}px;background:${bg.bg}">`;
  if (bg.art) h += `<svg class="pet-art" viewBox="0 0 100 100" preserveAspectRatio="none">${bg.art}</svg>`;
  h += (bg.deco || []).filter(d => !mini || (d[3] || 0) >= 0.25)
    .map(([e, x, y, sz = 0.13]) => `<span class="pet-deco" style="font-size:${px * sz}px;left:${x}%;top:${y}%">${e}</span>`).join('');
  if (mount) h += `<span class="pet-part" style="font-size:${px * 0.36}px;left:${px / 2 - px * 0.2}px;bottom:${px * 0.01}px">${mount.emoji}</span>`;
  h += `<div class="pet-part pet-body${p.equip.color === 'c-gold' ? ' pet-gold' : ''}" style="width:${petPx}px;height:${petPx}px;left:${(px - petPx) / 2}px;bottom:${ground}px">` +
    petSvg(si, p.equip.color, p.equip.outfit, mini ? null : p.equip.gear, p.equip.hat) + '</div>';
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
        <div class="small muted" style="margin-top:6px">點小雞可以免費摸摸頭（今天還有 ${Math.max(0, PET_PATS_PER_DAY - pats)} 次）。
          每答對 1 題，小雞成長 +${PET_LEARN.grow}，飽足、心情、清潔也會補一點（最多到 ${PET_LEARN.floor}）。肚子太餓時長得比較慢喔！</div>
        <div class="small" style="margin-top:4px">📅 本週成長 <b>${petWeekGrow()} / ${PET_WEEK_CAP}</b>${petWeekGrow() >= PET_WEEK_CAP ? '（已滿，下週一再長大；照顧仍會讓小雞開心）' : ''}</div>
        ${S.petDailyLimit ? `<div class="small muted">爸媽設定：每天最多花 ${S.petDailyLimit} 金幣在小雞身上（今天已花 ${ensureDay().petSpent || 0}）</div>` : ''}
      </div>
    </div>
    ${petRoadmapHtml()}
    <div class="pet-tabs">${tabs.map(([k, label]) => `<button class="${petTab === k ? 'on' : ''}" onclick="petTab='${k}';petPage()">${label}</button>`).join('')}</div>
    <div class="card">${petTab === 'care' ? petCareHtml(free) : petShopHtml(petTab, free)}</div>`;
}
// 成長路線圖：讓孩子先看到之後會變成什麼樣子
function petRoadmapHtml() {
  const p = S.pet;
  const si = petStage(p);
  const color = PET_ITEM[p.equip.color] || {};
  const last = PET_STAGES[PET_STAGES.length - 1];
  // 用最近 7 天的平均成長速度估計還要幾天
  const t = today();
  const recent = Array.from({ length: 7 }, (_, i) => S.days[addDays(t, -i)]?.petGrow || 0);
  const active = recent.filter(v => v > 0).length;
  const perDay = active ? Math.min(recent.reduce((a, b) => a + b, 0) / active, PET_WEEK_CAP / 7) : 0; // 只平均有玩的天數，且不超過每週上限
  const left = Math.max(0, last.at - p.grow);
  let eta = '';
  if (si === PET_STAGES.length - 1) eta = `🎉 已經養成「${last.name}」了，太厲害了！`;
  else if (perDay > 0) {
    const days = Math.ceil(left / perDay);
    const when = addDays(t, days);
    eta = `照最近的速度（每天約 ${Math.round(perDay)}），大約 <b>${days} 天後（${shortDate(when)}）</b>變成「${last.name}」` +
      (when <= PET_GOAL.date ? '，趕得上目標！💪' : `，要再加油才趕得上 ${shortDate(PET_GOAL.date)} 喔！`);
  } else eta = '開始答題、照顧小雞，就能算出還要多久長大！';
  return `
    <div class="card">
      <div class="row between wrap"><h3>🗺️ 成長路線圖</h3><span class="small muted">目標：${PET_GOAL.label}（${shortDate(PET_GOAL.date)}）養成「${last.name}」</span></div>
      <div class="pet-road">${PET_STAGES.map((st, i) => {
        const state = i < si ? 'done' : i === si ? 'now' : 'next';
        return `<div class="road-step ${state}">
          <span class="road-emoji">${petSvg(i, p.equip.color, null, null, null)}</span>
          <b>${st.name}</b><span class="small muted">${st.desc}</span>
          <span class="road-tag">${state === 'done' ? '✓ 完成' : state === 'now' ? '現在' : `還差 ${st.at - p.grow}`}</span>
        </div>`;
      }).join('<span class="road-arrow">➜</span>')}</div>
      <div class="xpbar" style="margin-top:12px"><div style="width:${Math.min(100, p.grow / last.at * 100).toFixed(1)}%;background:var(--ok)"></div></div>
      <div class="small" style="margin-top:6px">總成長 ${p.grow} / ${last.at}。${eta}</div>
    </div>`;
}

// ───────── 家長頁：金幣去向與小雞花費上限 ─────────
function coinFlowHtml() {
  const t = today();
  const week = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6));
  const sum = key => week.reduce((a, k) => a + ((S.days[k] || {})[key] || 0), 0);
  const doneIn = r => r.done && week.includes(r.doneDate || r.date);
  const rewardWeek = S.redeems.filter(doneIn).reduce((a, r) => a + r.cost, 0);
  const rewardAll = S.redeems.filter(r => r.done).reduce((a, r) => a + r.cost, 0);
  return `
    <div class="card">
      <h3>🪙 金幣去向</h3>
      <table>
        <tr><th></th><th class="num">今天</th><th class="num">近 7 天</th><th class="num">累計</th></tr>
        <tr><td>賺到的金幣</td><td class="num">${ensureDay().earned || 0}</td><td class="num">${sum('earned')}</td><td class="num">—</td></tr>
        <tr><td>🐣 花在小雞</td><td class="num">${ensureDay().petSpent || 0}</td><td class="num">${sum('petSpent')}</td><td class="num">${S.pet.spent || 0}</td></tr>
        <tr><td>🎁 兌換獎勵</td><td class="num">—</td><td class="num">${rewardWeek}</td><td class="num">${rewardAll}</td></tr>
        <tr><td>🛡️ 保護卡</td><td class="num">${ensureDay().shieldSpent || 0}</td><td class="num">${sum('shieldSpent')}</td><td class="num">${S.shieldSpent || 0}</td></tr>
      </table>
      <p class="small muted">目前剩 ${S.coins} 金幣。小雞成長 ${S.pet.grow} / ${PET_STAGES[PET_STAGES.length - 1].at}（${PET_STAGES[petStage(S.pet)].name}），本週 ${petWeekGrow()} / ${PET_WEEK_CAP}。</p>
      <div class="row wrap">
        <span>小雞每天最多花</span>
        <input id="petlim" type="tel" value="${S.petDailyLimit || ''}" placeholder="不限制" style="width:100px">
        <span>金幣</span>
        <button class="btn-sm" onclick="setPetLimit()">儲存</button>
      </div>
      <p class="small muted">留空或 0 ＝ 不限制。小雞照顧、商店、改名都算在內。</p>
    </div>`;
}
function setPetLimit() {
  const v = parseInt(document.getElementById('petlim').value, 10);
  S.petDailyLimit = v > 0 ? v : 0;
  save();
  toast(S.petDailyLimit ? `小雞每天最多花 ${S.petDailyLimit} 金幣` : '小雞花費不限制');
  parentPage();
}

function petCareHtml(free) {
  const full = petWeekGrow() >= PET_WEEK_CAP;
  return `${full ? '<p class="small pending">本週成長已滿 🌙 現在照顧只會讓小雞開心，不會長大，下週一再一起努力！</p>' : ''}
    <div class="pet-grid">${PET_CARE.map(c => {
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
    const big = slot === 'bg' && ((it.deco || []).find(d => (d[3] || 0) >= 0.25) || (it.deco || [])[0]);
    const preview = slot === 'color' ? `<span class="pi-ico pi-svg">${petSvg(2, it.id)}</span>`
      : slot === 'outfit' ? `<span class="pi-ico pi-svg">${petSvg(Math.max(2, petStage(p)), p.equip.color, it.id)}</span>`
      : slot === 'bg' ? `<span class="pi-ico pi-bg" style="background:${it.bg}">${it.art ? `<svg class="pet-art" viewBox="0 0 100 100" preserveAspectRatio="none">${it.art}</svg>` : ''}${big ? `<span class="pi-bg-deco">${big[0]}</span>` : ''}</span>`
      : `<span class="pi-ico">${it.emoji}</span>`;
    const label = on ? (slot === 'color' || slot === 'bg' ? '使用中' : '使用中（點一下卸下）') : owned ? '點一下換上' : it.cost ? `🪙 ${it.cost}` : '免費';
    return `<button class="pet-item ${on ? 'on' : ''}" onclick="petShopTap('${slot}','${it.id}')" ${!owned && free < it.cost ? 'disabled' : ''}>
      ${preview}<b>${it.name}</b><span class="pi-cost ${owned ? 'owned' : ''}">${label}</span></button>`;
  }).join('')}</div>`;
}

// ───────── 動作 ─────────
// 花在小雞身上的金幣：受家長設定的每日上限限制，並記錄起來給家長頁統計
function petSpend(cost, what) {
  const d = ensureDay();
  const limit = S.petDailyLimit || 0;
  if (limit && (d.petSpent || 0) + cost > limit) { toast(`今天花在小雞的金幣已達爸媽設定的上限 ${limit} 個`); return false; }
  if (spendable() < cost) { toast('金幣不夠喔'); return false; }
  if (!confirm(`要花 ${cost} 金幣「${what}」嗎？

按「確定」才會扣金幣，按「取消」就不買。`)) return false; // 每次花金幣都先確認，避免誤觸
  S.coins -= cost;
  d.petSpent = (d.petSpent || 0) + cost;
  S.pet.spent = (S.pet.spent || 0) + cost;
  return true;
}
// 答對題目時由 app.js 呼叫
function petLearn() {
  petTick();
  const p = S.pet;
  for (const k of ['food', 'happy', 'clean']) if (p[k] < PET_LEARN.floor) p[k] = Math.min(PET_LEARN.floor, p[k] + PET_LEARN.per);
  petGrow(PET_LEARN.grow);
}
// 這週（週一開始）已經成長多少
function petWeekGrow() {
  const ws = weekStart(today());
  return Array.from({ length: 7 }, (_, i) => S.days[addDays(ws, i)]?.petGrow || 0).reduce((a, b) => a + b, 0);
}
function petGrow(n) {
  const p = S.pet;
  const before = petStage(p);
  const d = ensureDay();
  const room = Math.max(0, PET_WEEK_CAP - petWeekGrow());
  const got = Math.min(room, p.food < 20 ? Math.ceil(n / 2) : n); // 太餓長得慢；每週有上限
  if (got < n && !d.petCapNoticed && room === 0) { d.petCapNoticed = true; toast(`🌙 ${p.name} 這週已經長很多了，下週一再繼續長大！（照顧還是能讓牠開心喔）`); }
  p.grow += got;
  d.petGrow = (d.petGrow || 0) + got;
  const after = petStage(p);
  if (after > before) {
    setTimeout(() => { burst('🎉', 20); toast(`🎊 ${p.name} 長大了！變成「${PET_STAGES[after].name}」`); }, 300);
  }
  return got;
}
function petCare(id) {
  const c = PET_CARE.find(x => x.id === id);
  petTick();
  if (!c) return;
  if (petWeekGrow() >= PET_WEEK_CAP && !confirm(`本週成長已經滿了，這次「${c.name}」只會讓小雞的狀態變好，不會長大。還要花 ${c.cost} 金幣嗎？`)) return;
  if (!petSpend(c.cost, c.name)) return;
  const p = S.pet;
  for (const k of ['food', 'happy', 'clean']) if (c[k]) p[k] = Math.min(100, p[k] + c[k]);
  const got = petGrow(c.grow);
  save();
  burst(c.icon, 8);
  toast(`${c.icon} ${p.name}：謝謝你！${got ? `成長 +${got}` : '（本週成長已滿，但我很開心！）'}`);
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
  if (cost && !petSpend(cost, '改名')) return;
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
  .pi-bg { width: 72px; height: 54px; border-radius: 10px; position: relative; overflow: hidden; }
  .pi-bg-deco { position: absolute; right: 4px; top: 4px; font-size: 26px; line-height: 1; }
  .pi-cost { font-size: 14px; font-weight: 700; color: #a76a00; }
  .pi-cost.owned { color: var(--ok); }
  .pet-road { display: flex; align-items: stretch; gap: 4px; overflow-x: auto; padding: 8px 2px 4px; -webkit-overflow-scrolling: touch; }
  .road-step { flex: none; width: 112px; display: flex; flex-direction: column; align-items: center; gap: 2px; text-align: center; padding: 10px 6px; border-radius: 16px; background: var(--bg); border: 3px solid transparent; }
  .road-step b { font-size: 15px; }
  .road-step .small { font-size: 12px; line-height: 1.3; }
  .road-step.now { border-color: var(--brand); background: var(--brand-soft); }
  .road-step.next .road-emoji { opacity: .6; }
  .road-step.done { opacity: .75; }
  .road-emoji { width: 64px; height: 64px; display: inline-block; }
  .road-tag { margin-top: auto; font-size: 13px; font-weight: 800; color: var(--brand-dark); }
  .road-step.done .road-tag { color: var(--ok); }
  .road-arrow { align-self: center; color: var(--muted); flex: none; }
  `;
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
})();
