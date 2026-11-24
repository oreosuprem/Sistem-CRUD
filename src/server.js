const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup upload directory
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'karyawan-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mime = allowedTypes.test(file.mimetype);
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar (JPG, PNG, WebP) yang diperbolehkan!'));
    }
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ================= AUTHENTICATION ENDPOINTS ================= //
// POST /api/auth/login (Support 2 Hak Akses: ADMIN & KARYAWAN)
app.post('/api/auth/login', (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;
    if (!usernameOrEmail || !password) {
      return res.status(400).json({ success: false, message: 'Username/Email dan Password wajib diisi!' });
    }

    const trimmedIdentifier = String(usernameOrEmail).trim();
    const cleanPassword = String(password).trim();

    // 1. Cek Admin di tabel users
    const user = db.prepare(`
      SELECT id, username, email, password, nama, role, unit 
      FROM users 
      WHERE (LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?))
    `).get(trimmedIdentifier, trimmedIdentifier);

    if (user && user.password === cleanPassword) {
      return res.json({
        success: true,
        message: 'Login berhasil! Mengalihkan ke dashboard Administrator...',
        data: {
          id: user.id,
          username: user.username,
          email: user.email,
          nama: user.nama,
          role: 'ADMIN',
          unit: user.unit || 'Aero Corporation - Kantor Pusat'
        }
      });
    }

    // 2. Cek Karyawan di tabel karyawan
    // Login akun karyawan: email resmi, password: ID Card karyawan (misal: AC0001, AC0003)
    const karyawan = db.prepare(`
      SELECT id, nik, nama, email, departemen, jabatan, status_kerja, status_kepegawaian, foto
      FROM karyawan
      WHERE LOWER(email) = LOWER(?) 
         OR LOWER(REPLACE(email, '@neyradigital.co.id', '@aerocorp.co.id')) = LOWER(?)
         OR LOWER(REPLACE(email, '@aerocorp.co.id', '@neyradigital.co.id')) = LOWER(?)
         OR UPPER(nik) = UPPER(?)
    `).get(trimmedIdentifier, trimmedIdentifier, trimmedIdentifier, trimmedIdentifier);

    if (karyawan) {
      // Password karyawan dicocokkan dengan ID Card (case-insensitive)
      if (karyawan.nik.trim().toUpperCase() === cleanPassword.toUpperCase()) {
        if (karyawan.status_kerja === 'Nonaktif') {
          return res.status(403).json({
            success: false,
            message: 'Status kepegawaian Anda Nonaktif. Silakan hubungi bagian HR.'
          });
        }

        return res.json({
          success: true,
          message: `Login berhasil! Selamat datang, ${karyawan.nama}...`,
          data: {
            id: karyawan.id,
            karyawan_id: karyawan.id,
            username: karyawan.nik,
            email: karyawan.email,
            nama: karyawan.nama,
            nik: karyawan.nik,
            role: 'KARYAWAN',
            departemen: karyawan.departemen,
            jabatan: karyawan.jabatan,
            foto: karyawan.foto,
            unit: 'Aero Corporation - ' + (karyawan.departemen || 'Kantor Pusat')
          }
        });
      }
    }

    return res.status(401).json({
      success: false,
      message: 'Email atau Password (ID Card) salah! Pastikan menggunakan email resmi terdaftar dan password berupa ID Card (contoh: AC0001).'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/auth/register
app.post('/api/auth/register', (req, res) => {
  try {
    const { username, email, password, nama } = req.body;
    if (!username || !email || !password || !nama) {
      return res.status(400).json({ success: false, message: 'Semua kolom registrasi wajib diisi!' });
    }

    const trimmedUsername = String(username).trim().toLowerCase();
    const trimmedEmail = String(email).trim().toLowerCase();

    // Check duplicate
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?').get(trimmedUsername, trimmedEmail);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Username atau Email sudah terdaftar!' });
    }

    db.prepare(`
      INSERT INTO users (username, email, password, nama, role, unit)
      VALUES (?, ?, ?, ?, 'ADMIN', 'Aero Corporation - Kantor Pusat')
    `).run(trimmedUsername, trimmedEmail, password, String(nama).trim());

    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil! Silakan masuk dengan akun Anda.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/auth/change-password
app.post('/api/auth/change-password', (req, res) => {
  try {
    const { userId, oldPassword, newPassword } = req.body;
    if (!userId || !oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Semua kolom wajib diisi!' });
    }

    const user = db.prepare('SELECT id, password FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan!' });
    }

    if (user.password !== oldPassword) {
      return res.status(400).json({ success: false, message: 'Kata sandi saat ini tidak cocok!' });
    }

    db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newPassword, userId);

    res.json({ success: true, message: 'Kata sandi berhasil diperbarui!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/notifications
app.get('/api/notifications', (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const presensiCount = db.prepare('SELECT COUNT(*) as count FROM presensi WHERE tanggal = ?').get(today);
    const totalKaryawan = db.prepare("SELECT COUNT(*) as count FROM karyawan WHERE status_kerja = 'Aktif'").get();

    const notifications = [
      {
        id: 1,
        title: 'Presensi Hari Ini',
        time: 'Real-time',
        desc: `${presensiCount.count} dari ${totalKaryawan.count} karyawan aktif telah mencatat presensi hari ini.`,
        icon: 'fa-clipboard-check',
        color: 'text-emerald-500 bg-emerald-50'
      },
      {
        id: 2,
        title: 'Sistem Terhubung',
        time: 'Aktif',
        desc: 'Database SQLite dan server REST API Aero Corp beroperasi optimal.',
        icon: 'fa-server',
        color: 'text-blue-500 bg-blue-50'
      },
      {
        id: 3,
        title: 'Pemberitahuan Ekspor',
        time: 'Info',
        desc: 'Fitur ekspor CSV kini dipusatkan di menu Pengaturan Sistem (⚙).',
        icon: 'fa-gear',
        color: 'text-purple-500 bg-purple-50'
      }
    ];

    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Get Statistics Dashboard
app.get('/api/stats', (req, res) => {
  try {
    const totalRow = db.prepare('SELECT COUNT(*) as total FROM karyawan').get();
    const aktifRow = db.prepare("SELECT COUNT(*) as total FROM karyawan WHERE status_kerja = 'Aktif'").get();
    const cutiRow = db.prepare("SELECT COUNT(*) as total FROM karyawan WHERE status_kerja = 'Cuti'").get();
    const nonaktifRow = db.prepare("SELECT COUNT(*) as total FROM karyawan WHERE status_kerja = 'Nonaktif'").get();
    const magangRow = db.prepare("SELECT COUNT(*) as total FROM karyawan WHERE status_kepegawaian = 'Magang'").get();
    const payrollRow = db.prepare("SELECT SUM(gaji) as total_gaji, AVG(gaji) as avg_gaji FROM karyawan WHERE status_kerja = 'Aktif'").get();

    const deptRows = db.prepare(`
      SELECT departemen, COUNT(*) as count 
      FROM karyawan 
      GROUP BY departemen 
      ORDER BY count DESC
    `).all();

    const statusRows = db.prepare(`
      SELECT status_kepegawaian, COUNT(*) as count 
      FROM karyawan 
      GROUP BY status_kepegawaian
    `).all();

    res.json({
      success: true,
      data: {
        totalKaryawan: totalRow.total,
        karyawanAktif: aktifRow.total,
        karyawanCuti: cutiRow.total,
        karyawanNonaktif: nonaktifRow.total,
        karyawanMagang: magangRow.total,
        totalGaji: payrollRow.total_gaji || 0,
        avgGaji: Math.round(payrollRow.avg_gaji || 0),
        departemenDistribusi: deptRows,
        statusDistribusi: statusRows
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Get Employees (with search, filter, sorting, pagination)
app.get('/api/karyawan', (req, res) => {
  try {
    const {
      search = '',
      departemen = '',
      status_kerja = '',
      status_kepegawaian = '',
      sort_by = 'created_at',
      order = 'DESC',
      page = 1,
      limit = 10
    } = req.query;

    const conditions = [];
    const params = [];

    if (search.trim()) {
      conditions.push('(nik LIKE ? OR nama LIKE ? OR email LIKE ? OR jabatan LIKE ?)');
      const s = `%${search.trim()}%`;
      params.push(s, s, s, s);
    }

    if (departemen) {
      conditions.push('departemen = ?');
      params.push(departemen);
    }

    if (status_kerja) {
      conditions.push('status_kerja = ?');
      params.push(status_kerja);
    }

    if (status_kepegawaian) {
      conditions.push('status_kepegawaian = ?');
      params.push(status_kepegawaian);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Validate sort column
    const allowedSort = ['id', 'nik', 'nama', 'email', 'departemen', 'jabatan', 'tanggal_masuk', 'gaji', 'created_at'];
    const safeSort = allowedSort.includes(sort_by) ? sort_by : 'created_at';
    const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Count total filtered
    const countSql = `SELECT COUNT(*) as total FROM karyawan ${whereClause}`;
    const totalFiltered = db.prepare(countSql).get(...params).total;

    let items = [];
    let totalPages = 1;

    if (limit === 'all') {
      const sql = `SELECT * FROM karyawan ${whereClause} ORDER BY ${safeSort} ${safeOrder}`;
      items = db.prepare(sql).all(...params);
      totalPages = 1;
    } else {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit, 10) || 10);
      const offset = (pageNum - 1) * limitNum;
      totalPages = Math.ceil(totalFiltered / limitNum) || 1;

      const sql = `SELECT * FROM karyawan ${whereClause} ORDER BY ${safeSort} ${safeOrder} LIMIT ? OFFSET ?`;
      items = db.prepare(sql).all(...params, limitNum, offset);
    }

    res.json({
      success: true,
      data: items,
      pagination: {
        page: parseInt(page, 10) || 1,
        limit: limit === 'all' ? totalFiltered : parseInt(limit, 10) || 10,
        totalItems: totalFiltered,
        totalPages: totalPages
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Generate Next ID Card (AC0001, AC0002, ...)
app.get('/api/karyawan/next-id', (req, res) => {
  try {
    const rows = db.prepare("SELECT nik FROM karyawan WHERE nik LIKE 'AC%'").all();
    let maxNum = 0;
    rows.forEach(r => {
      const match = r.nik.match(/^AC(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    const nextId = 'AC' + String(maxNum + 1).padStart(4, '0');
    res.json({ success: true, data: { nextId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Get Employee by ID
app.get('/api/karyawan/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM karyawan WHERE id = ?').get(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Data karyawan tidak ditemukan.' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Create Employee
app.post('/api/karyawan', upload.single('foto'), (req, res) => {
  try {
    const {
      nik,
      nama,
      email,
      telepon,
      jenis_kelamin,
      departemen,
      jabatan,
      status_kepegawaian,
      status_kerja = 'Aktif',
      tanggal_masuk,
      gaji = 0,
      alamat = ''
    } = req.body;

    if (!nik || !nama || !email || !telepon || !departemen || !jabatan || !status_kepegawaian || !tanggal_masuk) {
      return res.status(400).json({
        success: false,
        message: 'Mohon lengkapi seluruh field wajib (NIK, Nama, Email, Telepon, Departemen, Jabatan, Status, Tanggal Masuk)!'
      });
    }

    // Check unique NIK
    const existing = db.prepare('SELECT id FROM karyawan WHERE nik = ?').get(nik.trim());
    if (existing) {
      return res.status(400).json({ success: false, message: `NIK '${nik}' sudah terdaftar dalam sistem!` });
    }

    const foto = req.file ? req.file.filename : '';

    const stmt = db.prepare(`
      INSERT INTO karyawan (
        nik, nama, email, telepon, jenis_kelamin, departemen, jabatan,
        status_kepegawaian, status_kerja, tanggal_masuk, gaji, alamat, foto
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      nik.trim(),
      nama.trim(),
      email.trim(),
      telepon.trim(),
      jenis_kelamin || 'Laki-laki',
      departemen,
      jabatan.trim(),
      status_kepegawaian,
      status_kerja,
      tanggal_masuk,
      parseFloat(gaji) || 0,
      alamat ? alamat.trim() : '',
      foto
    );

    const newKaryawan = db.prepare('SELECT * FROM karyawan WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      message: 'Data karyawan berhasil ditambahkan!',
      data: newKaryawan
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Update Employee
app.put('/api/karyawan/:id', upload.single('foto'), (req, res) => {
  try {
    const current = db.prepare('SELECT * FROM karyawan WHERE id = ?').get(req.params.id);
    if (!current) {
      return res.status(404).json({ success: false, message: 'Data karyawan tidak ditemukan.' });
    }

    const {
      nik,
      nama,
      email,
      telepon,
      jenis_kelamin,
      departemen,
      jabatan,
      status_kepegawaian,
      status_kerja,
      tanggal_masuk,
      gaji,
      alamat
    } = req.body;

    if (!nik || !nama || !email || !telepon || !departemen || !jabatan || !status_kepegawaian || !tanggal_masuk) {
      return res.status(400).json({
        success: false,
        message: 'Mohon lengkapi seluruh field wajib!'
      });
    }

    // Check unique NIK for other records
    const duplicate = db.prepare('SELECT id FROM karyawan WHERE nik = ? AND id != ?').get(nik.trim(), req.params.id);
    if (duplicate) {
      return res.status(400).json({ success: false, message: `NIK '${nik}' sudah digunakan oleh karyawan lain!` });
    }

    let foto = current.foto;
    if (req.file) {
      foto = req.file.filename;
      // Remove old photo if exists
      if (current.foto) {
        const oldPath = path.join(uploadDir, current.foto);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
    }

    const stmt = db.prepare(`
      UPDATE karyawan SET
        nik = ?,
        nama = ?,
        email = ?,
        telepon = ?,
        jenis_kelamin = ?,
        departemen = ?,
        jabatan = ?,
        status_kepegawaian = ?,
        status_kerja = ?,
        tanggal_masuk = ?,
        gaji = ?,
        alamat = ?,
        foto = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      nik.trim(),
      nama.trim(),
      email.trim(),
      telepon.trim(),
      jenis_kelamin || 'Laki-laki',
      departemen,
      jabatan.trim(),
      status_kepegawaian,
      status_kerja || 'Aktif',
      tanggal_masuk,
      parseFloat(gaji) || 0,
      alamat ? alamat.trim() : '',
      foto,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM karyawan WHERE id = ?').get(req.params.id);

    res.json({
      success: true,
      message: 'Data karyawan berhasil diperbarui!',
      data: updated
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Delete Employee
app.delete('/api/karyawan/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM karyawan WHERE id = ?').get(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Data karyawan tidak ditemukan.' });
    }

    // Remove photo if exists
    if (item.foto) {
      const oldPath = path.join(uploadDir, item.foto);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    db.prepare('DELETE FROM karyawan WHERE id = ?').run(req.params.id);

    res.json({
      success: true,
      message: `Data karyawan ${item.nama} (${item.nik}) berhasil dihapus!`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Export to CSV
app.get('/api/export/csv', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM karyawan ORDER BY id ASC').all();

    const headers = [
      'No',
      'NIK',
      'Nama Lengkap',
      'Email',
      'Telepon',
      'Jenis Kelamin',
      'Departemen',
      'Jabatan',
      'Status Kepegawaian',
      'Status Kerja',
      'Tanggal Masuk',
      'Gaji Pokok (Rp)',
      'Alamat'
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvLines = [headers.join(',')];

    rows.forEach((row, idx) => {
      const line = [
        idx + 1,
        escapeCsv(row.nik),
        escapeCsv(row.nama),
        escapeCsv(row.email),
        escapeCsv(row.telepon),
        escapeCsv(row.jenis_kelamin),
        escapeCsv(row.departemen),
        escapeCsv(row.jabatan),
        escapeCsv(row.status_kepegawaian),
        escapeCsv(row.status_kerja),
        escapeCsv(row.tanggal_masuk),
        escapeCsv(row.gaji),
        escapeCsv(row.alamat)
      ];
      csvLines.push(line.join(','));
    });

    // Add UTF-8 BOM so Excel displays Indonesian characters correctly
    const csvContent = '\uFEFF' + csvLines.join('\r\n');
    const filename = `data-karyawan-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Download Template CSV Karyawan
app.get('/api/export/template/csv', (req, res) => {
  const headers = [
    'NIK',
    'Nama Lengkap',
    'Email',
    'Telepon',
    'Jenis Kelamin',
    'Departemen',
    'Jabatan',
    'Status Kepegawaian',
    'Status Kerja',
    'Tanggal Masuk',
    'Gaji Pokok (Rp)',
    'Alamat'
  ];

  const sampleRows = [
    [
      'AC0001',
      'Ahmad Fauzi',
      'ahmad.fauzi@aerocorp.co.id',
      '081234567890',
      'Laki-laki',
      'Teknologi Informasi',
      'Staff IT (Software Engineer)',
      'Tetap',
      'Aktif',
      '2026-01-15',
      '6500000',
      'Jl. Sudirman No. 12, Jakarta Selatan'
    ],
    [
      'AC0002',
      'Rina Kartika',
      'rina.k@aerocorp.co.id',
      '082198765432',
      'Perempuan',
      'Human Resources',
      'Manager HR',
      'Tetap',
      'Aktif',
      '2026-02-01',
      '8500000',
      'Jl. Gatot Subroto No. 45, Jakarta Pusat'
    ]
  ];

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvLines = [headers.join(',')];
  sampleRows.forEach(r => csvLines.push(r.map(escapeCsv).join(',')));

  const csvContent = '\uFEFF' + csvLines.join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="template-import-karyawan.csv"');
  res.send(csvContent);
});

// API: Import CSV Karyawan
app.post('/api/import/csv', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'File CSV wajib diunggah!' });
  }

  const filePath = req.file.path;
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }

    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'File CSV kosong atau tidak memiliki baris data karyawan!'
      });
    }

    const parseLine = (line) => {
      const result = [];
      let cell = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cell += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(cell.trim());
          cell = '';
        } else {
          cell += char;
        }
      }
      result.push(cell.trim());
      return result;
    };

    const rawHeaders = parseLine(lines[0]);
    const headers = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

    let inserted = 0;
    let updated = 0;
    const errors = [];

    const insertStmt = db.prepare(`
      INSERT INTO karyawan (
        nik, nama, email, telepon, jenis_kelamin, departemen, jabatan,
        status_kepegawaian, status_kerja, tanggal_masuk, gaji, alamat
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStmt = db.prepare(`
      UPDATE karyawan SET
        nama = ?, email = ?, telepon = ?, jenis_kelamin = ?, departemen = ?,
        jabatan = ?, status_kepegawaian = ?, status_kerja = ?, tanggal_masuk = ?,
        gaji = ?, alamat = ?, updated_at = CURRENT_TIMESTAMP
      WHERE nik = ?
    `);

    const runTransaction = db.transaction(() => {
      for (let i = 1; i < lines.length; i++) {
        const values = parseLine(lines[i]);
        if (values.length < 2) continue;

        const row = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] !== undefined ? values[idx] : '';
        });

        const nik = (row.nik || '').trim();
        const nama = (row.namalengkap || row.nama || row.name || '').trim();
        const email = (row.email || row.surel || '').trim();
        const telepon = (row.telepon || row.telp || row.phone || row.nohp || '08123456789').trim();
        let jenis_kelamin = (row.jeniskelamin || row.jk || row.gender || 'Laki-laki').trim();
        if (jenis_kelamin.toLowerCase().startsWith('p')) jenis_kelamin = 'Perempuan';
        else jenis_kelamin = 'Laki-laki';

        const departemen = (row.departemen || row.divisi || row.dept || 'Teknologi Informasi').trim();
        const jabatan = (row.jabatan || row.posisi || 'Staff').trim();
        const status_kepegawaian = (row.statuskepegawaian || row.kepegawaian || row.status || 'Tetap').trim();
        const status_kerja = (row.statuskerja || row.keaktifan || 'Aktif').trim();
        let tanggal_masuk = (row.tanggalmasuk || row.tglmasuk || row.tgl || new Date().toISOString().slice(0, 10)).trim();
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(tanggal_masuk)) {
          const [d, m, y] = tanggal_masuk.split('/');
          tanggal_masuk = `${y}-${m}-${d}`;
        }

        const gajiRaw = (row.gajipokokrp || row.gajipokok || row.gaji || row.salary || '0').replace(/[^0-9]/g, '');
        const gaji = parseFloat(gajiRaw) || 0;
        const alamat = (row.alamat || row.address || '').trim();

        if (!nik || !nama) {
          errors.push(`Baris ${i + 1}: NIK atau Nama kosong, dilewati.`);
          continue;
        }

        const existing = db.prepare('SELECT id FROM karyawan WHERE nik = ?').get(nik);
        if (existing) {
          updateStmt.run(nama, email, telepon, jenis_kelamin, departemen, jabatan, status_kepegawaian, status_kerja, tanggal_masuk, gaji, alamat, nik);
          updated++;
        } else {
          insertStmt.run(nik, nama, email, telepon, jenis_kelamin, departemen, jabatan, status_kepegawaian, status_kerja, tanggal_masuk, gaji, alamat);
          inserted++;
        }
      }
    });

    runTransaction();

    res.json({
      success: true,
      message: `Impor CSV berhasil! ${inserted} data baru ditambahkan, ${updated} data diperbarui.`,
      data: { inserted, updated, errors }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal memproses file CSV: ' + error.message });
  } finally {
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
  }
});

// ==========================================
// API PRESENSI / ABSENSI KARYAWAN
// ==========================================

// Helper to get formatted Indonesian date & time strings
const getNowIndo = () => {
  const d = new Date();
  // Adjust to UTC+7 (WIB)
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const wib = new Date(utc + (3600000 * 7));
  const tanggal = wib.toISOString().slice(0, 10);
  const jam = String(wib.getHours()).padStart(2, '0') + ':' + 
              String(wib.getMinutes()).padStart(2, '0') + ':' + 
              String(wib.getSeconds()).padStart(2, '0');
  return { tanggal, jam };
};

// API: Get Presensi Today Summary & Employee Status
app.get('/api/presensi/today', (req, res) => {
  try {
    const tanggal = req.query.tanggal || getNowIndo().tanggal;

    // Total active employees
    const totalKaryawan = db.prepare("SELECT COUNT(*) as total FROM karyawan WHERE status_kerja = 'Aktif'").get().total;

    // Counts for today (memastikan jam_masuk > '08:30:00' selalu dihitung Terlambat)
    const hadirCount = db.prepare("SELECT COUNT(*) as total FROM presensi WHERE tanggal = ? AND status = 'Hadir' AND (jam_masuk IS NULL OR jam_masuk <= '08:30:00')").get(tanggal).total;
    const terlambatCount = db.prepare("SELECT COUNT(*) as total FROM presensi WHERE tanggal = ? AND (status = 'Terlambat' OR (jam_masuk > '08:30:00' AND status NOT IN ('Izin', 'Sakit')))").get(tanggal).total;
    const izinCount = db.prepare("SELECT COUNT(*) as total FROM presensi WHERE tanggal = ? AND status = 'Izin'").get(tanggal).total;
    const sakitCount = db.prepare("SELECT COUNT(*) as total FROM presensi WHERE tanggal = ? AND status = 'Sakit'").get(tanggal).total;

    const totalTercatat = hadirCount + terlambatCount + izinCount + sakitCount;
    const belumAbsen = Math.max(0, totalKaryawan - totalTercatat);

    // List of active employees with today's attendance record (if any)
    const employees = db.prepare(`
      SELECT 
        k.id, k.nik, k.nama, k.departemen, k.jabatan, k.foto,
        p.id as presensi_id, p.jam_masuk, p.jam_pulang, p.status as status_presensi, p.keterangan
      FROM karyawan k
      LEFT JOIN presensi p ON k.id = p.karyawan_id AND p.tanggal = ?
      WHERE k.status_kerja = 'Aktif'
      ORDER BY k.nama ASC
    `).all(tanggal);

    res.json({
      success: true,
      data: {
        tanggal,
        totalKaryawan,
        hadirCount,
        terlambatCount,
        izinCount,
        sakitCount,
        belumAbsen,
        summary: {
          hadir: hadirCount,
          terlambat: terlambatCount,
          izin: izinCount,
          sakit: sakitCount,
          belumPresensi: belumAbsen
        },
        employees
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Get Presensi Records (Filterable with Pagination)
app.get('/api/presensi', (req, res) => {
  try {
    const {
      tanggal = '',
      status = '',
      departemen = '',
      search = '',
      karyawan_id = '',
      sort_by = 'tanggal',
      order = 'DESC',
      page = 1,
      limit = 10
    } = req.query;

    const conditions = [];
    const params = [];

    if (karyawan_id) {
      conditions.push('p.karyawan_id = ?');
      params.push(karyawan_id);
    }

    if (tanggal) {
      conditions.push('p.tanggal = ?');
      params.push(tanggal);
    }

    if (status) {
      conditions.push('p.status = ?');
      params.push(status);
    }

    if (departemen) {
      conditions.push('k.departemen = ?');
      params.push(departemen);
    }

    if (search.trim()) {
      conditions.push('(k.nama LIKE ? OR k.nik LIKE ? OR p.keterangan LIKE ?)');
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Count total filtered
    const countSql = `
      SELECT COUNT(*) as total 
      FROM presensi p 
      JOIN karyawan k ON p.karyawan_id = k.id 
      ${whereClause}
    `;
    const totalFiltered = db.prepare(countSql).get(...params).total;

    // Allowed sort columns
    const allowedSort = ['tanggal', 'jam_masuk', 'jam_pulang', 'status', 'created_at'];
    const safeSort = allowedSort.includes(sort_by) ? `p.${sort_by}` : 'p.tanggal';
    const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let items = [];
    let totalPages = 1;

    const normalizeItem = r => {
      let finalSt = r.status;
      let finalKet = r.keterangan;
      if (r.jam_masuk && r.jam_masuk > '08:30:00' && finalSt !== 'Izin' && finalSt !== 'Sakit') {
        finalSt = 'Terlambat';
        if (!finalKet || finalKet === 'Tepat Waktu') {
          finalKet = 'Terlambat (Lewat 08:30)';
        }
      }
      return {
        ...r,
        status: finalSt,
        keterangan: finalKet
      };
    };

    if (limit === 'all') {
      const sql = `
        SELECT p.*, k.nama, k.nik, k.departemen, k.jabatan, k.foto 
        FROM presensi p 
        JOIN karyawan k ON p.karyawan_id = k.id 
        ${whereClause} 
        ORDER BY ${safeSort} ${safeOrder}, p.id DESC
      `;
      items = db.prepare(sql).all(...params).map(normalizeItem);
      totalPages = 1;
    } else {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit, 10) || 10);
      const offset = (pageNum - 1) * limitNum;
      totalPages = Math.ceil(totalFiltered / limitNum) || 1;

      const sql = `
        SELECT p.*, k.nama, k.nik, k.departemen, k.jabatan, k.foto 
        FROM presensi p 
        JOIN karyawan k ON p.karyawan_id = k.id 
        ${whereClause} 
        ORDER BY ${safeSort} ${safeOrder}, p.id DESC 
        LIMIT ? OFFSET ?
      `;
      items = db.prepare(sql).all(...params, limitNum, offset).map(normalizeItem);
    }

    res.json({
      success: true,
      data: items,
      pagination: {
        page: parseInt(page, 10) || 1,
        limit: limit === 'all' ? totalFiltered : parseInt(limit, 10) || 10,
        totalItems: totalFiltered,
        totalPages
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Absen Masuk (Check-In)
app.post('/api/presensi/masuk', (req, res) => {
  try {
    const { karyawan_id, status = 'Hadir', keterangan = '' } = req.body;

    if (!karyawan_id) {
      return res.status(400).json({ success: false, message: 'Pilih karyawan terlebih dahulu!' });
    }

    const { tanggal, jam } = getNowIndo();

    // Verify employee exists and is active
    const karyawan = db.prepare('SELECT id, nama, nik FROM karyawan WHERE id = ?').get(karyawan_id);
    if (!karyawan) {
      return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan!' });
    }

    // Check if already checked in today
    const existing = db.prepare('SELECT * FROM presensi WHERE karyawan_id = ? AND tanggal = ?').get(karyawan_id, tanggal);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `${karyawan.nama} sudah tercatat presensi hari ini (${existing.status}) pada pukul ${existing.jam_masuk || '-'}.`
      });
    }

    // Determine status (if check-in is past 08:30 and marked as Hadir, auto mark as Terlambat)
    let finalStatus = status;
    let finalKeterangan = keterangan ? keterangan.trim() : null;
    if (finalStatus === 'Hadir') {
      if (jam > '08:30:00') {
        finalStatus = 'Terlambat';
        finalKeterangan = 'Terlambat (Lewat 08:30)';
      } else {
        finalKeterangan = 'Tepat Waktu';
      }
    }

    const jamMasuk = (finalStatus === 'Izin' || finalStatus === 'Sakit') ? null : jam;

    const stmt = db.prepare(`
      INSERT INTO presensi (karyawan_id, tanggal, jam_masuk, status, keterangan, metode)
      VALUES (?, ?, ?, ?, ?, 'Web Portal')
    `);

    stmt.run(karyawan_id, tanggal, jamMasuk, finalStatus, finalKeterangan);

    res.json({
      success: true,
      message: `Presensi Masuk berhasil dicatat untuk ${karyawan.nama} (${finalStatus}) pada pukul ${jam}.`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Absen Pulang (Check-Out)
app.post('/api/presensi/pulang', (req, res) => {
  try {
    const { karyawan_id } = req.body;

    if (!karyawan_id) {
      return res.status(400).json({ success: false, message: 'Pilih karyawan terlebih dahulu!' });
    }

    const { tanggal, jam } = getNowIndo();

    const karyawan = db.prepare('SELECT id, nama FROM karyawan WHERE id = ?').get(karyawan_id);
    if (!karyawan) {
      return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan!' });
    }

    const existing = db.prepare('SELECT * FROM presensi WHERE karyawan_id = ? AND tanggal = ?').get(karyawan_id, tanggal);
    if (!existing) {
      return res.status(400).json({
        success: false,
        message: `${karyawan.nama} belum melakukan Absen Masuk hari ini. Mohon lakukan Absen Masuk terlebih dahulu!`
      });
    }

    if (existing.status === 'Izin' || existing.status === 'Sakit') {
      return res.status(400).json({
        success: false,
        message: `${karyawan.nama} tercatat ${existing.status} hari ini, tidak dapat melakukan Absen Pulang.`
      });
    }

    if (existing.jam_pulang) {
      return res.status(400).json({
        success: false,
        message: `${karyawan.nama} sudah melakukan Absen Pulang hari ini pada pukul ${existing.jam_pulang}!`
      });
    }

    db.prepare('UPDATE presensi SET jam_pulang = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(jam, existing.id);

    res.json({
      success: true,
      message: `Presensi Pulang berhasil dicatat untuk ${karyawan.nama} pada pukul ${jam}. Selamat beristirahat!`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Form Input Presensi & Perizinan (with optional bukti_foto / surat dokter)
app.post('/api/presensi/form', upload.single('bukti_foto'), (req, res) => {
  try {
    const {
      karyawan_id,
      tanggal,
      status = 'Hadir',
      jam_masuk,
      jam_pulang,
      keterangan
    } = req.body;

    if (!karyawan_id || !tanggal || !status) {
      return res.status(400).json({ success: false, message: 'Karyawan, Tanggal, dan Status wajib ditentukan!' });
    }

    const { tanggal: nowTanggal, jam: nowJam } = getNowIndo();
    const bukti_foto = req.file ? req.file.filename : null;

    let finalJamMasuk = null;
    let finalJamPulang = null;
    let finalKeterangan = null;
    let finalFoto = null;

    let finalStatus = status;

    if (status === 'Hadir') {
      finalJamMasuk = (jam_masuk && jam_masuk.trim() !== '') ? jam_masuk.trim() : nowJam;
      finalJamPulang = (jam_pulang && jam_pulang.trim() !== '') ? jam_pulang.trim() : null;
      finalFoto = null;

      // Otomatis terdeteksi Terlambat jika jam masuk melewati 08:30:00 WIB
      if (finalJamMasuk > '08:30:00') {
        finalStatus = 'Terlambat';
        finalKeterangan = 'Terlambat (Lewat 08:30)';
      } else {
        finalKeterangan = 'Tepat Waktu';
      }
    } else if (status === 'Izin') {
      finalJamMasuk = null;
      finalJamPulang = null;
      finalKeterangan = keterangan ? keterangan.trim() : 'Izin';
      finalFoto = null; // Absen izin hanya berisi alasan/keterangan
    } else if (status === 'Sakit') {
      finalJamMasuk = null;
      finalJamPulang = null;
      finalKeterangan = keterangan ? keterangan.trim() : 'Sakit';
      finalFoto = bukti_foto; // Khusus sakit ada upload foto/file surat dokter
    }

    // Check if record exists for this employee and date
    const existing = db.prepare('SELECT id, bukti_foto, jam_masuk, jam_pulang FROM presensi WHERE karyawan_id = ? AND tanggal = ?').get(karyawan_id, tanggal);

    if (existing) {
      if (status === 'Sakit' && !finalFoto) {
        finalFoto = existing.bukti_foto;
      }

      db.prepare(`
        UPDATE presensi SET
          status = ?,
          jam_masuk = ?,
          jam_pulang = ?,
          keterangan = ?,
          bukti_foto = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        finalStatus,
        finalJamMasuk,
        finalJamPulang || existing.jam_pulang,
        finalKeterangan,
        finalFoto,
        existing.id
      );

      res.json({ success: true, message: `Data presensi ${finalStatus} berhasil diperbarui!`, data: { status: finalStatus, bukti_foto: finalFoto } });
    } else {
      db.prepare(`
        INSERT INTO presensi (karyawan_id, tanggal, jam_masuk, jam_pulang, status, keterangan, bukti_foto, metode)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Form Portal')
      `).run(
        karyawan_id,
        tanggal,
        finalJamMasuk,
        finalJamPulang,
        finalStatus,
        finalKeterangan,
        finalFoto
      );

      res.status(201).json({ success: true, message: `Presensi ${finalStatus} berhasil dicatat!`, data: { status: finalStatus, bukti_foto: finalFoto } });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Admin Manual Input / Edit Presensi
app.post('/api/presensi/manual', upload.single('bukti_foto'), (req, res) => {
  try {
    const {
      karyawan_id,
      tanggal,
      jam_masuk = null,
      jam_pulang = null,
      status = 'Hadir',
      keterangan = ''
    } = req.body;

    if (!karyawan_id || !tanggal || !status) {
      return res.status(400).json({ success: false, message: 'Karyawan, Tanggal, dan Status wajib diisi!' });
    }

    const bukti_foto = req.file ? req.file.filename : null;

    // Check if record exists for this employee and date
    const existing = db.prepare('SELECT id, bukti_foto FROM presensi WHERE karyawan_id = ? AND tanggal = ?').get(karyawan_id, tanggal);

    if (existing) {
      const finalFoto = bukti_foto || existing.bukti_foto;
      // Update
      db.prepare(`
        UPDATE presensi SET
          jam_masuk = ?,
          jam_pulang = ?,
          status = ?,
          keterangan = ?,
          bukti_foto = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(jam_masuk || null, jam_pulang || null, status, keterangan ? keterangan.trim() : null, finalFoto, existing.id);

      res.json({ success: true, message: 'Data presensi berhasil diperbarui!', data: { bukti_foto: finalFoto } });
    } else {
      // Insert
      db.prepare(`
        INSERT INTO presensi (karyawan_id, tanggal, jam_masuk, jam_pulang, status, keterangan, bukti_foto, metode)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Manual Admin')
      `).run(karyawan_id, tanggal, jam_masuk || null, jam_pulang || null, status, keterangan ? keterangan.trim() : null, bukti_foto);

      res.json({ success: true, message: 'Data presensi baru berhasil dicatat!', data: { bukti_foto } });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Delete Presensi Record
app.delete('/api/presensi/:id', (req, res) => {
  try {
    const record = db.prepare('SELECT id FROM presensi WHERE id = ?').get(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Data presensi tidak ditemukan!' });
    }

    db.prepare('DELETE FROM presensi WHERE id = ?').run(req.params.id);

    res.json({ success: true, message: 'Data presensi berhasil dihapus!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Export Presensi CSV
app.get('/api/export/presensi/csv', (req, res) => {
  try {
    const { tanggal = '', status = '', departemen = '' } = req.query;

    const conditions = [];
    const params = [];

    if (tanggal) {
      conditions.push('p.tanggal = ?');
      params.push(tanggal);
    }
    if (status) {
      conditions.push('p.status = ?');
      params.push(status);
    }
    if (departemen) {
      conditions.push('k.departemen = ?');
      params.push(departemen);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const rows = db.prepare(`
      SELECT p.*, k.nama, k.nik, k.departemen, k.jabatan 
      FROM presensi p 
      JOIN karyawan k ON p.karyawan_id = k.id 
      ${whereClause} 
      ORDER BY p.tanggal DESC, p.id DESC
    `).all(...params);

    const headers = [
      'No',
      'Tanggal',
      'NIK',
      'Nama Karyawan',
      'Departemen',
      'Jabatan',
      'Jam Masuk',
      'Jam Pulang',
      'Status Kehadiran',
      'Keterangan',
      'Metode'
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvLines = [headers.join(',')];

    rows.forEach((row, idx) => {
      const line = [
        idx + 1,
        escapeCsv(row.tanggal),
        escapeCsv(row.nik),
        escapeCsv(row.nama),
        escapeCsv(row.departemen),
        escapeCsv(row.jabatan),
        escapeCsv(row.jam_masuk || '-'),
        escapeCsv(row.jam_pulang || '-'),
        escapeCsv(row.status),
        escapeCsv(row.keterangan || '-'),
        escapeCsv(row.metode)
      ];
      csvLines.push(line.join(','));
    });

    const csvContent = '\uFEFF' + csvLines.join('\r\n');
    const filename = `rekap-presensi-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Fallback to index.html for SPA feel
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` SISTEM INFORMASI PENGELOLAAN DATA KARYAWAN`);
  console.log(` AERO CORPORATION`);
  console.log(` Bidang: Teknologi, Bisnis Digital, Manajemen & Usaha`);
  console.log(` Server berjalan di: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
