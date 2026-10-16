/**
 * GITA Developer Mode — command intent detector ONLY.
 * No database/GitHub access or side effects.
 * A backend must validate role, session, scope, and confirmation.
 */
const START = /^(?:gita[\s,.:!?-]*)?/i;
const FIX = /^(?:tolong\s+)?(?:perbaiki|betulkan|fix|debug)\s+(?:bug|error|kode|aplikasi|g-?smart|filter|tampilan|menu|fitur|notifikasi|foto|loading|pwa)\b/i;
const AUDIT = /^(?:tolong\s+)?(?:audit|cek|cari|periksa|telusuri)\s+(?:(?:semua|seluruh)\s+)?(?:bug|error|kesalahan|kode|aplikasi|g-?smart)\b/i;
const PREFIX = /^\/dev(?:\s+|$)/i;

export function detectGitaMaintenanceIntent(message) {
  if (typeof message !== "string") return null;
  const clean = message.trim();
  if (!clean || clean.length > 400) return null;
  const body = clean.replace(START, "").trim();
  let action = null;
  if (PREFIX.test(body)) action = /\b(?:perbaiki|fix|debug)\b/i.test(body) ? "fix" : "audit";
  else if (FIX.test(body)) action = "fix";
  else if (AUDIT.test(body)) action = "audit";
  if (!action) return null;
  return {category:"developer-maintenance",action,request:clean,requiresConfirmation:true};
}
