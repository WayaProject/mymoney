// ฐานข้อมูลในเครื่อง (IndexedDB) — เร็ว ใช้งานออฟไลน์ได้
const DB_NAME = 'mymoney';
const DB_VERSION = 1;
let dbPromise;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('wallets')) db.createObjectStore('wallets', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('tx')) {
          const s = db.createObjectStore('tx', { keyPath: 'id' });
          s.createIndex('walletId', 'walletId', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

const wrap = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
const done = (t) => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = t.onabort = () => rej(t.error); });
const notify = () => { try { DB.onChange?.(); } catch (e) { console.error(e); } };

export const DB = {
  onChange: null, // app.js ตั้งค่าให้เรียกซิงก์อัตโนมัติ

  async getWallets() {
    const db = await openDB();
    return wrap(db.transaction('wallets').objectStore('wallets').getAll());
  },
  async putWallet(w) {
    const db = await openDB();
    const t = db.transaction('wallets', 'readwrite');
    t.objectStore('wallets').put(w);
    await done(t);
    notify();
  },
  async deleteWallet(id) {
    const db = await openDB();
    const t = db.transaction(['wallets', 'tx'], 'readwrite');
    t.objectStore('wallets').delete(id);
    const store = t.objectStore('tx');
    const cur = store.index('walletId').openKeyCursor(IDBKeyRange.only(id));
    cur.onsuccess = () => {
      const c = cur.result;
      if (c) { store.delete(c.primaryKey); c.continue(); }
    };
    await done(t);
    notify();
  },
  async getTx(walletId) {
    const db = await openDB();
    return wrap(db.transaction('tx').objectStore('tx').index('walletId').getAll(walletId));
  },
  async putTx(item) {
    const db = await openDB();
    const t = db.transaction('tx', 'readwrite');
    t.objectStore('tx').put(item);
    await done(t);
    notify();
  },
  async deleteTx(id) {
    const db = await openDB();
    const t = db.transaction('tx', 'readwrite');
    t.objectStore('tx').delete(id);
    await done(t);
    notify();
  },
  async balances() {
    const db = await openDB();
    const all = await wrap(db.transaction('tx').objectStore('tx').getAll());
    const map = {};
    for (const x of all) map[x.walletId] = (map[x.walletId] || 0) + (x.type === 'in' ? x.amount : -x.amount);
    return map;
  },
  async exportAll() {
    const db = await openDB();
    const t = db.transaction(['wallets', 'tx']);
    const [wallets, tx] = await Promise.all([
      wrap(t.objectStore('wallets').getAll()),
      wrap(t.objectStore('tx').getAll()),
    ]);
    return { wallets, tx };
  },
  async importAll({ wallets, tx }, silent = false) {
    const db = await openDB();
    const t = db.transaction(['wallets', 'tx'], 'readwrite');
    const ws = t.objectStore('wallets');
    const ts = t.objectStore('tx');
    ws.clear();
    ts.clear();
    wallets.forEach((w) => ws.put(w));
    tx.forEach((x) => ts.put(x));
    await done(t);
    if (!silent) notify();
  },
};
