// G-Smart WhatsApp message chooser — 2026-10-06
// Always exposes all three templates; the operator chooses freely.
(() => {
  const $ = id => document.getElementById(id);
  const text = v => String(v || "").trim();

  function normalizePhone(v) {
    const d = text(v).replace(/\D/g, "");
    if (d.startsWith("08")) return "62" + d.slice(1);
    if (d.startsWith("628")) return d;
    return null;
  }

  function fieldFromCard(cardTitle, label) {
    const cards = [...document.querySelectorAll("#modalBody .detail-card")];
    const card = cards.find(el => text(el.querySelector(".detail-card-title")?.textContent).toLowerCase().includes(cardTitle.toLowerCase()));
    if (!card) return "";
    const item = [...card.querySelectorAll(".detail-item")].find(el => text(el.querySelector("small")?.textContent).toLowerCase() === label.toLowerCase());
    return text(item?.querySelector("b")?.textContent);
  }

  function heroField(label) {
    const item = [...document.querySelectorAll("#modalBody .detail-key")].find(el => text(el.querySelector("small")?.textContent).toLowerCase() === label.toLowerCase());
    return text(item?.querySelector("strong")?.textContent);
  }

  function parseMoney(v) {
    const n = Number(text(v).replace(/[^0-9-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function formatMoney(n) {
    return "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(n) || 0);
  }

  function readDetail() {
    const tnkb = text(document.querySelector("#modalBody .detail-tnkb")?.textContent) || fieldFromCard("Informasi Perkara", "TNKB");
    const noBlanko = fieldFromCard("Informasi Perkara", "No. Blanko");
    const phone = fieldFromCard("Data Pelanggar", "No. Telepon");
    const owner = heroField("Nama Pemilik") || fieldFromCard("Kendaraan & KIR", "Nama Pemilik") || fieldFromCard("Data Pelanggar", "Nama") || "Bapak/Ibu";
    const statusBayar = fieldFromCard("Pembayaran & Denda", "Status Bayar").toUpperCase();
    const tanggalSidang = fieldFromCard("Persidangan", "Tanggal Sidang");
    const denda = fieldFromCard("Persidangan", "Denda Putusan") || fieldFromCard("Pembayaran & Denda", "Denda Pengadilan");
    const biaya = fieldFromCard("Persidangan", "Biaya Perkara") || fieldFromCard("Pembayaran & Denda", "Biaya Perkara");
    const total = parseMoney(denda) + parseMoney(biaya);
    const jenis = heroField("Jenis Pelanggaran") || fieldFromCard("Informasi Perkara", "Jenis Pelanggaran") || "ETLE";
    const kejaksaan = noBlanko ? "https://tilang.kejaksaan.go.id/detail/" + encodeURIComponent(noBlanko) : "";
    return { tnkb, noBlanko, phone, owner, statusBayar, tanggalSidang, denda, biaya, total, jenis, kejaksaan };
  }

  function genericMessage(d) {
    return [
      "Yth. Bapak/Ibu,", "",
      "Kami dari Guyangan Response Center ingin mengonfirmasi terkait pelanggaran " + (d.jenis || "ETLE") + " untuk kendaraan:", "",
      "No. Polisi: " + (d.tnkb || "-"), "",
      "Mohon konfirmasinya agar dapat kami lakukan pengecekan lebih lanjut pada sistem.", "",
      "Terima kasih.", "*GUYANGAN RESPONSE CENTER*"
    ].join("\n");
  }

  function inquiryMessage(d) {
    return [
      "*INFORMASI PEMBAYARAN TILANG ETLE*", "",
      "Yth. Bapak/Ibu *" + (d.owner || "-") + "*,", "",
      "Perkara tilang ETLE kendaraan:",
      "TNKB: *" + (d.tnkb || "-") + "*",
      "No. Blanko: *" + (d.noBlanko || "-") + "*",
      "Tgl. Sidang: *" + (d.tanggalSidang || "-") + "*", "",
      "telah memperoleh putusan:",
      "Denda: *" + (d.denda || "-") + "*",
      "Biaya Perkara: *" + (d.biaya || "-") + "*",
      "*Total: " + (d.total ? formatMoney(d.total) : "-") + "*", "",
      "Pembayaran dapat dilakukan melalui e-Tilang Kejaksaan RI:",
      d.kejaksaan ? "*" + d.kejaksaan + "*" : "-", "",
      "Mohon lakukan pembayaran paling lambat *7 hari kerja sejak tanggal putusan* untuk menghindari pemblokiran STNK.", "",
      "*Mohon balas pesan ini setelah pembayaran dilakukan.*", "",
      "Terima kasih.", "*GUYANGAN RESPONSE CENTER*"
    ].join("\n");
  }

  function paidMessage(d) {
    return [
      "*INFORMASI PENGEMBALIAN SISA UANG TITIPAN*", "",
      "Yth. Bapak/Ibu *" + (d.owner || "-") + "*,", "",
      "Untuk perkara tilang ETLE kendaraan:",
      "TNKB: *" + (d.tnkb || "-") + "*",
      "No. Blanko: *" + (d.noBlanko || "-") + "*",
      "Tgl. Sidang: *" + (d.tanggalSidang || "-") + "*", "",
      "*Titipan denda maksimal telah dilakukan.* Berdasarkan putusan pengadilan:",
      "Denda: *" + (d.denda || "-") + "*",
      "Biaya Perkara: *" + (d.biaya || "-") + "*",
      "*Total: " + (d.total ? formatMoney(d.total) : "-") + "*", "",
      "Informasi perkara dapat dilihat melalui e-Tilang Kejaksaan RI:",
      d.kejaksaan ? "*" + d.kejaksaan + "*" : "-", "",
      "Terdapat *sisa uang titipan* yang dapat dikembalikan sesuai ketentuan.", "",
      "Silakan *balas pesan ini* untuk mendapatkan informasi dan bantuan mekanisme pengembalian sisa uang titipan.", "",
      "Terima kasih.", "*GUYANGAN RESPONSE CENTER*"
    ].join("\n");
  }

  function openWa(phone, message) {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      window.alert("Nomor WhatsApp tidak valid atau tidak tersedia.");
      return;
    }
    window.open("https://wa.me/" + normalized + "?text=" + encodeURIComponent(message), "_blank", "noopener,noreferrer");
    closeChooser();
  }

  function closeChooser() { $("waTemplateOverlay")?.remove(); }

  function showChooser() {
    closeChooser();
    const d = readDetail();
    const status = d.statusBayar || "BELUM TERSEDIA";
    const statusClass = status.includes("PAID") ? "paid" : status.includes("INQUIRY") ? "inquiry" : "neutral";

    const choices =
      '<button type="button" class="wa-template-choice" data-wa-template="generic"><span class="wa-choice-icon">💬</span><span><b>Konfirmasi Pelanggaran</b><small>Konfirmasi umum terkait perkara ETLE</small></span></button>' +
      '<button type="button" class="wa-template-choice" data-wa-template="inquiry"><span class="wa-choice-icon">💳</span><span><b>Informasi Pembayaran</b><small>Informasi putusan dan pembayaran tilang</small></span></button>' +
      '<button type="button" class="wa-template-choice" data-wa-template="paid"><span class="wa-choice-icon">💰</span><span><b>Informasi Pengembalian Sisa Uang Titipan</b><small>Informasi pengembalian sisa uang titipan</small></span></button>';

    const overlay = document.createElement("div");
    overlay.id = "waTemplateOverlay";
    overlay.className = "wa-template-overlay";
    overlay.innerHTML =
      '<section class="wa-template-dialog" role="dialog" aria-modal="true" aria-label="Pilih Pesan WhatsApp">' +
        '<button type="button" class="wa-template-close" aria-label="Tutup">✕</button>' +
        '<div class="wa-template-kicker">WHATSAPP · GUYANGAN RESPONSE CENTER</div>' +
        '<h3>Pilih Pesan WhatsApp</h3>' +
        '<p>Tiga pilihan selalu tersedia. Pilih pesan sesuai kebutuhan.</p>' +
        '<div class="wa-case-summary"><b>' + (d.tnkb || "-") + '</b><span>' + (d.noBlanko || "No. blanko belum tersedia") + '</span><i class="' + statusClass + '">' + status + '</i></div>' +
        '<div class="wa-template-choices">' + choices + '</div>' +
      '</section>';

    document.body.appendChild(overlay);
    overlay.querySelector(".wa-template-close").onclick = closeChooser;
    overlay.onclick = e => { if (e.target === overlay) closeChooser(); };
    overlay.querySelectorAll("[data-wa-template]").forEach(btn => {
      btn.onclick = () => {
        const type = btn.dataset.waTemplate;
        const message = type === "inquiry" ? inquiryMessage(d) : type === "paid" ? paidMessage(d) : genericMessage(d);
        openWa(d.phone, message);
      };
    });
  }

  const style = document.createElement("style");
  style.textContent = `
    .wa-template-overlay{position:fixed;inset:0;z-index:1600;display:grid;place-items:center;padding:18px;background:rgba(5,20,38,.68);backdrop-filter:blur(5px)}
    .wa-template-dialog{position:relative;width:min(520px,100%);background:#fff;border-radius:20px;padding:24px 22px 20px;box-shadow:0 30px 90px rgba(0,0,0,.30);border:1px solid rgba(255,255,255,.7)}
    .wa-template-close{position:absolute;right:12px;top:12px;width:34px;height:34px;border:0;border-radius:10px;background:#f1f5f9;color:#34465d;font-weight:800;cursor:pointer}
    .wa-template-kicker{font-size:10px;font-weight:850;letter-spacing:.10em;color:#128c7e;margin-bottom:7px}
    .wa-template-dialog h3{margin:0;color:#10233f;font-size:22px}.wa-template-dialog>p{margin:6px 0 14px;color:#718299;font-size:12px}
    .wa-case-summary{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px;border:1px solid #e6edf5;border-radius:11px;background:#f8fbfe;margin-bottom:12px}.wa-case-summary b{color:#173451}.wa-case-summary span{color:#718299;font-size:11px}.wa-case-summary i{margin-left:auto;font-style:normal;font-size:10px;font-weight:850;padding:4px 7px;border-radius:999px}.wa-case-summary i.inquiry{background:#fff4dc;color:#946500}.wa-case-summary i.paid{background:#e9f8f1;color:#08754f}.wa-case-summary i.neutral{background:#eef2f6;color:#607287}
    .wa-template-choices{display:grid;gap:9px}.wa-template-choice{position:relative;width:100%;display:grid;grid-template-columns:38px 1fr;align-items:center;gap:10px;text-align:left;padding:12px;border:1px solid #e3eaf2;border-radius:12px;background:#fff;cursor:pointer;transition:.15s}.wa-template-choice:hover{border-color:#b9d9cf;background:#f6fcfa;transform:translateY(-1px)}.wa-choice-icon{font-size:21px}.wa-template-choice b{display:block;color:#1c3653;font-size:12px}.wa-template-choice small{display:block;color:#77889d;font-size:10px;margin-top:3px}
    @media(max-width:520px){.wa-template-dialog{padding:22px 15px 16px;border-radius:17px}.wa-template-choice{grid-template-columns:34px 1fr}.wa-case-summary i{margin-left:0}}
  `;
  document.head.appendChild(style);

  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target.closest("#waBtn") : null;
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    showChooser();
  }, true);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && $("waTemplateOverlay")) {
      event.preventDefault();
      closeChooser();
    }
  }, true);
})();
