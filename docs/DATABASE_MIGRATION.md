# Panduan Arsitektur & Migrasi Database: SQLite ke PostgreSQL / Supabase
**Aero Corporation - Human Resources Information System (HRIS)**

Dokumen ini memandu langkah demi langkah peningkatan arsitektur database dari **SQLite** bawaan ke **PostgreSQL / Supabase** untuk mendukung skalabilitas multi-pengguna dan konkurensi tinggi.

---

## 1. Perbandingan Arsitektur

| Kriteria | SQLite (Bawaan Saat Ini) | PostgreSQL / Supabase |
| :--- | :--- | :--- |
| **Karakteristik** | Serverless, *Single-file* (`data/karyawan.db`) | Client-Server RDBMS, Cloud Hosted |
| **Konkurensi** | Cocok untuk 1 - 20 pengguna bersamaan | Ribuan pengguna bersamaan (*High Concurrency*) |
| **Absensi Jam Sibuk** | *Table-level lock* saat write banyak | *Row-level lock*, sangat cepat saat jam 08:00 WIB |
| **Backup** | Salin berkas `karyawan.db` | *Point-in-time recovery*, replikasi cloud |
| **Setup** | Tanpa instalasi tambahan | Butuh koneksi URL / credentials server |

---

## 2. Langkah Migrasi Otomatis (One-Command Migration)

Kami telah menyediakan skrip migrasi siap pakai: [`scripts/migrate-to-postgres.js`](../scripts/migrate-to-postgres.js).

### Langkah 1: Siapkan Database PostgreSQL / Supabase
1. Buat proyek baru di [Supabase.com](https://supabase.com) atau gunakan PostgreSQL lokal/VPS.
2. Dapatkan *Connection String (URI)*, contoh:
   ```text
   postgresql://postgres:[PASSWORD]@db.xxxxxx.supabase.co:5432/postgres
   ```

### Langkah 2: Pasang Driver PostgreSQL
Jalankan di terminal proyek:
```bash
npm install pg
```

### Langkah 3: Jalankan Skrip Migrasi
Di PowerShell / Command Prompt:
```powershell
$env:DATABASE_URL="postgresql://postgres:password_kamu@db.xxxxxx.supabase.co:5432/postgres"
node scripts/migrate-to-postgres.js
```

Skrip ini akan secara otomatis:
1. Membaca seluruh data yang ada di `data/karyawan.db` (akun pengguna, profil karyawan, foto, presensi geofencing, titik kantor, dan audit logs).
2. Membuat tabel-tabel di PostgreSQL dengan tipe data yang setara.
3. Memindahkan seluruh data ke PostgreSQL dengan transaksi aman (`BEGIN` - `COMMIT`).

---

## 3. Menghubungkan Backend ke PostgreSQL

Setelah data dimigrasikan, backend Express dapat langsung dialihkan ke PostgreSQL dengan mengonfigurasi pool koneksi `pg` saat variabel `process.env.DATABASE_URL` terdeteksi.
