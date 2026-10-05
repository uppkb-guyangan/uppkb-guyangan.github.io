// G-Smart: enrichment TNKB untuk halaman Perpindahan Proses.
// Menambahkan TNKB dari etle_cases ke record gsmart_case_history tanpa mengubah database.
(() => {
  const caseTnkb = new Map();
  let resolveCasesReady;
  const casesReady = new Promise(resolve => { resolveCasesReady = resolve; });
  let casesResolved = false;

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
            data.forEach(row => {
              const id = String(row?.case_id || "").trim();
              const tnkb = String(row?.tnkb || "").trim();
              if (id && tnkb) caseTnkb.set(id, tnkb);
            });
          }
          if (!casesResolved) {
            casesResolved = true;
            resolveCasesReady();
          }
          queueMicrotask(enrichHistoryTable);
          return data;
        };
      }

      if (url.includes("/rest/v1/gsmart_case_history")) {
        const originalJson = response.json.bind(response);
        response.json = async () => {
          const data = await originalJson();
          if (!casesResolved) {
            await Promise.race([
              casesReady,
              new Promise(resolve => setTimeout(resolve, 2500))
            ]);
          }
          if (Array.isArray(data)) {
            data.forEach(row => {
              const id = String(row?.case_id || "").trim();
              if (id && !row.tnkb) row.tnkb = caseTnkb.get(id) || "";
            });
          }
          return data;
        };
      }
    } catch (error) {
      console.warn("G-Smart history TNKB enrichment:", error);
    }
    return response;
  };

  function isHistoryTable(table) {
    if (!table) return false;
    const headers = [...table.querySelectorAll("thead th")].map(th => th.textContent.trim());
    return headers.includes("Waktu") && headers.includes("Event") && headers.includes("Judul") && headers.includes("Sumber");
  }

  function enrichHistoryTable() {
    document.querySelectorAll("#content table.data-table").forEach(table => {
      if (!isHistoryTable(table)) return;

      const headerRow = table.querySelector("thead tr");
      if (headerRow && !headerRow.querySelector(".history-tnkb-col")) {
        const th = document.createElement("th");
        th.className = "history-tnkb-col";
        th.textContent = "TNKB";
        const first = headerRow.children[0];
        first?.after(th);
      }

      table.querySelectorAll("tbody tr[data-case]").forEach(tr => {
        const caseId = String(tr.dataset.case || "").trim();
        const tnkb = caseTnkb.get(caseId) || "-";
        let td = tr.querySelector(".history-tnkb-col");
        if (!td) {
          td = document.createElement("td");
          td.className = "history-tnkb-col";
          td.dataset.label = "TNKB";
          const first = tr.children[0];
          first?.after(td);
        }
        td.textContent = tnkb;
      });
    });
  }

  const observer = new MutationObserver(() => enrichHistoryTable());
  const start = () => {
    const content = document.getElementById("content");
    if (content) observer.observe(content, { childList: true, subtree: true });
    enrichHistoryTable();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
