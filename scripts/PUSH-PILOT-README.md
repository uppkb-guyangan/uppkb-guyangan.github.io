# G-Smart Push Pilot — Pengujian Terisolasi

Status: TERKUNCI, tanpa jadwal dan tanpa pengiriman otomatis.
Gunakan GitHub Actions workflow G-Smart Push Pilot (Terkunci).

### Sumber ETLE
Blanko: etle_cases.no_blanko.
Sanggahan: etle_disputes berstatus TERSANGGAH, tanpa perkara dihentikan.
JNE: etle_shipping berubah dari status sebelumnya ke Dalam Proses Pengiriman.

### GitHub Secrets — simpan di Settings > Secrets and variables > Actions
SUPABASE_SERVICE_ROLE_KEY: kunci server Supabase, bukan publishable key.
FIREBASE_SERVICE_ACCOUNT_JSON: JSON kredensial akun layanan untuk proyek g-smart-guyangan.
GSMART_PILOT_FCM_TOKEN: token FCM khusus satu HP uji dari Laboratorium Notifikasi.
JANGAN memasukkan secrets ke file GitHub, kode browser, atau percakapan.

### Urutan aktivasi
1. Test (tanpa rahasia): uji logika lokal saja.
2. Inspect: baca data dan perubahan sejak baseline tanpa perubahan database.
3. Baseline: simpan keadaan terkini sebagai titik awal, TANPA pengiriman notifikasi lama; hanya sekali.
4. Ping: kirim tepat SATU pesan tes ke SATU HP yang tokennya disimpan sebagai secret. Tidak membaca atau mengubah data ETLE. Gunakan setelah secret Firebase dan token uji siap.
5. Pilot: sesudah ping berhasil. Maksimal 3 pemberitahuan peristiwa baru ke satu HP per eksekusi manual.
6. Otomatisasi jadwal dan integrasi PWA utama dilakukan hanya setelah uji pengiriman baru berhasil.

### Keamanan
Script tidak menyentuh tabel ETLE (hanya SELECT), Firebase login, kode PWA, atau service worker utama.
Function register-push-token lama yang merespons 410 tidak diubah.
Dua tabel pilot baru dilindungi RLS tanpa kebijakan akses klien anon/authenticated.
Ledger event_key unik; pending diklaim sebagai sending sebelum pengiriman, lalu sent atau failed.
Status sending/failed tidak dicoba lagi otomatis agar tidak menimbulkan pengiriman ganda.
Semua pesan pilot hanya ke satu token secret; tidak memakai topic/broadcast.
Payload tidak memuat identitas pelanggar dan diarahkan ke halaman Lab Notifikasi.

Berkas: supabase/gsmart_push_pilot.sql, scripts/push-pilot.mjs, scripts/push-pilot.test.mjs, .github/workflows/push-pilot.yml.


### Simulasi 3 jenis pemberitahuan (manual)
Pilih mode `simulate` dari GitHub Actions. Script menyiapkan tiga event contoh dalam tabel TERPISAH `gsmart_push_pilot_simulation`:
- G-Smart SIMULASI Blanko Tilang Baru
- G-Smart SIMULASI Pelanggaran Tersanggah
- G-Smart SIMULASI Surat Diproses JNE

Pesan simulasi hanya untuk token HP uji, tanpa membaca / menulis tabel ETLE.
Tiga event_key tetap `gsmart-sim-v1:...` memastikan menjalankan mode simulate lagi menghasilkan nol pesan.
Setiap pengiriman mengklaim event secara atomik dari pending ke sending, lalu sent atau failed.
Jika terjadi kegagalan, event tidak akan dikirim ulang otomatis. Periksa tabel ledger dan log.

Tabel baru khusus simulasi di `supabase/gsmart_push_pilot_simulation.sql` memiliki RLS dan tidak menyediakan akses klien.
Tidak ada cron, penjadwalan otomatis, atau modifikasi G-Smart utama.
