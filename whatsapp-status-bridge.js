// G-Smart WhatsApp status bridge — 2026-10-06 v2
// Normalizes payment status for the WhatsApp chooser without changing database/auth.
(() => {
  const clean = v => String(v || "").trim();
  const upper = v => clean(v).toUpperCase();

  function moneyNumber(v) {
    const digits = clean(v).replace(/[^0-9-]/g, "");
    const n = Number(digits);
    return Number.isFinite(n) ? n : 0;
  }

  function paymentCard() {
    return Array.from(document.querySelectorAll("#modalBody .detail-card")).find(el =>
      clean(el.querySelector(".detail-card-title")?.textContent)
        .toLowerCase()
        .includes("pembayaran & denda")
    );
  }

  function field(card, labels) {
    if (!card) return null;
    const wanted = labels.map(x => x.toLowerCase());
    return Array.from(card.querySelectorAll(".detail-item")).find(el =>
      wanted.includes(clean(el.querySelector("small")?.textContent).toLowerCase())
    ) || null;
  }

  function statusFromSummary() {
    const cards = Array.from(document.querySelectorAll("#modalBody .detail-summary-card"));
    const card = cards.find(el =>
      clean(el.querySelector("small")?.textContent).toLowerCase().includes("denda / putusan")
    );
    const value = upper(card?.querySelector("span")?.textContent);
    return /\bPAID\b/.test(value) ? "PAID" : /\bINQUIRY\b/.test(value) ? "INQUIRY" : "";
  }

  function statusFromModalText() {
    const value = upper(document.querySelector("#modalBody")?.textContent);
    if (/\bPAID\b/.test(value)) return "PAID";
    if (/\bINQUIRY\b/.test(value)) return "INQUIRY";
    return "";
  }

  function ensureStatusField() {
    const card = paymentCard();
    if (!card) return;

    const statusItem = field(card, ["Status Bayar", "Status Pembayaran"]);
    const current = upper(statusItem?.querySelector("b")?.textContent);

    // 1. Prioritas status eksplisit dari kartu pembayaran.
    let normalized = /\bPAID\b/.test(current)
      ? "PAID"
      : /\bINQUIRY\b/.test(current)
        ? "INQUIRY"
        : "";

    // 2. Fallback ke summary / teks detail bila nama field sumber berbeda.
    if (!normalized) normalized = statusFromSummary();
    if (!normalized) normalized = statusFromModalText();

    // 3. Sisa uang titipan > 0 hanya mungkin setelah titipan denda maksimal,
    //    sehingga untuk kebutuhan template pengembalian diperlakukan sebagai PAID.
    const sisaItem = field(card, ["Sisa", "Sisa Denda", "Sisa Titipan", "Nominal Sisa"]);
    const sisa = moneyNumber(sisaItem?.querySelector("b")?.textContent);
    if (sisa > 0) normalized = "PAID";

    if (!normalized) return;

    // WhatsApp chooser lama membaca label persis "Status Bayar".
    // Jika field ada tetapi kosong/tidak standar, normalisasi nilainya.
    if (statusItem) {
      const valueEl = statusItem.querySelector("b");
      if (valueEl) valueEl.textContent = normalized;
      return;
    }

    const grid = card.querySelector(".detail-grid");
    if (!grid) return;

    const item = document.createElement("div");
    item.className = "detail-item wa-status-bridge";
    item.style.display = "none";
    item.innerHTML = "<small>Status Bayar</small><b>" + normalized + "</b>";
    grid.prepend(item);
  }

  // Jalankan sebelum handler click whatsapp-templates.js membaca Detail Perkara.
  document.addEventListener("pointerdown", event => {
    if (event.target instanceof Element && event.target.closest("#waBtn")) ensureStatusField();
  }, true);

  document.addEventListener("click", event => {
    if (event.target instanceof Element && event.target.closest("#waBtn")) ensureStatusField();
  }, true);

  document.addEventListener("keydown", event => {
    if ((event.key === "Enter" || event.key === " ") && event.target instanceof Element && event.target.closest("#waBtn")) {
      ensureStatusField();
    }
  }, true);
})();
