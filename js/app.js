import { DB } from './db.js';
import { Cloud } from './cloud.js';
import { fitAll, watchFit } from './fit-text.js';
import { scanSlip } from './ocr.js';
import { fmtShort, fmtLong, fmtMonth, toInputValue, fromInputValue, money, parseAmount, round2, uid, esc } from './utils.js';

/* ================= ค่าคงที่ ================= */
const THEMES = {
  mint:     { name: 'มิ้นต์',     primary: '#8fdcc8', deep: '#3aa98d' },
  sky:      { name: 'ฟ้า',       primary: '#9fd0f5', deep: '#4a94d4' },
  lavender: { name: 'ลาเวนเดอร์', primary: '#c3b4f3', deep: '#7c66d6' },
  rose:     { name: 'ชมพู',      primary: '#f7b2c8', deep: '#d4668b' },
  peach:    { name: 'พีช',       primary: '#ffc3a6', deep: '#e1825c' },
  lemon:    { name: 'เลมอน',     primary: '#f7df8c', deep: '#c9a227' },
  sage:     { name: 'เซจ',       primary: '#bcd9a8', deep: '#6f9f52' },
  lilac:    { name: 'ไลแลค',     primary: '#e2b6ee', deep: '#a65cbf' },
};
const WALLET_ICONS = {
  wallet: '<svg class="line-ico" width="20" height="20" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M16 12a1 1 0 1 0 2 0 1 1 0 1 0-2 0z"/><path d="M6 6V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/></svg>',
  card:   '<svg class="line-ico" width="20" height="20" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
  bank:   '<svg class="line-ico" width="20" height="20" viewBox="0 0 24 24"><line x1="3" y1="21" x2="21" y2="21"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="5 6 12 3 19 6"/><line x1="4" y1="10" x2="4" y2="21"/><line x1="20" y1="10" x2="20" y2="21"/><line x1="8" y1="14" x2="8" y2="17"/><line x1="12" y1="14" x2="12" y2="17"/><line x1="16" y1="14" x2="16" y2="17"/></svg>',
  coins:  '<svg class="line-ico" width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M14.5 9h-4a1.5 1.5 0 0 0 0 3h3a1.5 1.5 0 0 1 0 3h-4"/><line x1="12" y1="7" x2="12" y2="9"/><line x1="12" y1="15" x2="12" y2="17"/></svg>',
  cash:   '<svg class="line-ico" width="20" height="20" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg>',
  tag:    '<svg class="line-ico" width="20" height="20" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
  cart:   '<svg class="line-ico" width="20" height="20" viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
  home:   '<svg class="line-ico" width="20" height="20" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  plane:  '<svg class="line-ico" width="20" height="20" viewBox="0 0 24 24"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3.5c-.5-.5-2.5 0-4 1.5L13.5 8.5 5.3 6.7c-.7-.1-1.3.2-1.6.8l-.6 1.1 5.3 3.8-3.4 3.4-2.4-.7-.9.5 2 2 2 2 .5-.9-.7-2.4 3.4-3.4 3.8 5.3 1.1-.6c.6-.3.9-.9.8-1.6z"/></svg>',
  star:   '<svg class="line-ico" width="20" height="20" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
};
const LEGACY_MAP = {
  '👛': 'wallet', '💰': 'coins', '🏦': 'bank', '💳': 'card', '🐷': 'coins',
  '💵': 'cash', '🎁': 'tag', '🛒': 'cart', '🏠': 'home', '✈️': 'plane'
};
function renderWalletIcon(key) {
  if (WALLET_ICONS[key]) return WALLET_ICONS[key];
  const mapped = LEGACY_MAP[key];
  if (mapped && WALLET_ICONS[mapped]) return WALLET_ICONS[mapped];
  return WALLET_ICONS.wallet;
}
const ICONS = Object.keys(WALLET_ICONS);
const PAGE = 150;
const OCR_STATUS = {
  'loading tesseract core': 'กำลังโหลดตัวอ่านสลิป…',
  'initializing tesseract': 'กำลังเริ่มต้น…',
  'loading language traineddata': 'กำลังโหลดภาษาไทย (ครั้งแรกเท่านั้น)…',
  'initializing api': 'กำลังเตรียมระบบ…',
  'recognizing text': 'กำลังอ่านข้อมูลในสลิป…',
};

