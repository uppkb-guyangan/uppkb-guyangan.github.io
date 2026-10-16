# GITA Developer Mode V1 — integrasi atas perintah

Status: **scaffold dan desain di branch uji; BELUM aktif di aplikasi produksi.**

## Tujuan
Petugas berwenang dapat berkata "GITA, audit seluruh aplikasi" atau "GITA, perbaiki bug filter Persidangan" dari PWA G-Smart. GITA meneruskan pekerjaan ke agen pengembangan di GitHub, memeriksa hasil tes, lalu menampilkan tautan draft Pull Request tanpa menggabungkan atau men-deploy kode.

## Fakta arsitektur yang telah diperiksa
- GITA saat ini: gita-avatar.js → gita-agent-ui.js → Supabase Edge Function gita-agent.
- Fungsi saat ini melayani pertanyaan dan data ETLE; bukan alat perbaikan kode.
- Sesi pengguna memakai Firebase Auth; profil dan role aktif diperiksa dari Firebase Firestore pada frontend.
- Hosting PWA ada di GitHub Pages, repository uppkb-guyangan/uppkb-guyangan.github.io.

## Rangkaian implementasi yang harus diselesaikan
1. Frontend GITA mengenali perintah teknis dengan gita-maintenance-intent.mjs dan meminta konfirmasi pengguna. Pesan ETLE biasa tetap menuju asisten data.
2. Frontend memperoleh Firebase ID token pengguna yang sedang login, mengirim ke endpoint gita-maintenance terpisah (belum ada).
3. Endpoint harus memverifikasi JWT Firebase secara kriptografis, issuer, audience, expiry, identitas aktif, serta otorisasi pengguna server-side. Untuk versi pertama, gunakan allowlist UID pemilik proyek sebagai lapis tambahan. Jangan pernah percaya role yang dikirim browser.
4. Backend memberlakukan rate limit dan pencatatan audit minimum, lalu menggunakan kredensial GitHub rahasia di SERVER untuk menjalankan workflow_dispatch on-demand (bukan cron).
5. GitHub Actions menjalankan pemeriksaan pada salinan kode yang terisolasi, menggunakan data sintetis, lalu mengizinkan agen coding membuat perubahan hanya di branch perbaikan, menguji, dan menyiapkan DRAFT Pull Request untuk review manusia.
6. GITA menampilkan status dan URL hasil pekerjaan; tidak boleh menyatakan sukses sebelum mendapat status nyata dari GitHub.
7. Branch main dilindungi: tidak ada auto-merge, auto-deploy, bypass RLS, penulisan ke data ETLE, atau modifikasi Firebase/Supabase produksi.

## Batasan keamanan
- Jangan mengaktifkan fitur bertindak sebelum audit autentikasi dan otorisasi GITA selesai.
- Jangan pernah mengekspos token GitHub, API key AI, Firebase Admin, atau service role di web publik, kode, log, ataupun URL.
- Runner AI tidak boleh menerima akses atau secrets sistem operasional ETLE dan tidak boleh mengeksekusi perubahan database produksi.
- Batasi cakupan file yang boleh diubah, izin GitHub, biaya model, jumlah permintaan, durasi pekerjaan, dan kuota harian.
- Perintah memperbaiki != izin menggabungkan kode ke main.
- Jangan menampilkan data kedinasan pada preview publik.

## Kode awal yang ada pada branch ini
- gita-maintenance-intent.mjs: detektor perintah audit/fix tanpa efek samping.
- scripts/gita-maintenance-intent.test.mjs: uji pengenalan perintah dan pencegahan salah rute.

## Belum selesai (harus diselesaikan sebelum dipakai)
- Integrasi tampilan GITA dan tombol persetujuan.
- Backend yang memverifikasi identitas dan memicu GitHub.
- Workflow coding-agent serta konfigurasi API key AI di secrets.
- Monitoring status, audit log, pengujian end-to-end, dan pemeriksaan keamanan.
- Review, persetujuan, serta aktivasi.

PENTING: File ini adalah spesifikasi kerja. Tidak boleh diklaim sebagai sistem auto-fix yang sudah berjalan.
