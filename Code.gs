/**
 * MyMoney Sync — เก็บสำเนาข้อมูลไว้ใน Google Drive ของคุณ (ฟรี)
 * ติดตั้ง: รัน setup() 1 ครั้ง แล้ว Deploy เป็น Web app
 */
const FOLDER_NAME = 'MyMoney Backup';
const LATEST = 'mymoney-latest.json';
const KEEP_DAYS = 30;
const TZ = 'Asia/Bangkok';

function setup() {
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty('SECRET');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '');
    props.setProperty('SECRET', key);
  }
  getFolder();
  Logger.log('รหัสลับของคุณ: ' + key);
}

function doGet() {
  return out({ ok: true, app: 'MyMoney Sync' });
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    const secret = PropertiesService.getScriptProperties().getProperty('SECRET');
    if (!secret || req.key !== secret) return out({ ok: false, error: 'รหัสลับไม่ถูกต้อง' });
    if (req.action === 'ping') return out({ ok: true, info: info() });
    if (req.action === 'save') return out(save(req.data));
    if (req.action === 'load') return out(load());
    return out({ ok: false, error: 'คำสั่งไม่ถูกต้อง' });
  } catch (err) {
    return out({ ok: false, error: String((err && err.message) || err) });
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getFolder() {
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

function upsert(dir, name, content) {
  const it = dir.getFilesByName(name);
  if (it.hasNext()) { it.next().setContent(content); return false; }
  dir.createFile(name, content, MimeType.PLAIN_TEXT);
  return true;
}

function save(data) {
  if (!data || !Array.isArray(data.wallets) || !Array.isArray(data.tx)) {
    return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' };
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const dir = getFolder();
    const json = JSON.stringify(data);
    upsert(dir, LATEST, json);
    const day = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
    const isNewDay = upsert(dir, 'mymoney-' + day + '.json', json);
    if (isNewDay) cleanup(dir); // ล้างไฟล์เก่าวันละครั้ง
    return { ok: true, savedAt: Date.now() };
  } finally {
    lock.releaseLock();
  }
}

function cleanup(dir) {
  const limit = Date.now() - KEEP_DAYS * 864e5;
  const files = dir.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    if (/^mymoney-\d{4}-\d{2}-\d{2}\.json$/.test(f.getName()) && f.getLastUpdated().getTime() < limit) {
      f.setTrashed(true);
    }
  }
}

function load() {
  const it = getFolder().getFilesByName(LATEST);
  return { ok: true, data: it.hasNext() ? JSON.parse(it.next().getBlob().getDataAsString('UTF-8')) : null };
}

function info() {
  const it = getFolder().getFilesByName(LATEST);
  if (!it.hasNext()) return { exists: false };
  const file = it.next();
  const d = JSON.parse(file.getBlob().getDataAsString('UTF-8'));
  return {
    exists: true,
    updatedAt: d.exportedAt || file.getLastUpdated().getTime(),
    wallets: (d.wallets || []).length,
    tx: (d.tx || []).length,
  };
}