/* ================= DOM ================= */
const $ = (s) => document.querySelector(s);
const el = {
  topbar: $('#topbar'), walletTitle: $('#walletTitle'), btnMenu: $('#btnMenu'), btnSummary: $('#btnSummary'),
  dateLabel: $('#dateLabel'), inDate: $('#inDate'), inSlip: $('#inSlip'), inTitle: $('#inTitle'), inAmount: $('#inAmount'),
  btnIncome: $('#btnIncome'), btnExpense: $('#btnExpense'), list: $('#txList'), empty: $('#empty'), btnMore: $('#btnMore'),
  drawer: $('#drawer'), backdrop: $('#backdrop'), btnCloseDrawer: $('#btnCloseDrawer'), walletList: $('#walletList'),
  btnAddWallet: $('#btnAddWallet'), tglDark: $('#tglDark'), btnBackup: $('#btnBackup'), inRestore: $('#inRestore'), inCSV: $('#inCSV'), btnClearCache: $('#btnClearCache'),
  btnCloud: $('#btnCloud'), cloudLabel: $('#cloudLabel'), cloudDot: $('#cloudDot'), drawerFoot: $('#drawerFoot'),
  csStatus: $('#csStatus'), csUrl: $('#csUrl'), csKey: $('#csKey'), csConnect: $('#csConnect'),
  csSyncNow: $('#csSyncNow'), csPull: $('#csPull'), csDisconnect: $('#csDisconnect'), csActions: $('#csActions'),
  sumTitle: $('#sumTitle'), sumBody: $('#sumBody'),
  wsTitle: $('#wsTitle'), wsName: $('#wsName'), wsIcons: $('#wsIcons'), wsThemes: $('#wsThemes'), wsSave: $('#wsSave'), wsDelete: $('#wsDelete'),
  tsType: $('#tsType'), tsDate: $('#tsDate'), tsTitle: $('#tsTitle'), tsAmount: $('#tsAmount'), tsSave: $('#tsSave'), tsDelete: $('#tsDelete'),
  loader: $('#loader'), loaderText: $('#loaderText'), loaderBar: $('#loaderBar'), toast: $('#toast'),
  metaTheme: document.querySelector('meta[name="theme-color"]'),
};

/* ================= State ================= */
const state = {
  wallets: [], currentId: null, txs: [], limit: PAGE,
  entryDate: Date.now(), dateTouched: false,
  editTxId: null, editTxType: 'out', editWalletId: null, draft: null,
};
const currentWallet = () => state.wallets.find((w) => w.id === state.currentId);
const fitHTML = (text, cls = '') => `<span class="fit ${cls}"><span>${esc(text)}</span></span>`;

/* ================= Theme & Mode ================= */
function applyTheme() {
  const t = THEMES[currentWallet()?.theme] || THEMES.mint;
  const s = document.documentElement.style;
  s.setProperty('--primary', t.primary);
  s.setProperty('--primary-deep', t.deep);
  updateMetaTheme();
}
function updateMetaTheme() {
  const dark = document.documentElement.dataset.mode === 'dark';
  const t = THEMES[currentWallet()?.theme] || THEMES.mint;
  el.metaTheme.setAttribute('content', dark ? '#15171d' : t.primary);
}
function applyMode(mode) {
  document.documentElement.dataset.mode = mode;
  el.tglDark.checked = mode === 'dark';
  updateMetaTheme();
}

/* ================= UI helpers ================= */
let toastTimer;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2400);
}
function retrigger(node, cls) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }
function nudge(input, msg) { toast(msg); retrigger(input, 'shake'); }
function showLoader(text, p = 0) {
  el.loaderText.textContent = text;
  el.loaderBar.style.width = `${Math.round((p || 0) * 100)}%`;
  el.loader.classList.add('show');
}
const hideLoader = () => el.loader.classList.remove('show');
const openSheet = (id) => document.getElementById(id).classList.add('open');
function closeSheet(id) { document.getElementById(id).classList.remove('open'); document.activeElement?.blur(); }

/* ================= วันที่ในฟอร์ม ================= */
function updateDateLabel() {
  el.dateLabel.textContent = fmtShort(state.entryDate);
  if (document.activeElement !== el.inDate) el.inDate.value = toInputValue(state.entryDate);
  fitAll(el.dateLabel.parentElement);
}
function resetEntryDate() { state.entryDate = Date.now(); state.dateTouched = false; updateDateLabel(); }
function onDateChange() {
  if (!el.inDate.value) return resetEntryDate();
  state.entryDate = fromInputValue(el.inDate.value, state.entryDate);
  state.dateTouched = true;
  updateDateLabel();
}

