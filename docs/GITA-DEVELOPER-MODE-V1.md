# GITA Developer Mode V1

Status: implementasi di `feature/gita-developer-mode-v1`, Draft PR #33. **Belum aktif di produksi.** Tidak ada merge, deployment, perubahan Firebase, atau perubahan skema/RLS produksi.

## Perilaku yang tersedia dalam kode

1. Ketik `GITA, audit seluruh aplikasi`, `GITA, perbaiki bug filter Persidangan`, atau `GITA, perbaiki bug simulasi` di GITA.
2. GITA menampilkan tindakan dan pilihan modul. Pengguna mengonfirmasi dengan tombol Jalankan. Batal tidak mengirim pekerjaan.
3. UI mengambil Firebase ID token dari sesi aplikasi aktif, tanpa menyimpan token atau password. Mode demo tidak mendapat sesi Developer Mode.
4. `gita-maintenance` memverifikasi tanda tangan RS256 dengan public JWK Google, audience, issuer, expiry, iat, auth_time; memeriksa akun lewat Identity Toolkit termasuk disabled/revocation; membaca profil Firestore terbaru. Harus `aktif === true`, role ADMIN/WASATPEL, serta UID terdaftar pada allowlist server.
5. Backend memvalidasi schema tertutup (action, scope, request UUID, confirmed), mencatat antrean lewat RPC service-only, kemudian memicu workflow pada ref pengembangan yang tetap.
6. Runner meminta usulan perubahan terbatas dari Gemini, tanpa alat shell/network/database untuk AI. Proposal maksimal tiga edit exact-match; hanya file JS/modul frontend dalam allowlist. Tidak boleh mengubah backend otorisasi, workflow, konfigurasi, test, atau secrets. URL eksternal baru dan pola kredensial ditolak.
7. Job terpisah menerapkan usulan dan menjalankan seluruh tes di container tanpa jaringan, tanpa secrets, filesystem read-only, CPU/memori/proses dibatasi.
8. Hanya jika tes berhasil, publisher tepercaya mendapat GITHUB_TOKEN write. Publisher membuat ref baru `gita/dev/<UUID>` dan **draft** PR ke branch pengembangan. Tidak memiliki jalur kode untuk merge/deployment. AI tidak menerima token penerbit.
9. Tombol Periksa status mengambil keadaan nyata workflow dan tautan draft PR melalui backend. Tidak ada polling latar belakang atau cron.

AI hanya melihat source/excerpt yang dipilih. `config.js`, data Supabase, bukti, foto, log perkara, UID, token Firebase, dan teks bebas perintah tidak dikirim ke coding agent. Fixture demo dalam app-v2, key publik, JWT, dan email disensor dari snapshot. Review manusia tetap wajib: pembatas proposal dan tes bukan jaminan bahwa kode usulan aman/benar.

## Cakupan dan batas V1

- Modul: aplikasi, GITA, PWA, Blanko, Persidangan, Analitik, simulasi.
- Audit AI dibatasi total 100.000 karakter source, dengan penanda cuplikan untuk file besar. Bukan audit menyeluruh semua source. Semua tes regresi tetap dijalankan.
- Satu panggilan model per pekerjaan, maksimal output 6.000 token, tanpa loop perbaikan tanpa batas.
- Tiga permintaan per UID per 24 jam, sepuluh global per 24 jam, jeda minimal 60 detik; pencatatan/kuota atomik memakai advisory transaction lock PostgreSQL.
- UUID idempoten: pengiriman ulang tidak membuat workflow kedua. Timeout dispatch ditandai tidak pasti dan **tidak dicoba ulang otomatis**; periksa GitHub sebelum membuat permintaan baru.
- Metadata antrean hanya UID, UUID, tindakan, modul, waktu, status dispatch. Tidak berisi isi perintah/perkara. Hanya service role dapat mengaksesnya. Retensi manual disarankan 30 hari; artefak source/proposal 3 hari.
- Status mencari 100 run terbaru workflow. Job lama di luar jangkauan perlu diperiksa langsung melalui GitHub; UI tidak menyimpan riwayat antar-reload.
- PR perbaikan menargetkan branch pengembangan; persetujuan hasil perbaikan tidak berarti izin mengubah produksi.

