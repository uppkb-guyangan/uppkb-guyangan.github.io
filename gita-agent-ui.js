import { supabaseConfig } from "./config.js?v=20261002-3";

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (m) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

function renderAnswer(text) {
  return esc(text)
    .replace(/^### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^## (.+)$/gm, "<h3>$1</h3>")
    .replace(/^# (.+)$/gm, "<h2>$1</h2>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/^---$/gm, "<hr>")
    .replace(/^\* (.+)$/gm, "• $1")
    .replace(/^- (.+)$/gm, "• $1")
    .replace(/\n/g, "<br>");
}

async function askGita(question) {
  const out = $("commandPaletteResults");
  const input = $("commandPaletteInput");
  const q = String(question || "").trim();
  if (!out || !q) return;

  if (input) input.value = q;
  out.innerHTML = '<div class="assistant-thinking"><span>✦</span> GITA sedang menganalisis data G-Smart…</div>';
  window.setGitaState?.("thinking");

  try {
    const key = supabaseConfig.publishableKey || supabaseConfig.anonKey;
    const response = await fetch(`${supabaseConfig.url}/functions/v1/gita-agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": key,
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({ question: q })
    });

    let result = null;
    try { result = await response.json(); } catch (_) {}

    if (!response.ok || !result?.success) {
      throw new Error(result?.detail || result?.error || `GITA gagal merespons (HTTP ${response.status}).`);
    }

    const answer = String(result.answer || "GITA belum menghasilkan jawaban.").trim();
    out.innerHTML =
      '<div class="cp-section-label cp-ai-label">✦ GITA <span>read-only</span></div>' +
      '<div class="assistant-answer">' +
        '<b>GITA</b>' +
        '<p style="white-space:normal;line-height:1.65">' + renderAnswer(answer) + '</p>' +
      '</div>';
    window.setGitaState?.("talking");
  } catch (error) {
    console.error("GITA Agent error:", error);
    out.innerHTML =
      '<div class="cp-section-label cp-ai-label">✦ GITA <span>read-only</span></div>' +
      '<div class="assistant-answer assistant-help">' +
        '<b>GITA sedang tidak dapat merespons.</b>' +
        '<p>' + esc(error?.message || error) + '</p>' +
        '<p>Silakan coba kembali beberapa saat lagi.</p>' +
      '</div>';
    window.setGitaState?.("idle");
  }
}

// Quick Question: pertahankan UI lama, tetapi arahkan jawabannya ke gita-agent v3.1.
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-ai-prompt]");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  askGita(button.dataset.aiPrompt || "");
}, true);

// Pertanyaan bebas: ketika hasil palette menawarkan "Tanya Asisten", Enter memakai GITA Agent.
document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  const input = event.target.closest?.("#commandPaletteInput");
  if (!input) return;
  const palette = $("commandPalette");
  if (!palette || palette.classList.contains("hidden")) return;
  if (!document.querySelector("#commandPaletteResults .cp-ai-run")) return;
  const q = String(input.value || "").trim();
  if (!q) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  askGita(q);
}, true);

window.askGitaAgent = askGita;
