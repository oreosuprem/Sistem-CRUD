const db = require('../src/database');

console.log('Testing Database, Users, Employee & Presensi tables...');

// 1. Users Check
const user = db.prepare('SELECT id, username, email, role FROM users WHERE username = ?').get('admin');
if (!user) throw new Error('Default admin user not found in database!');
console.log('Admin user found:', user.username, 'with role:', user.role);

// 2. Employee Count Check
const countRow = db.prepare('SELECT COUNT(*) as count FROM karyawan').get();
console.log('Current employee count:', countRow.count);

// 3. Stats Queries Check
const statsTotal = db.prepare('SELECT COUNT(*) as total FROM karyawan').get();
const aktifRow = db.prepare("SELECT COUNT(*) as total FROM karyawan WHERE status_kerja = 'Aktif'").get();
const payrollRow = db.prepare("SELECT SUM(gaji) as total_gaji, AVG(gaji) as avg_gaji FROM karyawan WHERE status_kerja = 'Aktif'").get();

console.log('Stats Check: Total =', statsTotal.total, ', Aktif =', aktifRow.total, ', Total Gaji =', payrollRow.total_gaji);

// 4. Presensi Table Check & Bukti Foto Column
const presensiCount = db.prepare('SELECT COUNT(*) as count FROM presensi').get();
console.log('Current presensi records count:', presensiCount.count);

// Test insert & delete presensi with bukti_foto
const testInsert = db.prepare(`
  INSERT INTO presensi (karyawan_id, tanggal, jam_masuk, status, keterangan, metode, bukti_foto)
  VALUES (1, '2026-11-20', NULL, 'Sakit', 'Demam tinggi', 'Formulir Sakit', 'test-surat-dokter.jpg')
`).run();
console.log('Test Presensi inserted ID:', testInsert.lastInsertRowid);

const testRow = db.prepare('SELECT * FROM presensi WHERE id = ?').get(testInsert.lastInsertRowid);
if (!testRow || testRow.bukti_foto !== 'test-surat-dokter.jpg') {
  throw new Error('Gagal memverifikasi kolom bukti_foto pada tabel presensi!');
}
console.log('Bukti Foto column verified:', testRow.bukti_foto);

// Cleanup test row
db.prepare('DELETE FROM presensi WHERE id = ?').run(testInsert.lastInsertRowid);
console.log('Test Presensi cleaned up successfully.');

console.log('All Database, Auth, Employee & Presensi tests PASSED successfully!');