## Perbaikan autentikasi GITA lama

Snapshot source `gita-agent` v9 diambil baca-saja dari Supabase pada 16 Oktober 2026 dan disimpan sebagai source versioned, tanpa secrets. Source lama memakai service role dan tidak memverifikasi identitas pemanggil di handler.

Perubahan yang disiapkan:
- UI mengganti Authorization kunci publik menjadi Firebase ID token.
- Backend memakai authorizer Firebase yang sama, profil harus aktif.
- Database client memakai anon key + token pengguna, sehingga query tunduk pada RLS; tidak lagi memakai service role.
- Pencarian BRIVA, field status_bayar/no_briva, serta lookup pembayaran dibatasi ADMIN/WASATPEL di server.
- Origin dibatasi dan respons no-store. Error internal tidak dikirim ke pengguna.
- GITA data dan avatar tetap tersedia; modul developer dimuat hanya setelah perintah teknis. Cache/version frontend diperbarui bersama.

**Perbaikan ini belum melindungi endpoint produksi sampai deployment yang disetujui.** Sebelum aktivasi, uji seluruh fungsi tanya data dengan Firebase/RLS pada staging. RLS produksi hanya diperiksa lewat metadata baca-saja; tidak diubah. Field otorisasi `users.role` dan `users.aktif` harus tidak dapat diedit sendiri oleh petugas biasa; aturan Firestore ini belum diaudit di sesi ini.

## Konfigurasi aman yang diperlukan

Jangan menempelkan nilai secret di chat, kode, config.js, URL, atau log.

### GitHub

Atur di Repository Settings → Secrets and variables → Actions:

| Jenis | Nama | Kegunaan |
|---|---|---|
| Secret | `GITA_AI_API_KEY` | API key Gemini khusus coding, terpisah dari GITA data/ETLE. Batasi kuota/billing di penyedia. |
| Variable | `GITA_AI_MODEL` | ID model Gemini yang tersedia di akun dan mendukung generateContent + JSON structured output. Tidak ada default tersembunyi. |

Workflow menggunakan GITHUB_TOKEN bawaan hanya pada job penerbit (contents write, pull-requests write). Repo harus mengizinkan Actions membuat PR. Jangan berikan Firebase Admin, Supabase service role, kredensial ETLE, atau push/FCM secrets ke workflow developer.

### Supabase staging — Edge Function Secrets

| Nama | Nilai/kegunaan |
|---|---|
| `GITA_FIREBASE_PROJECT_ID` | ID proyek Firebase yang dipercaya. |
| `GITA_FIREBASE_WEB_API_KEY` | Web API key Firebase proyek yang sama; bukan Firebase Admin private key. |
| `GITA_DEVELOPER_UIDS` | UID yang boleh menjalankan developer mode, dipisahkan koma. Role tetap diverifikasi dari Firestore. |
| `GITA_GITHUB_DISPATCH_TOKEN` | Fine-grained token khusus repo ini: Actions write, Contents read, Pull requests read; masa berlaku pendek. |
| `GITA_DEVELOPER_ENABLED` | `false` sampai konfigurasi dan uji staging selesai; `true` untuk aktivasi yang disetujui. |
| `GITA_ALLOWED_ORIGIN` | Origin frontend staging yang dipercaya; default origin G-Smart. |

SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY disediakan runtime. Service role **hanya** dipakai endpoint maintenance untuk metadata/kuota, tidak diberikan ke agent. Frontend staging harus menunjuk proyek staging; jangan mengubah config.js produksi.

`supabase/config.toml` menonaktifkan pemeriksaan JWT legacy gateway pada kedua fungsi karena Firebase token diverifikasi **di dalam handler**. Ini tidak menjadikan handler anonim. Jangan deploy file index tanpa authorizer `_shared/gita-auth.mjs`.

## Aktivasi yang masih tertahan

