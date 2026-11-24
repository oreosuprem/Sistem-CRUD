/**
 * Script Migrasi Database SQLite ke PostgreSQL / Supabase
 * Aero Corporation - Sistem Informasi Manajemen SDM & Presensi
 * 
 * Penggunaan:
 *   1. Pasang driver pg (jika belum): npm install pg
 *   2. Set environment variable DATABASE_URL:
 *      $env:DATABASE_URL="postgres://postgres:password@db.supabase.co:5432/postgres"
 *   3. Jalankan: node scripts/migrate-to-postgres.js
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: Environment variable DATABASE_URL belum ditentukan.');
    console.log('Contoh: postgres://postgres.xxx:password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres');
    process.exit(1);
  }

  let pg;
  try {
    pg = require('pg');
  } catch (err) {
    console.error('ERROR: Package "pg" belum terpasang. Jalankan "npm install pg" terlebih dahulu.');
    process.exit(1);
  }

  const dbPath = path.join(__dirname, '..', 'data', 'karyawan.db');
  if (!fs.existsSync(dbPath)) {
    console.error('ERROR: Database SQLite karyawan.db tidak ditemukan di:', dbPath);
    process.exit(1);
  }

  console.log('1. Membaca data dari SQLite (karyawan.db)...');
  const sqlite = new DatabaseSync(dbPath);

  const users = sqlite.prepare('SELECT * FROM users').all();
  const karyawan = sqlite.prepare('SELECT * FROM karyawan').all();
  const presensi = sqlite.prepare('SELECT * FROM presensi').all();
  const office = sqlite.prepare('SELECT * FROM office_location').all();
  const audits = sqlite.prepare('SELECT * FROM audit_logs').all();

  console.log(`   - Users: ${users.length} baris`);
  console.log(`   - Karyawan: ${karyawan.length} baris`);
  console.log(`   - Presensi: ${presensi.length} baris`);
  console.log(`   - Office Location: ${office.length} baris`);
  console.log(`   - Audit Logs: ${audits.length} baris`);

  console.log('2. Menghubungkan ke PostgreSQL / Supabase...');
  const pool = new pg.Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    console.log('3. Membuat skema tabel di PostgreSQL...');
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        nama VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'ADMIN',
        unit VARCHAR(255) DEFAULT 'Aero Corporation - Kantor Pusat',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS karyawan (
        id SERIAL PRIMARY KEY,
        nik VARCHAR(50) UNIQUE NOT NULL,
        nama VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        telepon VARCHAR(50) NOT NULL,
        jenis_kelamin VARCHAR(50) NOT NULL,
        departemen VARCHAR(150) NOT NULL,
        jabatan VARCHAR(150) NOT NULL,
        status_kepegawaian VARCHAR(50) NOT NULL,
        status_kerja VARCHAR(50) NOT NULL DEFAULT 'Aktif',
        tanggal_masuk DATE NOT NULL,
        gaji NUMERIC(15,2) NOT NULL DEFAULT 0,
        alamat TEXT,
        foto TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS presensi (
        id SERIAL PRIMARY KEY,
        karyawan_id INTEGER NOT NULL REFERENCES karyawan(id) ON DELETE CASCADE,
        tanggal DATE NOT NULL,
        jam_masuk TIME,
        jam_pulang TIME,
        status VARCHAR(50) NOT NULL DEFAULT 'Hadir',
        keterangan TEXT,
        bukti_foto TEXT,
        metode VARCHAR(50) DEFAULT 'Web Portal',
        latitude NUMERIC(10,7),
        longitude NUMERIC(10,7),
        lokasi TEXT,
        jarak_meter NUMERIC(10,2),
        status_lokasi VARCHAR(50) DEFAULT 'Di Kantor',
        latitude_pulang NUMERIC(10,7),
        longitude_pulang NUMERIC(10,7),
        jarak_meter_pulang NUMERIC(10,2),
        status_lokasi_pulang VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(karyawan_id, tanggal)
      );

      CREATE TABLE IF NOT EXISTS office_location (
        id SERIAL PRIMARY KEY,
        nama_kantor VARCHAR(255) NOT NULL,
        latitude NUMERIC(10,7) NOT NULL,
        longitude NUMERIC(10,7) NOT NULL,
        radius_meter INTEGER NOT NULL DEFAULT 200,
        alamat TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        username VARCHAR(100),
        role VARCHAR(50) DEFAULT 'ADMIN',
        action VARCHAR(100) NOT NULL,
        detail TEXT,
        ip_address VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('4. Memasukkan data ke PostgreSQL...');
    for (const u of users) {
      await client.query(`
        INSERT INTO users (id, username, email, password, nama, role, unit)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET nama = EXCLUDED.nama
      `, [u.id, u.username, u.email, u.password, u.nama, u.role, u.unit]);
    }

    for (const k of karyawan) {
      await client.query(`
        INSERT INTO karyawan (id, nik, nama, email, telepon, jenis_kelamin, departemen, jabatan, status_kepegawaian, status_kerja, tanggal_masuk, gaji, alamat, foto)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO NOTHING
      `, [k.id, k.nik, k.nama, k.email, k.telepon, k.jenis_kelamin, k.departemen, k.jabatan, k.status_kepegawaian, k.status_kerja, k.tanggal_masuk, k.gaji, k.alamat, k.foto]);
    }

    for (const p of presensi) {
      await client.query(`
        INSERT INTO presensi (id, karyawan_id, tanggal, jam_masuk, jam_pulang, status, keterangan, bukti_foto, metode, latitude, longitude, lokasi, jarak_meter, status_lokasi, latitude_pulang, longitude_pulang, jarak_meter_pulang, status_lokasi_pulang)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (karyawan_id, tanggal) DO NOTHING
      `, [p.id, p.karyawan_id, p.tanggal, p.jam_masuk, p.jam_pulang, p.status, p.keterangan, p.bukti_foto, p.metode, p.latitude, p.longitude, p.lokasi, p.jarak_meter, p.status_lokasi, p.latitude_pulang, p.longitude_pulang, p.jarak_meter_pulang, p.status_lokasi_pulang]);
    }

    for (const o of office) {
      await client.query(`
        INSERT INTO office_location (id, nama_kantor, latitude, longitude, radius_meter, alamat)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO NOTHING
      `, [o.id, o.nama_kantor, o.latitude, o.longitude, o.radius_meter, o.alamat]);
    }

    for (const a of audits) {
      await client.query(`
        INSERT INTO audit_logs (id, user_id, username, role, action, detail, ip_address, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING
      `, [a.id, a.user_id, a.username, a.role, a.action, a.detail, a.ip_address, a.created_at]);
    }

    await client.query('COMMIT');
    console.log('✅ MIGRASI SELESAI DENGAN SUKSES!');
    console.log('Seluruh tabel dan baris data telah berhasil disinkronkan ke PostgreSQL / Supabase.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Gagal melakukan migrasi:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