/* ================= รายการ ================= */
function renderList() {
  const sorted = [...state.txs].sort((a, b) => a.date - b.date || a.createdAt - b.createdAt);
  let bal = 0;
  const rows = sorted.map((t) => {
    bal = round2(bal + (t.type === 'in' ? t.amount : -t.amount));
    return { t, bal };
  }).reverse();

  el.list.innerHTML = rows.slice(0, state.limit).map(({ t, bal }) => {
    const isIn = t.type === 'in';
    return `<li class="tx" data-id="${t.id}">
      <div class="tx-info">${fitHTML(fmtLong(t.date), 'tx-date')}${fitHTML(t.title, 'tx-title')}</div>
      <div class="pill in ${isIn ? '' : 'zero'}">${fitHTML(isIn ? money(t.amount) : '0', 'right')}</div>
      <div class="pill out ${isIn ? 'zero' : ''}">${fitHTML(isIn ? '0' : money(t.amount), 'right')}</div>
      <div class="pill bal ${bal < 0 ? 'neg' : ''}">${fitHTML(money(bal), 'right')}</div>
      <button class="edit-btn" data-edit="${t.id}" aria-label="แก้ไขรายการ" title="แก้ไข">
        <svg class="line-ico" width="13" height="13" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
    </li>`;
  }).join('');

  el.empty.hidden = rows.length > 0;
  el.btnMore.hidden = rows.length <= state.limit;
  fitAll(el.list);
}

async function addTx(type) {
  const title = el.inTitle.value.trim();
  const amount = parseAmount(el.inAmount.value);
  if (!title) return nudge(el.inTitle, 'กรุณาพิมพ์รายการ');
  if (!(amount > 0)) return nudge(el.inAmount, 'กรุณาใส่จำนวนเงิน');

  const tx = { id: uid(), walletId: state.currentId, date: state.entryDate, title, amount, type, createdAt: Date.now() };
  state.txs.push(tx);
  renderList();                         // แสดงผลทันที ไม่ต้องรอฐานข้อมูล
  el.inTitle.value = '';
  el.inAmount.value = '';
  document.activeElement?.blur();
  resetEntryDate();
  try {
    await DB.putTx(tx);
    toast(type === 'in' ? 'บันทึกรายรับแล้ว ✓' : 'บันทึกรายจ่ายแล้ว ✓');
  } catch {
    state.txs = state.txs.filter((x) => x.id !== tx.id);
    renderList();
    toast('บันทึกไม่สำเร็จ');
  }
}

async function deleteTx(id) {
  const t = state.txs.find((x) => x.id === id);
  if (!t || !confirm(`ลบรายการ "${t.title}" ?`)) return;
  state.txs = state.txs.filter((x) => x.id !== id);
  renderList();
  await DB.deleteTx(id);
  await renderWallets();
  toast('ลบรายการแล้ว');
}

function setEditType(type) {
  state.editTxType = type;
  el.tsType.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.type === type));
}
function openTxSheet(id) {
  const t = state.txs.find((x) => x.id === id);
  if (!t) return;
  state.editTxId = id;
  el.tsDate.value = toInputValue(t.date);
  el.tsTitle.value = t.title;
  el.tsAmount.value = t.amount;
  setEditType(t.type);
  openSheet('sheetTx');
}
async function saveTxEdit() {
  const t = state.txs.find((x) => x.id === state.editTxId);
  if (!t) return;
  const title = el.tsTitle.value.trim();
  const amount = parseAmount(el.tsAmount.value);
  if (!title) return nudge(el.tsTitle, 'กรุณาพิมพ์รายการ');
  if (!(amount > 0)) return nudge(el.tsAmount, 'จำนวนเงินไม่ถูกต้อง');
  const updatedDate = fromInputValue(el.tsDate.value, t.date);
  Object.assign(t, { 
    title, 
    amount: round2(amount), 
    type: state.editTxType, 
    date: updatedDate 
  });
  await DB.putTx(t);
  closeSheet('sheetTx');
  renderList();
  await renderWallets();
  toast('แก้ไขแล้ว ✓');
}

/* ================= สแกนสลิป ================= */
async function handleSlip(e) {
  const file = e.target.files?.[0];
  e.target.value = '';                  // ไม่เก็บไฟล์ไว้
  if (!file) return;
  showLoader('กำลังเตรียมรูป…', 0);
  try {
    const r = await scanSlip(file, (m) => showLoader(OCR_STATUS[m.status] || 'กำลังประมวลผล…', m.progress));
    const got = [];
    if (r.date) {
      state.entryDate = r.date.getTime();
      state.dateTouched = true;
      updateDateLabel();
      retrigger(el.dateLabel.closest('.date-field'), 'flash');
      got.push('วันที่');
    }
    if (r.amount != null) {
      el.inAmount.value = Number.isInteger(r.amount) ? String(r.amount) : r.amount.toFixed(2);
      retrigger(el.inAmount, 'flash');
      got.push('จำนวนเงิน');
    }
    toast(got.length
      ? `ดึง${got.join('และ')}แล้ว พิมพ์รายการแล้วกดบันทึกได้เลย`
      : 'อ่านข้อมูลไม่ได้ ลองใช้รูปสลิปที่ชัดขึ้น');
  } catch (err) {
    console.error(err);
    toast(`สแกนไม่สำเร็จ: ${err?.message || 'ครั้งแรกต้องต่ออินเทอร์เน็ต'}`);
  } finally {
    hideLoader();
  }
}