1. Daftarkan workflow pada default branch atau siapkan repository staging terisolasi yang disesuaikan. GitHub mensyaratkan workflow_dispatch berada pada default branch; file yang hanya di branch feature belum dapat dipanggil live. **Tidak boleh menulis main untuk bootstrap tanpa izin**, karena push main juga dapat memicu hosting Pages.
2. Siapkan secrets/model/UID lewat pengaturan aman di atas. Nilai secret tidak dapat diperiksa dari connector; keberadaannya belum diverifikasi.
3. Jalankan SQL `supabase/gita_developer_jobs.sql` di proyek staging, kemudian deploy kedua fungsi beserta `_shared` ke staging. File SQL ini belum diterapkan ke layanan mana pun.
4. Uji Firebase nyata: Admin, Wasatpel, USER, nonaktif, revoked, origin salah, retry/kuota. Uji normal GITA data agar RLS tidak menghilangkan fitur sah.
5. Dari UI staging, jalankan perbaikan simulasi memakai model nyata. Verifikasi run GitHub, tes gagal sebelum perbaikan/lulus sesudahnya, draft PR nyata, dan status UI.
6. Review perubahan dan rencana rollback sebelum meminta persetujuan aktivasi produksi.

Metadata GitHub yang dibaca pada sesi ini menunjukkan main belum dilindungi (`protected:false`). Sebelum aktivasi, pemilik perlu menetapkan branch protection/ruleset (PR wajib, status checks, larangan bypass). Sesi ini tidak mengubah pengaturan repo.

## Simulasi

Fixture `scripts/fixtures/gita-simulation.mjs` tidak terhubung aplikasi atau database. Runner menyuntikkan regresi normalisasi hanya ke workspace job dan membuktikan tes gagal. Model diminta memperbaiki trim/uppercase/null, lalu tes yang sama harus lulus.

Untuk draft simulasi, publisher membuat baseline rusak di `gita/simulation/<UUID>` dan menargetkan draft `gita/dev/<UUID>` ke baseline tersebut. Hal ini memberi diff perbaikan nyata tanpa memasukkan bug ke feature/main. Status backend mengenali target simulasi ini. Jangan merge PR simulasi ke branch aplikasi.

## Bukti pengujian sesi ini

- `node --test scripts/*.test.mjs`: **122 lulus, 0 gagal**.
- Uji end-to-end terisolasi: tanda tangan RSA sungguhan dengan key test, Firebase/Firestore tiruan, dispatch tiruan, API Gemini tiruan yang memproduksi proposal, regresi gagal/lulus, publisher Git Data/draft PR tiruan, dan status UI/backend. Tidak diklaim sebagai panggilan layanan live.
- SQL dijalankan pada PostgreSQL lokal (PGlite 0.3.14): schema berhasil, service-only ACL, anon/authenticated ditolak, idempotency, conflict, cooldown, dan kuota per UID terverifikasi.
- UI DOM (jsdom 26.1.0, dependency hanya di scratch): alur GITA biasa, Firebase header, konfirmasi, payload tanpa pertanyaan/perkara, status/draft link, USER ditolak, Wasatpel dapat membatalkan. Belum ada verifikasi visual desktop/ponsel: unduhan Chromium lingkungan gagal.
- Deno 2.9.6: backend maintenance dan source gita-agent diperiksa tipe, dependency Supabase JS 2.95.3 dipin. Source data assistant mempertahankan tool lama; paritas data live masih wajib diuji di staging.
- Syntax frontend dan `git diff --check` lulus.

Tidak ada pemanggilan model berbayar, workflow developer live, draft PR hasil model live, deployment Supabase, perubahan data perkara, merge, atau deployment produksi dalam pengujian ini.

## Rollback setelah aktivasi yang kelak disetujui

Matikan `GITA_DEVELOPER_ENABLED` untuk menutup start/status developer (fail closed), cabut dispatch token bila perlu, dan hentikan run lewat GitHub. Tutup draft/branch perbaikan yang belum ditinjau. Rollback kode frontend/Edge Function harus melalui commit/deployment yang disetujui; jangan mengembalikan autentikasi GITA ke handler anonim. Produksi saat ini tidak membutuhkan rollback karena belum diubah.
