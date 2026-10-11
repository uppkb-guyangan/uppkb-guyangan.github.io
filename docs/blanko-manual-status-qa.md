# G-Smart — QA & rollback: Blanko manual status

**Scope:** `feature/blanko-manual-status-20261011` only. **Do not merge or deploy without explicit approval.**

## Acceptance checklist (manual, browser/PWA)
- [ ] Desktop: TNKB; Status G-Smart; Lebih Bayar/Pengembalian; Jenis Pelanggaran; Tgl Blanko; No. Telepon (only Admin/Wasatpel); No. Blanko; No. BRIVA; Status Bayar, all visible (horizontal scroll is allowed).
- [ ] The original ETLE status payment badge and its source remain unchanged.
- [ ] Existing search, period picker, reset button, row click, and Detail Perkara continue working.
- [ ] For a case with manual status, list matches **Detail Perkara** category, overpayment, and refund method exactly.
- [ ] For a case without manual status, both new columns show **BELUM DIISI** after successful loading.
- [ ] For a case with only one manual field populated, show the other field as **BELUM DIISI** independently.
- [ ] Both dropdowns filter with AND across all blanko rows in the selected period; selecting `BELUM DIISI` selects only truly empty records.
- [ ] Changing category or overpayment in Detail Perkara updates the list after a successful save, not before.
- [ ] With Supabase status query blocked/failed, the old blanko fields still render and each manual status displays **GAGAL MEMUAT**; status filtering must not misleadingly show incomplete results.
- [ ] With two cases sharing TNKB, manual status is matched by `case_id`, not by the plate.
- [ ] Phone is visible to authorized Admin/Wasatpel only; other roles see no phone column/field.
- [ ] On narrow Android/iOS PWA, each card shows the two statuses plus the original fields including blanko/BRIVA, with no clipped or missing data.
- [ ] Test the refresh button, changing filters, and reopening the page on two different signed-in devices (no realtime expected).
- [ ] Existing FCM notification click still opens G-Smart PWA as before, including when the app is closed.
- [ ] No new console errors, failed asset requests, or stale PWA caches after update.

## Static smoke checks
- Validate `app-v2.js` and `sw.js` JavaScript syntax.
- Check HTML resource versions match `sw.js` precache.
- Compare the feature branch with `main`: only `app-v2.js`, `index.html`, `sw.js`, `blanko-manual-status.css` and this QA document should change.
- Validate that the new status query selects only four fields from `gsmart_case_status` and uses filtered `case_id` batches.
- Ensure existing phone display continues using `rolePermissions().copyPhone`.

## Rollback
**Before merge:** Do not merge; the feature branch is isolated and `main` stays as-is. Deleting the branch after review is optional, and should be explicitly approved.

**If merged in a later session:** Revert the feature changes via a normal Git commit/PR, review service-worker cache revisions, and verify the restored UI and push notifications. No Supabase data rollback is needed because this feature contains no schema/RLS/data migration.

## Known boundaries
- These status filters work on the period-scoped `etle_cases` bundle already loaded by the current app; no new server-side pagination was introduced.
- For much larger blanko datasets, review end-to-end page-render performance and consider server-side pagination separately.
- Existing database RLS settings were not changed. Review edit authorization at the database level separately before expanding write access.
- Browser/PWA acceptance tests need an approved local or staging origin; creating the branch does not publish a live preview.