/* ================= กระเป๋าเงิน ================= */
const sortWallets = () => state.wallets.sort((a, b) => a.createdAt - b.createdAt);

async function loadWallet() {
  localStorage.setItem('mm-wallet', state.currentId);
  const w = currentWallet();
  applyTheme();
  el.walletTitle.textContent = w.name;
  fitAll(el.topbar);
  state.txs = await DB.getTx(w.id);
  state.limit = PAGE;
  renderList();
}

async function renderWallets() {
  const sums = await DB.balances();
  el.walletList.innerHTML = state.wallets.map((w) => {
    const t = THEMES[w.theme] || THEMES.mint;
    return `<li class="wallet-item ${w.id === state.currentId ? 'active' : ''}" data-id="${w.id}" style="--wp:${t.primary};--wd:${t.deep}">
      <span class="clay-ico sm">${renderWalletIcon(w.icon)}</span>
      <span class="w-meta">${fitHTML(w.name, 'w-name')}${fitHTML(`คงเหลือ ${money(sums[w.id] || 0)} บาท`, 'w-bal')}</span>
      <button class="w-edit" data-edit="${w.id}" aria-label="แก้ไขกระเป๋า">
        <svg class="line-ico" width="14" height="14" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
    </li>`;
  }).join('');
  fitAll(el.walletList);
}

async function openDrawer() {
  await renderWallets();
  el.drawer.classList.add('open');
  el.backdrop.classList.add('show');
}
function closeDrawer() {
  el.drawer.classList.remove('open');
  el.backdrop.classList.remove('show');
}
async function switchWallet(id) {
  closeDrawer();
  if (id === state.currentId) return;
  state.currentId = id;
  await loadWallet();
}

function renderPickers() {
  const d = state.draft;
  const t = THEMES[d.theme];
  el.wsThemes.innerHTML = Object.entries(THEMES).map(([k, th]) =>
    `<button type="button" class="swatch ${k === d.theme ? 'sel' : ''}" data-theme="${k}" style="--wp:${th.primary};--wd:${th.deep}"><i></i><span>${th.name}</span></button>`
  ).join('');
  el.wsIcons.innerHTML = ICONS.map((i) =>
    `<button type="button" class="clay-ico ${i === d.icon ? 'sel' : ''}" data-icon="${i}" style="--wp:${t.primary};--wd:${t.deep}">${renderWalletIcon(i)}</button>`
  ).join('');
}
function openWalletSheet(id) {
  const w = id ? state.wallets.find((x) => x.id === id) : null;
  const keys = Object.keys(THEMES);
  state.editWalletId = w ? w.id : null;
  state.draft = { theme: w?.theme || keys[state.wallets.length % keys.length], icon: w?.icon || 'wallet' };
  el.wsTitle.textContent = w ? 'แก้ไขกระเป๋า' : 'เพิ่มกระเป๋าใหม่';
  el.wsName.value = w?.name || '';
  el.wsDelete.hidden = !w;
  renderPickers();
  openSheet('sheetWallet');
}
async function saveWallet() {
  const name = el.wsName.value.trim();
  if (!name) return nudge(el.wsName, 'กรุณาตั้งชื่อกระเป๋า');
  const { theme, icon } = state.draft;
  const isNew = !state.editWalletId;
  let w;
  if (isNew) {
    w = { id: uid(), name, theme, icon, createdAt: Date.now() };
    state.wallets.push(w);
  } else {
    w = state.wallets.find((x) => x.id === state.editWalletId);
    Object.assign(w, { name, theme, icon });
  }
  await DB.putWallet(w);
  closeSheet('sheetWallet');
  if (isNew) {
    state.currentId = w.id;
    closeDrawer();
    await loadWallet();
  } else {
    if (w.id === state.currentId) {
      applyTheme();
      el.walletTitle.textContent = w.name;
      fitAll(el.topbar);
    }
    await renderWallets();
  }
  toast('บันทึกกระเป๋าแล้ว ✓');
}
async function deleteWallet() {
  const w = state.wallets.find((x) => x.id === state.editWalletId);
  if (!w) return;
  if (state.wallets.length === 1) return toast('ต้องมีอย่างน้อย 1 กระเป๋า');
  if (!confirm(`ลบกระเป๋า "${w.name}" และรายการทั้งหมดในกระเป๋านี้?`)) return;
  await DB.deleteWallet(w.id);
  state.wallets = state.wallets.filter((x) => x.id !== w.id);
  closeSheet('sheetWallet');
  if (state.currentId === w.id) {
    state.currentId = state.wallets[0].id;
    await loadWallet();
  }
  await renderWallets();
  toast('ลบกระเป๋าแล้ว');
}

