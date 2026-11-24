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

// 5. Office Location & GPS Verification Check
const office = db.prepare('SELECT * FROM office_location LIMIT 1').get();
if (!office || !office.latitude || !office.longitude) {
  throw new Error('Default office location not configured!');
}
console.log(`Office Location verified: ${office.nama_kantor} (${office.latitude}, ${office.longitude}) radius ${office.radius_meter}m`);

// Test insert & delete presensi with bukti_foto and GPS fields
const testInsert = db.prepare(`
  INSERT INTO presensi (karyawan_id, tanggal, jam_masuk, status, keterangan, metode, bukti_foto, latitude, longitude, lokasi, jarak_meter, status_lokasi)
  VALUES (1, '2026-11-20', '08:15:00', 'Hadir', 'Tepat Waktu', 'Web GPS', 'test-surat-dokter.jpg', -6.3148979, 106.8382681, 'Kantor Aero Lenteng Agung', 15.5, 'Di Kantor')
`).run();
console.log('Test Presensi inserted ID:', testInsert.lastInsertRowid);

const testRow = db.prepare('SELECT * FROM presensi WHERE id = ?').get(testInsert.lastInsertRowid);
if (!testRow || testRow.bukti_foto !== 'test-surat-dokter.jpg') {
  throw new Error('Gagal memverifikasi kolom bukti_foto pada tabel presensi!');
}
if (testRow.status_lokasi !== 'Di Kantor' || testRow.jarak_meter !== 15.5) {
  throw new Error('Gagal memverifikasi kolom lokasi dan jarak GPS pada tabel presensi!');
}
console.log('Bukti Foto and GPS columns verified:', testRow.status_lokasi, `(${testRow.jarak_meter}m)`);

// Cleanup test row
db.prepare('DELETE FROM presensi WHERE id = ?').run(testInsert.lastInsertRowid);
console.log('Test Presensi cleaned up successfully.');

console.log('All Database, Auth, Employee & Presensi tests PASSED successfully!');
