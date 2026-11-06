// บีบช่องไฟตัวอักษรให้ข้อความอยู่ในบรรทัดเดียว (ไม่ตัด ... และไม่ขึ้นบรรทัดใหม่)
// ขั้น 1: ลด letter-spacing (สูงสุด -0.09em)  ขั้น 2: ถ้ายังล้น ค่อยบีบแนวนอนด้วย scaleX
const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
  ? new Intl.Segmenter('th', { granularity: 'grapheme' })
  : null;
const countGraphemes = (s) => (segmenter ? [...segmenter.segment(s)].length : [...s].length);
const MIN_SPACING_EM = -0.09;

export function fitAll(root = document) {
  const boxes = root.matches?.('.fit') ? [root] : [...root.querySelectorAll('.fit')];
  const items = [];

  // 1) reset
  for (const box of boxes) {
    const inner = box.firstElementChild;
    if (!inner) continue;
    inner.style.letterSpacing = '';
    inner.style.transform = '';
    items.push({ box, inner });
  }
  // 2) measure (อ่านค่าทั้งหมดก่อน เพื่อไม่ให้ layout กระตุก)
  for (const it of items) {
    it.avail = it.box.clientWidth;
    it.w = it.inner.getBoundingClientRect().width;
  }
  const over = items.filter((it) => it.avail > 0 && it.w > it.avail + 0.5);

  // 3) บีบช่องไฟ
  for (const it of over) {
    const fs = parseFloat(getComputedStyle(it.inner).fontSize) || 16;
    const n = Math.max(1, countGraphemes(it.inner.textContent));
    const ls = Math.max(MIN_SPACING_EM * fs, -(it.w - it.avail) / n - 0.05);
    it.inner.style.letterSpacing = `${ls.toFixed(2)}px`;
  }
  // 4) วัดใหม่ แล้วบีบแนวนอนถ้ายังล้น
  for (const it of over) it.w2 = it.inner.getBoundingClientRect().width;
  for (const it of over) {
    if (it.w2 > it.avail) it.inner.style.transform = `scaleX(${(it.avail / it.w2 - 0.002).toFixed(4)})`;
  }
}

let raf = 0;
export function watchFit() {
  const run = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => fitAll());
  };
  addEventListener('resize', run);
  addEventListener('orientationchange', run);
  document.fonts?.ready.then(run);
  document.fonts?.addEventListener?.('loadingdone', run);
}