/* ================= สรุปภาพรวม ================= */
function openSummary() {
  const w = currentWallet();
  let tin = 0, tout = 0;
  const months = new Map();
  for (const t of state.txs) {
    const d = new Date(t.date);
    const k = d.getFullYear() * 12 + d.getMonth();
    const m = months.get(k) || { k, y: d.getFullYear(), m: d.getMonth(), in: 0, out: 0 };
    if (t.type === 'in') { m.in += t.amount; tin += t.amount; } else { m.out += t.amount; tout += t.amount; }
    months.set(k, m);
  }
  const list = [...months.values()].sort((a, b) => b.k - a.k);
  const max = Math.max(1, ...list.map((m) => Math.max(m.in, m.out)));
  const bal = round2(tin - tout);

  el.sumTitle.textContent = `สรุปภาพรวม · ${w.name}`;
  el.sumBody.innerHTML = `
    <div class="sum-cards">
      <div class="sum-card in">
        <span class="clay-ico sm" style="--wp:#a8e6bd;--wd:#3ea765">
          <svg class="line-ico" width="16" height="16" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
        </span>
        <small>รายรับรวม</small>${fitHTML(money(tin), 'big')}
      </div>
      <div class="sum-card out">
        <span class="clay-ico sm" style="--wp:#f7b9b9;--wd:#d45a5a">
          <svg class="line-ico" width="16" height="16" viewBox="0 0 24 24"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
        </span>
        <small>รายจ่ายรวม</small>${fitHTML(money(tout), 'big')}
      </div>
      <div class="sum-card ${bal < 0 ? 'neg' : ''}">
        <span class="clay-ico sm">
          <svg class="line-ico" width="16" height="16" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M16 12a1 1 0 1 0 2 0 1 1 0 1 0-2 0z"/><path d="M6 6V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/></svg>
        </span>
        <small>คงเหลือ</small>${fitHTML(money(bal), 'big')}
      </div>
      <div class="sum-card">
        <span class="clay-ico sm">
          <svg class="line-ico" width="16" height="16" viewBox="0 0 24 24"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="13" y2="15"/></svg>
        </span>
        <small>จำนวนรายการ</small>${fitHTML(`${state.txs.length} รายการ`, 'big')}
      </div>
    </div>
    <p class="sec-title">สรุปรายเดือน</p>
    ${list.length ? list.map((m) => {
      const net = round2(m.in - m.out);
      return `<div class="month">
        <div class="month-head">${fitHTML(fmtMonth(m.y, m.m))}<b class="net ${net < 0 ? 'neg' : 'pos'} fit right"><span>${net >= 0 ? '+' : ''}${money(net)}</span></b></div>
        <div class="bar-row"><span>รับ</span><div class="bar"><i style="width:${(m.in / max) * 100}%"></i></div>${fitHTML(money(m.in), 'right')}</div>
        <div class="bar-row out"><span>จ่าย</span><div class="bar"><i style="width:${(m.out / max) * 100}%"></i></div>${fitHTML(money(m.out), 'right')}</div>
      </div>`;
    }).join('') : '<p class="sum-empty">ยังไม่มีข้อมูล</p>'}`;
  openSheet('sheetSummary');
  fitAll(el.sumBody);
  fitAll(el.sumTitle.parentElement);
}

