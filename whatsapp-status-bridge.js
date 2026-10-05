// G-Smart WhatsApp status bridge — 2026-10-06
(() => {
  const clean = v => String(v || "").trim();

  function statusFromSummary() {
    const cards = Array.from(document.querySelectorAll("#modalBody .detail-summary-card"));
    const card = cards.find(el => clean(el.querySelector("small")?.textContent).toLowerCase().includes("denda / putusan"));
    const value = clean(card?.querySelector("span")?.textContent);
    return value && value !== "-" ? value : "";
  }

  function ensureStatusField() {
    const cards = Array.from(document.querySelectorAll("#modalBody .detail-card"));
    const paymentCard = cards.find(el => clean(el.querySelector(".detail-card-title")?.textContent).toLowerCase().includes("pembayaran & denda"));
    if (!paymentCard) return;

    const existing = Array.from(paymentCard.querySelectorAll(".detail-item")).find(el => clean(el.querySelector("small")?.textContent).toLowerCase() === "status bayar");
    if (existing && clean(existing.querySelector("b")?.textContent)) return;

    const status = statusFromSummary();
    const grid = paymentCard.querySelector(".detail-grid");
    if (!status || !grid) return;

    const item = document.createElement("div");
    item.className = "detail-item wa-status-bridge";
    item.style.display = "none";
    const label = document.createElement("small");
    label.textContent = "Status Bayar";
    const value = document.createElement("b");
    value.textContent = status;
    item.append(label, value);
    grid.appendChild(item);
  }

  document.addEventListener("pointerdown", event => {
    if (event.target instanceof Element && event.target.closest("#waBtn")) ensureStatusField();
  }, true);

  document.addEventListener("keydown", event => {
    if ((event.key === "Enter" || event.key === " ") && event.target instanceof Element && event.target.closest("#waBtn")) ensureStatusField();
  }, true);
})();
