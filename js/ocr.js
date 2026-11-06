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

// ปรับขนาดรูปให้พอเหมาะสำหรับ OCR โดยคงความคมชัดของตัวหนังสือและวรรณยุกต์ไทย
async function fileToCanvas(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('เปิดรูปไม่ได้'));
      i.src = url;
    });
    const scale = Math.min(2.5, 1600 / img.naturalWidth);
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
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
const normalize = (t) => (t || '')
  .replace(/[๐-๙]/g, (d) => TH_DIGIT[d])
  .replace(/\u0E4D\u0E32/g, '\u0E33')
  .replace(/\r/g, '')
  .replace(/,/g, ' ');

const MONTHS = [
  ['มค', 'มกราคม', 'jan', 'january'],
  ['กพ', 'กุมภาพันธ์', 'feb', 'february'],
  ['มีค', 'มีนาคม', 'mar', 'march'],
  ['เมย', 'เมษายน', 'apr', 'april'],
  ['พค', 'พฤษภาคม', 'may'],
  ['มิย', 'มิถุนายน', 'jun', 'june'],
  ['กค', 'กรกฎาคม', 'jul', 'july'],
  ['สค', 'สิงหาคม', 'aug', 'august'],
  ['กย', 'กันยายน', 'sep', 'september'],
  ['ตค', 'ตุลาคม', 'oct', 'october'],
  ['พย', 'พฤศจิกายน', 'nov', 'november'],
  ['ธค', 'ธันวาคม', 'dec', 'december'],
];

function monthIndex(raw) {
  if (!raw) return -1;
  let k = raw.toLowerCase()
    .replace(/(พ\.?ศ\.?|ค\.?ศ\.?)/g, '')
    .replace(/[\s.]/g, '');
  if (!k) return -1;
  for (let i = 0; i < 12; i++) {
    const list = MONTHS[i];
    for (const m of list) {
      if (k === m || k.startsWith(m) || (k.length >= 3 && m.startsWith(k))) {
        return i;
      }
    }
  }
  return -1;
}

const toYear = (y) => {
  y = +y;
  if (y < 100) return y >= 40 ? y + 2500 - 543 : 2000 + y; // 69 -> 2026, 26 -> 2026
  if (y > 2400) return y - 543;                              // 2569 -> 2026
  return y;
};

function extractTime(lineOrText) {
  if (!lineOrText) return null;
  // 1. แบบมี : เช่น 20:34 หรือ 20:34:15
  let m = lineOrText.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*[:]\s*([0-5]\d)(?:\s*[:]\s*([0-5]\d))?(?!\d)/);
  if (m) return { h: +m[1], m: +m[2] };
  // 2. แบบจุดที่มี น. กำกับ เช่น 20.34 น. หรือ 20.34น. หรือ เวลา 20.34
  m = lineOrText.match(/(?:เวลา\s*)?([01]?\d|2[0-3])\s*[.]\s*([0-5]\d)\s*(?:น\.?)/);
  if (m) return { h: +m[1], m: +m[2] };
  // 3. แบบจุดทั่วไปที่มีความน่าจะเป็นเวลา 0-23.00-59
  m = lineOrText.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*[.]\s*([0-5]\d)(?!\d)/);
  if (m && +m[1] >= 0 && +m[1] <= 23 && +m[2] >= 0 && +m[2] <= 59) {
    return { h: +m[1], m: +m[2] };
  }
  return null;
}

const TH_MONTH_PATTERN = 'ม\\.?\\s*ค|ก\\.?\\s*พ|มี\\.?\\s*ค|เม\\.?\\s*ย|พ\\.?\\s*ค|มิ\\.?\\s*ย|ก\\.?\\s*ค|ส\\.?\\s*ค|ก\\.?\\s*ย|ต\\.?\\s*ค|พ\\.?\\s*ย|ธ\\.?\\s*ค|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';

function parseDate(text) {
  let d = 0, m = -1, y = 0;

  // 1. วัน เดือน ปี (เช่น 4 พ.ย. 69, 04 พ.ย. 69, 4 พ.ย. 2569, 4 พ.ย. พ.ศ. 2569, 4 พ.ย.69, 4 Nov 2026)
  const thaiDateRegex = new RegExp(`(?:^|[^\\d])(\\d{1,2})\\s*(${TH_MONTH_PATTERN})[.\\s]*(?:พ\\.?ศ\\.?\\s*|ค\\.?ศ\\.?\\s*)?(\\d{4}|\\d{2})(?!\\d)`, 'gi');
  for (const match of text.matchAll(thaiDateRegex)) {
    const mi = monthIndex(match[2]);
    const day = +match[1];
    const year = toYear(match[3]);
    if (mi >= 0 && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
      d = day; m = mi; y = year;
      break;
    }
  }

  // 2. Month Day, Year (เช่น Nov 4, 2026)
  if (m < 0) {
    const enRegex = /([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4}|\d{2})/g;
    for (const match of text.matchAll(enRegex)) {
      const mi = monthIndex(match[1]);
      const day = +match[2];
      const year = toYear(match[3]);
      if (mi >= 0 && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
        d = day; m = mi; y = year;
        break;
      }
    }
  }

  // 3. ตัวเลขล้วน เช่น 04/11/2569, 04/11/69, 04-11-2026
  if (m < 0) {
    const numRegex = /(?:^|[^\d])(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{4}|\d{2})(?!\d)/g;
    for (const match of text.matchAll(numRegex)) {
      const dd = +match[1];
      const mm = +match[2] - 1;
      const yy = toYear(match[3]);
      if (dd >= 1 && dd <= 31 && mm >= 0 && mm <= 11 && yy >= 2000 && yy <= 2100) {
        d = dd; m = mm; y = yy;
        break;
      }
    }
  }

  if (m < 0 || y < 2000 || y > 2100) return null;

  // หาเวลา (ชั่วโมง:นาที) - ตรวจจากบรรทัดเดียวกับวันที่ก่อน
  let time = null;
  const lines = text.split('\n');
  const lineWithDate = lines.find((l) => l.includes(String(d)) && (l.includes(String(y)) || l.includes(String(y + 543)) || l.includes(String(y + 543).slice(-2))));
  if (lineWithDate) {
    time = extractTime(lineWithDate);
  }
  if (!time) {
    time = extractTime(text);
  }

  const now = new Date();
  const date = new Date(y, m, d, time ? time.h : now.getHours(), time ? time.m : now.getMinutes(), 0);
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