/* ================= Backup / Restore ================= */
async function backup() {
  const data = await DB.exportAll();
  const json = JSON.stringify({ app: 'MyMoney', version: 1, exportedAt: Date.now(), ...data });
  const d = new Date();
  const name = `mymoney-backup-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
  const file = new File([json], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'MyMoney Backup' });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
  } catch { /* ผู้ใช้กดยกเลิก */ }
}

async function applyImported(data, silent = false) {
  if (!Array.isArray(data?.wallets) || !Array.isArray(data?.tx) || !data.wallets.length) {
    throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
  }
  await DB.importAll(data, silent);
  state.wallets = await DB.getWallets();
  sortWallets();
  if (!state.wallets.some((w) => w.id === state.currentId)) state.currentId = state.wallets[0].id;
  await loadWallet();
  await renderWallets();
}

async function restore(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!confirm(`กู้คืน ${data.wallets?.length ?? 0} กระเป๋า / ${data.tx?.length ?? 0} รายการ?\nข้อมูลปัจจุบันจะถูกแทนที่ทั้งหมด`)) return;
    await applyImported(data);
    toast('กู้คืนข้อมูลแล้ว ✓');
  } catch (err) {
    toast(`กู้คืนไม่สำเร็จ: ${err.message}`);
  }
}

function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

async function handleCSVImport(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;

  try {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) throw new Error('ไฟล์ไม่มีข้อมูล');
    const header = parseCSVLine(lines[0]).map((h) => h.trim());
    const titleIdx = header.findIndex((h) => h === 'รายการ');
    const inIdx = header.findIndex((h) => h === 'รายรับ');
    const outIdx = header.findIndex((h) => h === 'รายจ่าย');

    if (titleIdx === -1 || (inIdx === -1 && outIdx === -1)) {
      throw new Error('หัวตารางไม่ถูกต้อง (ต้องมี วันที่, รายการ, รายรับ, รายจ่าย)');
    }

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVLine(lines[i]);
      const r = {};
      header.forEach((h, idx) => { r[h] = vals[idx]?.trim() ?? ''; });
      rows.push(r);
    }

    const lastRow = rows[rows.length - 1];
    let walletName = file.name.replace(/\.[^/.]+$/, '');
    if (lastRow && lastRow['รายการ'] && lastRow['รายการ'].startsWith('กระเป๋า')) {
      walletName = lastRow['รายการ'];
    }

    const txRows = rows.filter((r) => {
      const inc = parseFloat(r['รายรับ'] || '0') || 0;
      const exp = parseFloat(r['รายจ่าย'] || '0') || 0;
      return inc > 0 || exp > 0;
    });

    if (!txRows.length) throw new Error('ไม่พบรายการรายรับ-รายจ่ายในไฟล์');

    if (!confirm(`นำเข้า ${txRows.length} รายการ จาก "${file.name}"?\n(ข้อมูลจะถูกนำเข้าสู่กระเป๋า: ${walletName})`)) return;

    showLoader('กำลังนำเข้าข้อมูล CSV…', 0.5);

    const wId = uid();
    const newWallet = {
      id: wId,
      name: walletName,
      theme: 'mint',
      icon: 'wallet',
      createdAt: Date.now(),
    };

    const chronological = [...txRows].reverse();
    const txs = chronological.map((r, idx) => {
      const inc = parseFloat(r['รายรับ'] || '0') || 0;
      const exp = parseFloat(r['รายจ่าย'] || '0') || 0;
      const type = inc > 0 ? 'in' : 'out';
      const amount = inc > 0 ? inc : exp;

      let dateTs = Date.now();
      if (r['วันที่']) {
        const parts = r['วันที่'].split('-').map(Number);
        let h = 12, m = 0, s = 0;
        if (r['Created']) {
          const c = new Date(r['Created']);
          if (!isNaN(c.getTime())) { h = c.getHours(); m = c.getMinutes(); s = c.getSeconds(); }
        }
        dateTs = new Date(parts[0], parts[1] - 1, parts[2], h, m, s).getTime() + (idx * 1000);
      }

      return {
        id: uid(),
        walletId: wId,
        date: dateTs,
        title: r['รายการ'] || 'ไม่มีชื่อรายการ',
        amount,
        type,
        createdAt: r['Created'] ? (new Date(r['Created']).getTime() || dateTs) : dateTs,
      };
    });

    await DB.putWallet(newWallet);
    for (const t of txs) {
      await DB.putTx(t);
    }

    state.wallets = await DB.getWallets();
    sortWallets();
    state.currentId = wId;
    await loadWallet();
    await renderWallets();
    closeDrawer();
    toast(`นำเข้าสำเร็จ ${txs.length} รายการ ✓`);
  } catch (err) {
    console.error(err);
    toast(`นำเข้าไม่สำเร็จ: ${err.message}`);
  } finally {
    hideLoader();
  }
}

async function clearAppCache() {
  if (!confirm('ล้างแคชเพื่อโหลดแอปเวอร์ชันล่าสุด?\n(ข้อมูลบัญชีและกระเป๋าเงินของคุณจะยังอยู่ครบ ไม่หาย)')) return;
  showLoader('กำลังล้างแคช…', 0.5);
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    toast('ล้างแคชสำเร็จ กำลังเปิดเวอร์ชันใหม่…');
    setTimeout(() => {
      window.location.reload(true);
    }, 600);
  } catch (err) {
    toast(`ล้างแคชไม่สำเร็จ: ${err.message}`);
    hideLoader();
  }
}

/* ================= ซิงก์อัตโนมัติ (Google Drive) ================= */
function renderCloud() {
  const on = Cloud.enabled;
  const last = Cloud.lastSync ? fmtShort(Cloud.lastSync) : 'ยังไม่เคย';
  const map = {
    idle: ['ok', `สำรองล่าสุด ${last}`],
    pending: ['busy', 'รอสำรองข้อมูล…'],
    saving: ['busy', 'กำลังสำรองข้อมูล…'],
    offline: ['busy', 'ออฟไลน์ · จะสำรองเมื่อมีเน็ต'],
    error: ['err', 'สำรองไม่สำเร็จ · แตะเพื่อดู'],
  };
  const [dot, text] = on ? (map[Cloud.status] || map.idle) : ['off', 'ซิงก์อัตโนมัติ: ปิด'];
  el.cloudDot.className = `dot ${dot}`;
  el.cloudLabel.textContent = text;
  el.drawerFoot.textContent = on
    ? 'สำรองอัตโนมัติไปยัง Google Drive ของคุณ'
    : 'ข้อมูลเก็บในเครื่องนี้เท่านั้น · แนะนำเปิดซิงก์อัตโนมัติ';
  fitAll(el.btnCloud);

  el.csStatus.innerHTML = on
    ? `<b>เชื่อมต่อแล้ว</b> · สำรองล่าสุด ${esc(last)}${Cloud.status === 'error' ? `<br>ข้อผิดพลาด: ${esc(Cloud.error)}` : ''}`
    : 'ยังไม่ได้เชื่อมต่อ · ใส่ Web App URL และรหัสลับจาก Google Apps Script';
  el.csActions.hidden = !on;
  el.csDisconnect.hidden = !on;
  el.csConnect.textContent = on ? 'บันทึกการตั้งค่าใหม่' : 'เชื่อมต่อ';
}

function openCloudSheet() {
  const c = Cloud.config;
  el.csUrl.value = c?.url || '';
  el.csKey.value = c?.key || '';
  renderCloud();
  openSheet('sheetCloud');
  fitAll(document.getElementById('sheetCloud'));
}

async function connectCloud() {
  const url = el.csUrl.value.trim();
  const key = el.csKey.value.trim();
  if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) return nudge(el.csUrl, 'URL ต้องเป็นของ script.google.com และลงท้ายด้วย /exec');
  if (!key) return nudge(el.csKey, 'กรุณาใส่รหัสลับ');

  showLoader('กำลังเชื่อมต่อ…', 0.4);
  let info;
  try {
    info = await Cloud.ping({ url, key });
  } catch (e) {
    hideLoader();
    return toast(`เชื่อมต่อไม่สำเร็จ: ${e.message}`);
  }
  hideLoader();
  Cloud.setConfig({ url, key });

  const local = await DB.exportAll();
  if (info.exists && info.tx > 0) {
    // เครื่องใหม่/ลงแอปใหม่ → ดึงข้อมูลกลับมาเองอัตโนมัติ
    if (local.tx.length === 0) return pullCloud(false);
    const msg = `พบข้อมูลบนคลาวด์ ${info.wallets} กระเป๋า / ${info.tx} รายการ\n(สำรองเมื่อ ${fmtShort(info.updatedAt)})\n\n`
      + 'กด "ตกลง" = ดึงข้อมูลคลาวด์มาใช้ในเครื่องนี้\nกด "ยกเลิก" = อัปโหลดข้อมูลในเครื่องนี้ขึ้นไปแทน';
    if (confirm(msg)) return pullCloud(false);
  }
  await Cloud.push();
  toast(Cloud.status === 'idle' ? 'เชื่อมต่อแล้ว ข้อมูลจะสำรองอัตโนมัติ ✓' : `สำรองไม่สำเร็จ: ${Cloud.error || 'ออฟไลน์'}`);
}

async function pullCloud(ask = true) {
  if (ask && !confirm('ดึงข้อมูลจากคลาวด์มาแทนข้อมูลในเครื่องนี้ทั้งหมด?')) return;
  showLoader('กำลังดึงข้อมูลจากคลาวด์…', 0.5);
  try {
    const data = await Cloud.pull();
    if (!data) throw new Error('ยังไม่มีข้อมูลบนคลาวด์');
    await applyImported(data, true);
    Cloud.markClean();
    toast('ดึงข้อมูลจากคลาวด์แล้ว ✓');
  } catch (e) {
    toast(`ดึงข้อมูลไม่สำเร็จ: ${e.message}`);
  } finally {
    hideLoader();
  }
}

async function syncNow() {
  await Cloud.push();
  const msg = { idle: 'สำรองแล้ว ✓', saving: 'กำลังสำรอง…', offline: 'ออฟไลน์อยู่ จะสำรองเมื่อมีเน็ต' }[Cloud.status]
    || `สำรองไม่สำเร็จ: ${Cloud.error}`;
  toast(msg);
}

function disconnectCloud() {
  if (!confirm('ยกเลิกการเชื่อมต่อ?\n(ข้อมูลบน Google Drive ยังอยู่ครบ)')) return;
  Cloud.setConfig(null);
  el.csUrl.value = '';
  el.csKey.value = '';
  toast('ยกเลิกการเชื่อมต่อแล้ว');
}

/* ================= Events ================= */
function bind() {
  el.btnMenu.addEventListener('click', openDrawer);
  el.backdrop.addEventListener('click', closeDrawer);
  el.btnCloseDrawer.addEventListener('click', closeDrawer);
  el.btnSummary.addEventListener('click', openSummary);

  el.btnIncome.addEventListener('click', () => addTx('in'));
  el.btnExpense.addEventListener('click', () => addTx('out'));
  el.inTitle.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.inAmount.focus(); } });
  el.inDate.addEventListener('change', onDateChange);
  el.inDate.addEventListener('blur', onDateChange);
  el.inSlip.addEventListener('change', handleSlip);

  el.list.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-edit]');
    if (editBtn) return openTxSheet(editBtn.dataset.edit);
    const del = e.target.closest('[data-del]');
    if (del) return openTxSheet(del.dataset.del);
    const li = e.target.closest('.tx');
    if (li) openTxSheet(li.dataset.id);
  });
  el.btnMore.addEventListener('click', () => { state.limit += PAGE; renderList(); });

  el.walletList.addEventListener('click', (e) => {
    const ed = e.target.closest('[data-edit]');
    if (ed) return openWalletSheet(ed.dataset.edit);
    const li = e.target.closest('.wallet-item');
    if (li) switchWallet(li.dataset.id);
  });
  el.btnAddWallet.addEventListener('click', () => openWalletSheet(null));
  el.wsThemes.addEventListener('click', (e) => {
    const b = e.target.closest('[data-theme]');
    if (b) { state.draft.theme = b.dataset.theme; renderPickers(); }
  });
  el.wsIcons.addEventListener('click', (e) => {
    const b = e.target.closest('[data-icon]');
    if (b) { state.draft.icon = b.dataset.icon; renderPickers(); }
  });
  el.wsSave.addEventListener('click', saveWallet);
  el.wsDelete.addEventListener('click', deleteWallet);

  el.tsType.addEventListener('click', (e) => {
    const b = e.target.closest('[data-type]');
    if (b) setEditType(b.dataset.type);
  });
  el.tsSave.addEventListener('click', saveTxEdit);
  el.tsDelete.addEventListener('click', () => { const id = state.editTxId; closeSheet('sheetTx'); deleteTx(id); });

  document.querySelectorAll('[data-close]').forEach((b) =>
    b.addEventListener('click', () => closeSheet(b.closest('.sheet-wrap').id)));

  el.tglDark.addEventListener('change', () => {
    const mode = el.tglDark.checked ? 'dark' : 'light';
    localStorage.setItem('mm-mode', mode);
    applyMode(mode);
  });
  el.btnBackup.addEventListener('click', backup);
  el.inRestore.addEventListener('change', restore);
  el.inCSV?.addEventListener('change', handleCSVImport);
  el.btnClearCache?.addEventListener('click', clearAppCache);

  el.btnCloud.addEventListener('click', openCloudSheet);
  el.csConnect.addEventListener('click', connectCloud);
  el.csSyncNow.addEventListener('click', syncNow);
  el.csPull.addEventListener('click', () => pullCloud(true));
  el.csDisconnect.addEventListener('click', disconnectCloud);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !state.dateTouched) resetEntryDate();
  });
}

/* ================= Init ================= */
async function init() {
  applyMode(document.documentElement.dataset.mode || 'light');
  navigator.storage?.persist?.().catch(() => {});
  DB.onChange = () => Cloud.markDirty(); // ทุกครั้งที่ข้อมูลเปลี่ยน → ซิงก์อัตโนมัติ

  state.wallets = await DB.getWallets();
  if (!state.wallets.length) {
    const w = { id: uid(), name: 'กระเป๋าหลัก', theme: 'mint', icon: 'wallet', createdAt: Date.now() };
    await DB.putWallet(w);
    state.wallets = [w];
  }
  sortWallets();
  const saved = localStorage.getItem('mm-wallet');
  state.currentId = state.wallets.some((w) => w.id === saved) ? saved : state.wallets[0].id;

  bind();
  await loadWallet();
  updateDateLabel();
  watchFit();

  Cloud.onStatus(renderCloud);
  renderCloud();
  Cloud.start(); // ส่งข้อมูลที่ค้างอยู่ (ถ้ามี)

  setInterval(() => {
    if (!state.dateTouched && document.activeElement !== el.inDate) {
      state.entryDate = Date.now();
      updateDateLabel();
    }
  }, 20000);

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(console.error);
}

init();
