/**
 * Make printed pages fit the paper width: just before printing, any table (or
 * element marked .print-fit) wider than the printable width of A4 is scaled down
 * to fit; it is reset afterwards. Pages that print landscape mark themselves with
 * [data-print-landscape] (A4 landscape), everything else is A4 portrait.
 */
const PX_PER_MM = 96 / 25.4;
const MARGIN_MM = 10; // each side

export function printableWidthPx(landscape) {
  return ((landscape ? 297 : 210) - 2 * MARGIN_MM) * PX_PER_MM;
}

/** Scale (≤ 1) that makes content `naturalWidth` px wide fit `pageWidth` px. */
export const fitScale = (naturalWidth, pageWidth) => (naturalWidth > pageWidth ? pageWidth / naturalWidth : 1);

function naturalWidth(el) {
  const { width, minWidth } = el.style;
  el.style.width = 'max-content';
  el.style.minWidth = '0';
  const w = el.scrollWidth;
  el.style.width = width;
  el.style.minWidth = minWidth;
  return w;
}

function fit() {
  const pageW = printableWidthPx(!!document.querySelector('[data-print-landscape]'));
  document.querySelectorAll('main table, main .print-fit').forEach((el) => {
    if (el.closest('.print\\:hidden')) return;
    const s = fitScale(naturalWidth(el), pageW);
    if (s < 1) { el.dataset.printZoom = String(s); el.style.zoom = String(s); }
  });
}

function reset() {
  document.querySelectorAll('[data-print-zoom]').forEach((el) => { el.style.zoom = ''; delete el.dataset.printZoom; });
}

let installed = false;
export function installPrintFit() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('beforeprint', fit);
  window.addEventListener('afterprint', reset);
}
