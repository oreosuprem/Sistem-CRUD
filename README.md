# Sistem Informasi Manajemen SDM & Presensi Karyawan
### AERO CORPORATION
**Bidang Usaha**: Teknologi, Bisnis Digital, Manajemen, dan Pengembangan Usaha

Sistem Informasi Manajemen Sumber Daya Manusia (SDM) dan Kehadiran Karyawan terintegrasi berbasis web modern. Dirancang secara responsif untuk mengelola data kepegawaian perusahaan **Aero Corporation** secara terpusat, cepat, aman, dan real-time.

---

## 🌟 Fitur Unggulan Sistem

### 1. Sistem Autentikasi Pengguna (Login & Register)
- **Halaman Login & Register**: Tampilan dark navy profesional dengan motif hexagonal geometric, tab segmented control [Login] [Register], serta validasi data instan.
- **Efek Verifikasi**: Animasi indikator `••• Memverifikasi...` saat proses autentikasi berlangsung.
- **Kredensial Bawaan (Default Administrator)**:
  - **Username / Email**: `admin` atau `admin@aerocorp.co.id`
  - **Password**: `admin`
- **Fitur Lupa Password & Ganti Password**: Petunjuk reset kata sandi serta modal ganti kata sandi langsung dari profil akun.

### 2. Kapsul Widget Samping & Pengaturan Sistem (Gambar 2)
- **Kapsul Widget Vertikal (Blue Capsule Widget)**:
  - **Ikon Roda Gigi (⚙)**: Membuka modal **Pengaturan Sistem & Export Data**.
  - **Badge Status (● ADM)**: Indikator hak akses aktif dengan titik pulsasi hijau.
  - **Ikon Keluar ([→)**: Tombol logout cepat dengan dialog konfirmasi SweetAlert2.
- **Fitur Ekspor CSV Terpusat**:
  - Seluruh fitur ekspor file database (CSV Karyawan & CSV Presensi) kini dipusatkan ke dalam modal Pengaturan Sistem (Settings) yang dibuka melalui widget kapsul ini.

### 3. Header Interaktif & Dropdown Profil Akun (Gambar 3)
- **Lonceng Notifikasi (🔔)**: Dilengkapi titik notifikasi merah (red dot) dan panel dropdown popover yang menampilkan pembaruan kehadiran dan status server real-time.
- **Avatar Pengguna (A)**: Menampilkan kartu profil mengambang (*floating profile card*) dengan detail:
  - Inisial avatar, Nama, Email pengguna.
  - Badge Hak Akses (`ADMIN`) dan Unit Pelaksana (`Aero Corporation - Kantor Pusat`).
  - Menu: *Ganti Kata Sandi*, *Bantuan & Panduan Sistem*, *Pengaturan & Export CSV*, serta *Keluar Akun (Logout)*.

### 4. Manajemen Karyawan Lengkap (Full CRUD)
- **Create (Tambah Karyawan)**: Formulir tambah karyawan lengkap dengan kolom **Nama Panjang**, generator **Auto NIK** standar Aero Corp (`AERO-YYYY-XXX`), dan kolom **Jabatan / Posisi Dinamis** yang otomatis tersaring sesuai departemen yang dipilih.
- **Read (Tampil Data)**: Tabel responsif SaaS style dengan pagination interaktif, custom sorting, dan filter pencarian instan (Ctrl+K shortcut).
- **Update (Edit Data)**: Formulir pembaruan data real-time dengan pratinjau live foto profil.
- **Delete (Hapus Data)**: Penghapusan data aman dilengkapi dialog konfirmasi interaktif SweetAlert2.

### 5. Sistem Presensi & Kios Kehadiran Terintegrasi
- **Kios Absensi Real-Time**:
  - Tombol **Absen Masuk**: Mencatat jam kedatangan secara presisi. Otomatis menandai status `Terlambat` jika check-in melewati pukul **08:30:00 WIB**.
  - Tombol **Absen Pulang**: Mencatat jam kepulangan karyawan dan memvalidasi jika sudah melakukan checkout sebelumnya.
  - Form **Pengajuan Izin / Sakit**: Input cepat untuk karyawan yang berhalangan hadir dengan keterangan resmi.
  - **Catat Presensi Manual (Admin)**: Fasilitas koreksi kehadiran manual oleh HRD/Admin untuk tanggal tertentu.
- **Log & Riwayat Presensi**:
  - Tabel riwayat absensi lengkap dengan filter tanggal, status (*Hadir, Terlambat, Izin, Sakit*), dan pencarian NIK/Nama.

### 6. Kartu Identitas Digital (Digital Corporate Pass)
- Desain kartu ID resmi bertuliskan **AERO CORPORATION** dengan smart chip, barcode, status kepegawaian, dan tombol **Cetak / Print ID Card**.

### 7. Dashboard Statistik & Visualisasi (Chart.js)
- Ringkasan KPI: Total Karyawan, Karyawan Aktif, Sedang Cuti, Program Magang.
- KPI Presensi Hari Ini: Hadir Tepat Waktu, Terlambat, Izin/Sakit, dan Belum Presensi.
- Diagram Donat: Distribusi staf per divisi kerja Aero Corp.
- Diagram Batang: Komposisi status kepegawaian (Tetap, Kontrak, Magang).
- Analisis Payroll: Estimasi total pengeluaran gaji dan rata-rata gaji per staf.

---

## 🛠️ Arsitektur & Teknologi

| Komponen | Teknologi |
| :--- | :--- |
| **Backend Runtime** | [Node.js](https://nodejs.org/) (v18+) |
| **Web Server & REST API** | [Express.js](https://expressjs.com/) |
| **Database Engine** | [SQLite](https://www.sqlite.org/) (Embedded via `node:sqlite`, tanpa server DB luar) |
| **File Upload Handling** | [Multer](https://github.com/expressjs/multer) |
| **Frontend Styling** | HTML5, [Tailwind CSS](https://tailwindcss.com/) (CDN), [Font Awesome](https://fontawesome.com/) 6 |
| **Interaksi & Dialog** | [SweetAlert2](https://sweetalert2.github.io/) |
| **Visualisasi Grafik** | [Chart.js](https://www.chartjs.org/) |

---

## 🚀 Panduan Menjalankan Aplikasi

### Persyaratan Sistem:
- Komputer sudah terinstall **Node.js** (versi 18 atau lebih baru).

### Langkah-langkah:

1. **Buka Terminal / PowerShell** pada folder project:
   ```bash
   cd "c:\Users\ASUS TUF\OneDrive\Dokumen\Aero Magang\Sistem CRUD"
   ```

2. **Jalankan Server**:
   ```bash
   npm start
   ```
   *(Atau untuk mode development dengan auto-reload: `npm run dev`)*

3. **Buka Aplikasi di Browser**:
   Buka peramban (Chrome, Edge, Firefox) dan kunjungi:
   ```text
   http://localhost:3000
   ```

4. **Masuk ke Sistem**:
   - Username: `admin`
   - Password: `admin`

---

## 📡 Dokumentasi Endpoint REST API

### 1. Autentikasi Pengguna
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Masuk ke sistem (username/email + password) |
| `POST` | `/api/auth/register` | Mendaftarkan akun staf/admin baru |
| `POST` | `/api/auth/change-password` | Memperbarui kata sandi pengguna |
| `GET` | `/api/notifications` | Mengambil daftar pemberitahuan & status sistem |

### 2. Data Karyawan
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/karyawan` | Mengambil daftar karyawan (filter departemen, status kerja, kepegawaian, search, sort, pagination) |
| `GET` | `/api/karyawan/:id` | Mengambil detail 1 karyawan berdasarkan ID |
| `POST` | `/api/karyawan` | Menambahkan data karyawan baru (mendukung upload foto `multipart/form-data`) |
| `PUT` | `/api/karyawan/:id` | Memperbarui data karyawan berdasarkan ID |
| `DELETE` | `/api/karyawan/:id` | Menghapus data karyawan beserta foto & catatan absensinya |
| `GET` | `/api/stats` | Mengambil ringkasan data statistik dashboard & payroll |
| `GET` | `/api/export/csv` | Mengunduh rekap database karyawan dalam format CSV (UTF-8 BOM) |

### 3. Presensi & Absensi Karyawan
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/presensi` | Mengambil data riwayat presensi (filter tanggal, status, search, pagination) |
| `GET` | `/api/presensi/today` | Mengambil ringkasan metrik presensi hari ini |
| `POST` | `/api/presensi/masuk` | Mencatat absen masuk (otomatis terlambat setelah 08:30) |
| `POST` | `/api/presensi/pulang` | Mencatat absen pulang karyawan |
| `POST` | `/api/presensi/manual` | Input presensi manual / izin / sakit oleh admin |
| `DELETE` | `/api/presensi/:id` | Menghapus log catatan presensi |
| `GET` | `/api/export/presensi/csv` | Mengunduh data rekapitulasi presensi dalam format CSV |

---

## 📝 Profil Perusahaan
&copy; 2026 **Aero Corporation** - Sistem Informasi Manajemen SDM & Presensi.  
*Bidang Usaha: Teknologi, Bisnis Digital, Manajemen, dan Pengembangan Usaha.*
