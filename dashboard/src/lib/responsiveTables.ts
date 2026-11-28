/**
 * Dar ekranda tablolar satır kartlarına dönüşür (CSS: app.css "Tablo · telefon").
 * Başlıklar gizlendiği için her hücreye sütun adını `data-label` olarak yazar;
 * React'in çizdiği yeni satırları MutationObserver ile yakalar.
 */
function label(table: HTMLTableElement) {
  const heads = Array.from(table.tHead?.rows[0]?.cells ?? []).map((th) => th.textContent?.trim() ?? "");
  if (!heads.length) return;
  for (const body of Array.from(table.tBodies)) {
    for (const row of Array.from(body.rows)) {
      Array.from(row.cells).forEach((cell, i) => {
        const text = heads[i] ?? "";
        if (cell.getAttribute("data-label") !== text) cell.setAttribute("data-label", text);
      });
    }
  }
}

export function installResponsiveTables() {
  let queued = false;
  const run = () => {
    queued = false;
    document.querySelectorAll<HTMLTableElement>("table.table").forEach(label);
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(run);
  };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule();
}
