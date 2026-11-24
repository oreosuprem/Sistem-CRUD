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
    latitude REAL,
    longitude REAL,
    lokasi TEXT,
    jarak_meter REAL,
    status_lokasi TEXT DEFAULT 'Di Kantor',
    latitude_pulang REAL,
    longitude_pulang REAL,
    jarak_meter_pulang REAL,
    status_lokasi_pulang TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (karyawan_id) REFERENCES karyawan(id) ON DELETE CASCADE,
    UNIQUE(karyawan_id, tanggal)
  );

  CREATE TABLE IF NOT EXISTS office_location (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama_kantor TEXT NOT NULL DEFAULT 'Kantor Pusat Aero Corporation',
    latitude REAL NOT NULL DEFAULT -6.3148979,
    longitude REAL NOT NULL DEFAULT 106.8382681,
    radius_meter INTEGER NOT NULL DEFAULT 200,
    alamat TEXT DEFAULT 'Jl. Raya Lenteng Agung No.5, RT.5/RW.2, Lenteng Agung, Kec. Jagakarsa, Kota Jakarta Selatan, Daerah Khusus Ibukota Jakarta 12530',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration for existing databases to ensure columns exist
const presensiCols = [
  'bukti_foto TEXT',
  'latitude REAL',
  'longitude REAL',
  'lokasi TEXT',
  'jarak_meter REAL',
  'status_lokasi TEXT DEFAULT "Di Kantor"',
  'latitude_pulang REAL',
  'longitude_pulang REAL',
  'jarak_meter_pulang REAL',
  'status_lokasi_pulang TEXT'
];
for (const col of presensiCols) {
  try {
    db.exec(`ALTER TABLE presensi ADD COLUMN ${col};`);
  } catch (e) {
    // Already exists
  }
}

// Seed default office location if table is empty
try {
  const loc = db.prepare('SELECT id FROM office_location LIMIT 1').get();
  if (!loc) {
    db.prepare(`
      INSERT INTO office_location (nama_kantor, latitude, longitude, radius_meter, alamat)
      VALUES (?, ?, ?, ?, ?)
    `).run('Kantor Pusat Aero Corporation', -6.3148979, 106.8382681, 200, 'Jl. Raya Lenteng Agung No.5, RT.5/RW.2, Lenteng Agung, Kec. Jagakarsa, Kota Jakarta Selatan, Daerah Khusus Ibukota Jakarta 12530');
  }
} catch (e) {
  console.error('Error seeding office location:', e);
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
