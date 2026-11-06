// ซิงก์อัตโนมัติไปยัง Google Drive ผ่าน Google Apps Script (ฟรี)
// แนวคิด: ข้อมูลในเครื่องเป็นหลัก (เร็ว) แล้วส่งสำเนาขึ้นคลาวด์เบื้องหลัง
import { DB } from './db.js';

const K = { cfg: 'mm-cloud', dirty: 'mm-cloud-dirty', last: 'mm-cloud-last' };
const DEBOUNCE_MS = 3000;
const RETRY_MS = 60000;
const TIMEOUT_MS = 30000;

let timer = 0;
let busy = false;
let again = false;
let status = 'idle'; // idle | pending | saving | offline | error
let lastError = '';
const listeners = new Set();

function getConfig() {
  try { return JSON.parse(localStorage.getItem(K.cfg)); } catch { return null; }
}
const enabled = () => { const c = getConfig(); return !!(c && c.url && c.key); };
const isDirty = () => localStorage.getItem(K.dirty) === '1';
function setStatus(s, err = '') {
  status = s;
  lastError = err;
  listeners.forEach((fn) => fn());
}

async function call(action, extra = {}, cfg = getConfig()) {
  if (!cfg?.url) throw new Error('ยังไม่ได้ตั้งค่า');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    // ส่งเป็น text/plain (ค่าเริ่มต้น) เพื่อเลี่ยง CORS preflight ของ Apps Script
    const res = await fetch(cfg.url, {
      method: 'POST',
      body: JSON.stringify({ action, key: cfg.key, ...extra }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let j;
    try { j = await res.json(); } catch { throw new Error('URL ไม่ถูกต้อง หรือยังไม่ได้ตั้งสิทธิ์เป็น Anyone'); }
    if (!j.ok) throw new Error(j.error || 'เกิดข้อผิดพลาด');
    return j;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('หมดเวลาเชื่อมต่อ');
    throw e;
  } finally {
    clearTimeout(t);
  }
}

async function push() {
  clearTimeout(timer);
  if (!enabled()) return;
  if (busy) { again = true; return; }
  if (!navigator.onLine) { setStatus('offline'); return; }
  busy = true;
  setStatus('saving');
  localStorage.removeItem(K.dirty); // ถ้ามีการแก้ไขระหว่างส่ง จะถูกตั้งค่าใหม่อีกครั้ง
  try {
    const data = await DB.exportAll();
    await call('save', { data: { app: 'MyMoney', version: 1, exportedAt: Date.now(), ...data } });
    localStorage.setItem(K.last, String(Date.now()));
    setStatus('idle');
  } catch (e) {
    localStorage.setItem(K.dirty, '1');
    setStatus('error', e.message);
    timer = setTimeout(push, RETRY_MS); // ลองใหม่อัตโนมัติ
  } finally {
    busy = false;
    if (again) { again = false; push(); }
  }
}

export const Cloud = {
  get enabled() { return enabled(); },
  get config() { return getConfig(); },
  get status() { return status; },
  get error() { return lastError; },
  get lastSync() { return Number(localStorage.getItem(K.last)) || 0; },
  get dirty() { return isDirty(); },

  onStatus(fn) { listeners.add(fn); },

  setConfig(cfg) {
    if (cfg) {
      localStorage.setItem(K.cfg, JSON.stringify(cfg));
    } else {
      localStorage.removeItem(K.cfg);
      localStorage.removeItem(K.last);
      clearTimeout(timer);
    }
    setStatus('idle');
  },

  markDirty() {
    localStorage.setItem(K.dirty, '1');
    if (!enabled()) return;
    clearTimeout(timer);
    timer = setTimeout(push, DEBOUNCE_MS);
    if (status !== 'saving') setStatus('pending');
  },

  markClean() {
    localStorage.removeItem(K.dirty);
    localStorage.setItem(K.last, String(Date.now()));
    setStatus('idle');
  },

  push,
  async ping(cfg) { return (await call('ping', {}, cfg)).info; },
  async pull() { return (await call('load')).data; },

  start() {
    addEventListener('online', () => { if (isDirty()) push(); });
    addEventListener('offline', () => { if (enabled()) setStatus('offline'); });
    // สลับออกจากแอป → ส่งทันที ไม่ต้องรอ
    document.addEventListener('visibilitychange', () => { if (isDirty()) push(); });
    if (isDirty()) push();
  },
};
