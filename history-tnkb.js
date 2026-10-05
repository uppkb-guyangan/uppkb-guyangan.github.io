// G-Smart: TNKB untuk halaman Perpindahan Proses.
// Implementasi ringan: tanpa MutationObserver dan tanpa request tambahan.
(() => {
  const caseTnkb = new Map();

  // Tangkap hasil etle_cases yang memang sudah dimuat oleh aplikasi.
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    try {
      const input = args[0];
      const url = String(typeof input === "string" ? input : input?.url || "");
      if (url.includes("/rest/v1/etle_cases")) {
        const originalJson = response.json.bind(response);
        response.json = async () => {
          const data = await originalJson();
          if (Array.isArray(data)) {
            for (const row of data) {
              const id = String(row?.case_id || "").trim();
              const tnkb = String(row?.tnkb || "").trim();
              if (id && tnkb) caseTnkb.set(id, tnkb);
            }
          }
          return data;
        };
      }
    } catch (error) {
      console.warn("G-Smart history TNKB cache:", error);
    }
    return response;
  };

  function isHistoryPage() {
    return document.getElementById("pageTitle")?.textContent?.trim() === "Perpindahan Proses";
  }

  function enrichHistoryTable() {
    if (!isHistoryPage()) return;
    const table = document.querySelector("#content table.data-table");
    if (!table) return;

    const headerRow = table.querySelector("thead tr");
    if (!headerRow) return;
    const headers = [...headerRow.querySelectorAll("th")].map(th => th.textContent.trim());
    if (!headers.includes("Waktu") || !headers.includes("Event") || !headers.includes("Judul") || !headers.includes("Sumber")) return;

    if (!headerRow.querySelector(".history-tnkb-col")) {
      const th = document.createElement("th");
      th.className = "history-tnkb-col";
      th.textContent = "TNKB";
      headerRow.children[0]?.after(th);
    }

    for (const tr of table.querySelectorAll("tbody tr[data-case]")) {
      if (tr.querySelector(".history-tnkb-col")) continue;
      const caseId = String(tr.dataset.case || "").trim();
      const td = document.createElement("td");
      td.className = "history-tnkb-col";
      td.dataset.label = "TNKB";
      td.textContent = caseTnkb.get(caseId) || "-";
      tr.children[0]?.after(td);
    }
  }

  // openPage() dan apply() merender tabel secara sinkron. Jalankan enrichment
  // sekali setelah interaksi yang memang dapat membuat ulang tabel history.
  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const nav = target.closest("#nav .nav-btn[data-id='history']");
    const rerender = target.closest("#resetTableFilters, #clearFilter, #showAllFocusedData");
    if (nav || (rerender && isHistoryPage())) queueMicrotask(enrichHistoryTable);
  });

  document.addEventListener("input", event => {
    if (event.target?.id === "filter" && isHistoryPage()) queueMicrotask(enrichHistoryTable);
  });

  document.addEventListener("change", event => {
    if (event.target?.id === "globalMonth" && isHistoryPage()) queueMicrotask(enrichHistoryTable);
  });
})();
