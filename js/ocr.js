// สแกนสลิปบนเครื่อง (Tesseract.js) — รูปไม่ถูกอัปโหลด/บันทึก ใช้เสร็จแล้วทิ้งทันที
const TESS_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let workerPromise = null;
let onProgress = () => {};
let idleTimer = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.Tesseract) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('โหลดตัวอ่านสลิปไม่สำเร็จ'));
    document.head.appendChild(s);
  });
}

function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      await loadScript(TESS_SRC);
      return window.Tesseract.createWorker(['tha', 'eng'], 1, { logger: (m) => onProgress(m) });
    })().catch((e) => { workerPromise = null; throw e; });
  }
  return workerPromise;
}

// ปิด worker เมื่อไม่ได้ใช้ 2 นาที เพื่อคืนหน่วยความจำ
function scheduleTerminate() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    if (!workerPromise) return;
    const w = await workerPromise;
    workerPromise = null;
    await w.terminate();
  }, 120000);
}

// ย่อ/ขยายรูป + ทำขาวดำ + เพิ่มคอนทราสต์ ให้ OCR อ่านแม่นขึ้น
async function fileToCanvas(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('เปิดรูปไม่ได้'));
      i.src = url;
    });
    const scale = Math.min(2, 1500 / img.naturalWidth);
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);
    const p = data.data;
    for (let i = 0; i < p.length; i += 4) {
      let g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
      g = (g - 128) * 1.35 + 128;
      g = g < 0 ? 0 : g > 255 ? 255 : g;
      p[i] = p[i + 1] = p[i + 2] = g;
    }
    ctx.putImageData(data, 0, 0);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function scanSlip(file, progress = () => {}) {
  onProgress = progress;
  clearTimeout(idleTimer);
  const [worker, canvas] = await Promise.all([getWorker(), fileToCanvas(file)]);
  try {
    const { data } = await worker.recognize(canvas);
    return { ...parseSlip(data.text), text: data.text };
  } finally {
    canvas.width = canvas.height = 0; // ล้างรูปออกจากหน่วยความจำ
    onProgress = () => {};
    scheduleTerminate();
  }
}

/* ================= ตัวแยกข้อมูลจากข้อความสลิป ================= */
const TH_DIGIT = { '๐': '0', '๑': '1', '๒': '2', '๓': '3', '๔': '4', '๕': '5', '๖': '6', '๗': '7', '๘': '8', '๙': '9' };
const normalize = (t) => t.replace(/[๐-๙]/g, (d) => TH_DIGIT[d]).replace(/\u0E4D\u0E32/g, '\u0E33').replace(/\r/g, '');

const MONTHS = [
  ['มค', 'มกราคม', 'jan'], ['กพ', 'กุมภาพันธ์', 'feb'], ['มีค', 'มีนาคม', 'mar'], ['เมย', 'เมษายน', 'apr'],
  ['พค', 'พฤษภาคม', 'may'], ['มิย', 'มิถุนายน', 'jun'], ['กค', 'กรกฎาคม', 'jul'], ['สค', 'สิงหาคม', 'aug'],
  ['กย', 'กันยายน', 'sep'], ['ตค', 'ตุลาคม', 'oct'], ['พย', 'พฤศจิกายน', 'nov'], ['ธค', 'ธันวาคม', 'dec'],
];
function monthIndex(raw) {
  const k = raw.toLowerCase().replace(/[\s.]/g, '');
  if (!k) return -1;
  for (let i = 0; i < 12; i++) {
    const [ab, full, en] = MONTHS[i];
    if (k === ab || k === full || k.startsWith(en) || (k.length >= 4 && full.startsWith(k))) return i;
  }
  return -1;
}
const toYear = (y) => {
  y = +y;
  if (y < 100) return y >= 40 ? y + 2500 - 543 : 2000 + y; // 68 → 2568 → 2025
  if (y > 2400) return y - 543;                              // พ.ศ. → ค.ศ.
  return y;
};

function parseDate(text) {
  let d = 0, m = -1, y = 0;
  // 23 ต.ค. 68 / 23 ตุลาคม 2568 / 23 Oct 2025
  for (const x of text.matchAll(/(?:^|[^\d])(\d{1,2})\s*([A-Za-z\u0E00-\u0E7F][A-Za-z\u0E00-\u0E7F.\s]{0,14}?)\s*(\d{4}|\d{2})(?!\d)/g)) {
    const mi = monthIndex(x[2]);
    if (mi >= 0 && +x[1] >= 1 && +x[1] <= 31) { d = +x[1]; m = mi; y = toYear(x[3]); break; }
  }
  // Oct 23, 2025
  if (m < 0) {
    for (const x of text.matchAll(/([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/g)) {
      const mi = monthIndex(x[1]);
      if (mi >= 0) { d = +x[2]; m = mi; y = toYear(x[3]); break; }
    }
  }
  // 23/10/2568
  if (m < 0) {
    for (const x of text.matchAll(/(?:^|[^\d])(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{4}|\d{2})(?!\d)/g)) {
      const dd = +x[1], mm = +x[2] - 1;
      if (dd >= 1 && dd <= 31 && mm >= 0 && mm <= 11) { d = dd; m = mm; y = toYear(x[3]); break; }
    }
  }
  if (m < 0 || y < 2000 || y > 2100) return null;
  const t = text.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*:\s*([0-5]\d)(?!\d)/);
  const now = new Date();
  const date = new Date(y, m, d, t ? +t[1] : now.getHours(), t ? +t[2] : now.getMinutes());
  return Number.isNaN(date.getTime()) ? null : date;
}

const KW_AMOUNT = /(จ[ำาํ]{1,2}นวน|ยอดเงิน|ยอดโอน|ยอดชำระ|amount|total|รวม)/i;
const KW_BAD = /(ค่าธรรมเนียม|fee|คงเหลือ|balance|เลขที่|อ้างอิง|ref|รหัส|บัญชี|account|โทร|tel|xxx)/i;
const DATE_LIKE = /(\d{1,2}\s*:\s*\d{2})|(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|([ก-ฮ]{1,2}\.\s?[ก-ฮ]\.?\s*\d{2,4})/;

function parseAmountFromText(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  let best = null;
  lines.forEach((line, i) => {
    const compact = line.replace(/\s+/g, '');
    const prev = i > 0 ? lines[i - 1].replace(/\s+/g, '') : '';
    for (const m of line.matchAll(/(\d{1,3}(?:,\d{3})+|\d+)(?:\s?\.\s?(\d{2}))?(?!\d)/g)) {
      const digits = m[1].replace(/,/g, '');
      if (digits.length > 8) continue;
      const val = parseFloat(digits + (m[2] ? `.${m[2]}` : ''));
      if (!(val > 0)) continue;
      let s = 0;
      if (m[2]) s += 3;
      if (m[1].includes(',')) s += 1;
      if (KW_AMOUNT.test(compact)) s += 5;
      else if (KW_AMOUNT.test(prev)) s += 3;
      if (/บาท|thb|฿/i.test(compact)) s += 3;
      if (KW_BAD.test(compact)) s -= 8;
      if (DATE_LIKE.test(line)) s -= 4;
      if (!m[2] && digits.length >= 6) s -= 3;
      if (!best || s > best.s) best = { val, s };
    }
  });
  return best && best.s >= 3 ? best.val : null;
}

export function parseSlip(raw) {
  const text = normalize(raw || '');
  return { date: parseDate(text), amount: parseAmountFromText(text) };
}
