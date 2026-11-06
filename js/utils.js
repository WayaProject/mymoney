export const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
export const TH_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

const pad = (n) => String(n).padStart(2, '0');
const be = (d) => d.getFullYear() + 543;

/** 5 พ.ย. 2569 21:16 */
export const fmtShort = (ts) => {
  const d = new Date(ts);
  return `${d.getDate()} ${TH_MONTHS_SHORT[d.getMonth()]} ${be(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/** วันศุกร์ที่ 23 ตุลาคม 2569 */
export const fmtLong = (ts) => {
  const d = new Date(ts);
  return `วัน${TH_DAYS[d.getDay()]}ที่ ${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${be(d)}`;
};
export const fmtMonth = (y, m) => `${TH_MONTHS[m]} ${y + 543}`;

export const toInputValue = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromInputValue = (v, fallback = Date.now()) => {
  if (!v) return fallback;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : fallback;
};

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const nf = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });
export const money = (n) => nf.format(round2(n));
export const parseAmount = (s) => {
  const n = parseFloat(String(s ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? round2(n) : NaN;
};

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
