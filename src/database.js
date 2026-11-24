const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'karyawan.db');
const db = new DatabaseSync(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nama TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'ADMIN',
    unit TEXT DEFAULT 'Aero Corporation - Kantor Pusat',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS karyawan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nik TEXT UNIQUE NOT NULL,
    nama TEXT NOT NULL,
    email TEXT NOT NULL,
    telepon TEXT NOT NULL,
    jenis_kelamin TEXT NOT NULL,
    departemen TEXT NOT NULL,
    jabatan TEXT NOT NULL,
    status_kepegawaian TEXT NOT NULL,
    status_kerja TEXT NOT NULL DEFAULT 'Aktif',
    tanggal_masuk TEXT NOT NULL,
    gaji REAL NOT NULL DEFAULT 0,
    alamat TEXT,
    foto TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS presensi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    karyawan_id INTEGER NOT NULL,
    tanggal TEXT NOT NULL,
    jam_masuk TEXT,
    jam_pulang TEXT,
    status TEXT NOT NULL DEFAULT 'Hadir',
    keterangan TEXT,
    bukti_foto TEXT,
    metode TEXT DEFAULT 'Web Portal',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (karyawan_id) REFERENCES karyawan(id) ON DELETE CASCADE,
    UNIQUE(karyawan_id, tanggal)
  );
`);

// Migration for existing databases to ensure bukti_foto exists
try {
  db.exec('ALTER TABLE presensi ADD COLUMN bukti_foto TEXT;');
} catch (e) {
  // Already exists
}

// Seed default admin user if not exists
try {
  const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminUser) {
    db.prepare(`
      INSERT INTO users (username, email, password, nama, role, unit)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('admin', 'admin@aerocorp.co.id', 'admin', 'Administrator SDM', 'ADMIN', 'Aero Corporation - Kantor Pusat');
    console.log('Default user seeded: admin / admin');
  }
} catch (err) {
  console.error('Error seeding default user:', err);
}

module.exports = db;
