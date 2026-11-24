// Aero Corporation - Human Resource & Attendance System
// Client-side Application Logic (Vanilla JS)

// Global State
let currentPage = 1;
let currentSort = 'created_at';
let currentOrder = 'DESC';
let debounceTimer = null;
let currentKaryawanList = [];
let chartDepartemenInstance = null;
let chartStatusInstance = null;

// Presensi State
let currentPresensiPage = 1;
let debouncePresensiTimer = null;

// Auth State
let currentAuthUser = null;

// Server Time Sync & GPS Geolocation State
let serverTimeOffsetMs = 0;
let isServerTimeSynced = false;
let currentGPSLocation = {
  latitude: null,
  longitude: null,
  accuracy: null,
  distanceMeters: null,
  statusLokasi: 'Belum Terdeteksi',
  isAtOffice: false
};
let officeConfigCache = null;

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', async () => {
  displayCurrentDate();
  await syncServerTime();
  startLiveClockAndGreeting();
  setInterval(syncServerTime, 60000);
  setupKeyboardShortcuts();
  setupGlobalClickListeners();
  fetchOfficeLocation();
  detectGPSLocation(false);
  initAuth();
});

// Setup Global Click Listener to close popups when clicking outside
function setupGlobalClickListeners() {
  window.addEventListener('click', (e) => {
    const notifDropdown = document.getElementById('dropdown-notifications');
    const notifBtn = document.getElementById('btn-notifications');
    if (notifDropdown && !notifDropdown.classList.contains('hidden')) {
      if (!notifDropdown.contains(e.target) && !notifBtn?.contains(e.target)) {
        notifDropdown.classList.add('hidden');
      }
    }

    const profileDropdown = document.getElementById('dropdown-profile-card');
    const avatarBtn = document.getElementById('btn-user-avatar');
    if (profileDropdown && !profileDropdown.classList.contains('hidden')) {
      if (!profileDropdown.contains(e.target) && !avatarBtn?.contains(e.target)) {
        profileDropdown.classList.add('hidden');
      }
    }
  });
}

// Initialize Auth
function initAuth() {
  const savedUser = localStorage.getItem('aero_auth_user');
  if (savedUser) {
    try {
      currentAuthUser = JSON.parse(savedUser);
      applyAuthenticatedUserUI();
      document.getElementById('login-view')?.classList.add('hidden');
      document.getElementById('app-layout')?.classList.remove('hidden');
      
      // Load data for authenticated dashboard
      if (currentAuthUser.role === 'KARYAWAN') {
        switchTab('presensi');
        fetchPresensiTodaySummary();
        populatePresensiDropdowns();
        populatePulangDropdown();
        fetchPresensi(1);
      } else {
        updateSidebarNavState('karyawan');
        fetchStats();
        fetchKaryawan(1);
        fetchPresensiTodaySummary();
        populatePresensiDropdowns();
        populatePulangDropdown();
      }
      const formTgl = document.getElementById('form-presensi-input-tanggal');
      if (formTgl && !formTgl.value) {
        formTgl.value = new Date().toISOString().slice(0, 10);
      }
    } catch (e) {
      localStorage.removeItem('aero_auth_user');
      showLoginView();
    }
  } else {
    showLoginView();
  }
}

function showLoginView() {
  document.getElementById('login-view')?.classList.remove('hidden');
  document.getElementById('app-layout')?.classList.add('hidden');
}

// Update UI with Authenticated User Information (Matching Gambar 2 & Gambar 3 and Role Permissions)
function applyAuthenticatedUserUI() {
  if (!currentAuthUser) return;

  const isKaryawan = currentAuthUser.role === 'KARYAWAN';
  const displayName = currentAuthUser.nama || currentAuthUser.username || (isKaryawan ? 'Karyawan' : 'Admin');
  const initial = displayName.charAt(0).toUpperCase();

  const headerInitial = document.getElementById('header-avatar-initial');
  const dropdownInitial = document.getElementById('dropdown-avatar-initial');
  const dropdownName = document.getElementById('dropdown-user-name');
  const dropdownEmail = document.getElementById('dropdown-user-email');
  const dropdownRole = document.getElementById('dropdown-user-role');
  const dropdownUnit = document.getElementById('dropdown-user-unit');
  const capsuleRole = document.getElementById('capsule-role-label');

  if (headerInitial) headerInitial.textContent = initial;
  if (dropdownInitial) dropdownInitial.textContent = initial;
  if (dropdownName) dropdownName.textContent = displayName;
  if (dropdownEmail) dropdownEmail.textContent = currentAuthUser.email || (isKaryawan ? `${currentAuthUser.nik}@aerocorp.co.id` : 'admin@aerocorp.co.id');
  if (dropdownRole) dropdownRole.textContent = isKaryawan ? 'KARYAWAN' : 'ADMIN';
  if (dropdownUnit) dropdownUnit.textContent = currentAuthUser.unit || 'Aero Corporation - ' + (currentAuthUser.departemen || 'Kantor Pusat');
  if (capsuleRole) capsuleRole.textContent = isKaryawan ? 'KRY' : 'ADM';

  // Sidebar navigation elements
  const navKaryawan = document.getElementById('nav-wrapper-karyawan');
  const navPresensi = document.getElementById('nav-wrapper-presensi');
  const navStats = document.getElementById('nav-wrapper-stats');
  const navAbout = document.getElementById('nav-wrapper-about');
  const capsuleSettingsBtn = document.querySelector('.capsule-widget button[title*="Pengaturan"]');
  const dropdownSettingsBtn = document.querySelector('#dropdown-profile-card button[onclick*="openModalSettings"]');
  const dropdownExportBtn = document.querySelector('#dropdown-profile-card button[onclick*="exportKaryawanCSV"]');

  // Breadcrumb portal title
  const breadcrumbCategory = document.querySelector('header .text-slate-400 span:first-child');
  const presensiFormsContainer = document.getElementById('presensi-forms-container');
  const presensiSummaryCards = document.getElementById('presensi-summary-cards');
  const presensiTableContainer = document.getElementById('presensi-table-container');
  const presensiTableTitle = document.getElementById('presensi-table-title');
  const thAksi = document.getElementById('th-presensi-aksi');

  if (isKaryawan) {
    // Role: Karyawan (portal mandiri untuk absen)
    if (navKaryawan) navKaryawan.classList.add('hidden');
    if (navStats) navStats.classList.add('hidden');
    if (navAbout) navAbout.classList.add('hidden');
    if (capsuleSettingsBtn) capsuleSettingsBtn.classList.add('hidden');
    if (dropdownSettingsBtn) dropdownSettingsBtn.classList.add('hidden');
    if (dropdownExportBtn) dropdownExportBtn.classList.add('hidden');

    if (navPresensi) {
      navPresensi.classList.remove('hidden');
      const presensiBtn = document.getElementById('sidebar-nav-presensi');
      if (presensiBtn) presensiBtn.title = 'Portal Absensi Mandiri Karyawan';
    }

    // 3. Tampilkan Form Absensi Pribadi
    if (presensiFormsContainer) presensiFormsContainer.classList.remove('hidden');

    // 4. SEMBUNYIKAN KARTU KPI RINGKASAN & TABEL PRESENSI UNTUK KARYAWAN
    // Sesuai instruksi: "pada hak akses akun karyawan tolong hapus tabel tabel ini, karna tabel ini khusus ditampilkan untuk admin"
    // dan "untuk karyawan hanya terdapat tampilan untuk absen saja"
    if (presensiSummaryCards) presensiSummaryCards.classList.add('hidden');
    if (presensiTableContainer) presensiTableContainer.classList.add('hidden');

    // Kunci ID Card & Nama Karyawan ke profil yang login
    const presensiHidden = document.getElementById('presensi-select-karyawan');
    const presensiInput = document.getElementById('presensi-input-idcard');
    const hintEl = document.getElementById('presensi-idcard-hint');
    const badgeNama = document.getElementById('badge-emp-nama');
    const badgeId = document.getElementById('badge-emp-idcard');
    const badgeJab = document.getElementById('badge-emp-jabatan');
    const badgeAvatar = document.getElementById('badge-emp-avatar');
    const badgeCard = document.getElementById('presensi-employee-badge');

    if (presensiHidden) presensiHidden.value = currentAuthUser.karyawan_id;
    if (presensiInput) {
      presensiInput.value = currentAuthUser.nik;
      presensiInput.readOnly = true;
      presensiInput.classList.add('bg-slate-100', 'cursor-not-allowed');
    }
    if (badgeNama) badgeNama.textContent = currentAuthUser.nama;
    if (badgeId) badgeId.textContent = currentAuthUser.nik;
    if (badgeJab) badgeJab.textContent = (currentAuthUser.jabatan || 'Staff') + (currentAuthUser.departemen ? ` • ${currentAuthUser.departemen}` : '');
    if (badgeAvatar) {
      if (currentAuthUser.foto) {
        badgeAvatar.innerHTML = `<img src="/uploads/${currentAuthUser.foto}" alt="${escapeHtml(currentAuthUser.nama)}" class="w-full h-full object-cover rounded-lg">`;
      } else {
        badgeAvatar.innerHTML = initial;
      }
    }
    if (badgeCard) badgeCard.classList.remove('hidden');
    if (hintEl) hintEl.classList.add('hidden');

    // Kunci ID Card di Form Absen Pulang
    const pulangHidden = document.getElementById('pulang-select-karyawan');
    const pulangInput = document.getElementById('pulang-input-idcard');
    if (pulangHidden) pulangHidden.value = currentAuthUser.karyawan_id;
    if (pulangInput) {
      pulangInput.value = currentAuthUser.nik;
      pulangInput.readOnly = true;
      pulangInput.classList.add('bg-slate-100', 'cursor-not-allowed');
    }

    if (breadcrumbCategory) breadcrumbCategory.textContent = 'Portal Karyawan';
    if (thAksi) thAksi.classList.add('hidden');

    // Alihkan langsung ke tab Presensi
    switchTab('presensi');
  } else {
    // Role: Admin (semua manajemen & pelaporan kecuali form absen)
    if (navKaryawan) navKaryawan.classList.remove('hidden');
    if (navPresensi) {
      navPresensi.classList.remove('hidden');
      const presensiBtn = document.getElementById('sidebar-nav-presensi');
      if (presensiBtn) presensiBtn.title = 'Daftar Presensi Karyawan';
    }
    if (navStats) navStats.classList.remove('hidden');
    if (navAbout) navAbout.classList.remove('hidden');
    if (capsuleSettingsBtn) capsuleSettingsBtn.classList.remove('hidden');
    if (dropdownSettingsBtn) dropdownSettingsBtn.classList.remove('hidden');
    if (dropdownExportBtn) dropdownExportBtn.classList.remove('hidden');

    // 2. SEMBUNYIKAN FITUR ABSEN UNTUK ADMIN!
    // Sesuai permintaan: "dan untuk admin menampilkan semua fitur kecuali fitur absen, hanya ada tabel daftar karyawan yang sudah absen hadir dan pulang"
    if (presensiFormsContainer) presensiFormsContainer.classList.add('hidden');

    // 3. TAMPILKAN KARTU KPI RINGKASAN & TABEL PRESENSI UNTUK ADMIN
    if (presensiSummaryCards) presensiSummaryCards.classList.remove('hidden');
    if (presensiTableContainer) presensiTableContainer.classList.remove('hidden');

    // Kembalikan form ID Card presensi jika admin ingin membukanya nanti
    const presensiInput = document.getElementById('presensi-input-idcard');
    if (presensiInput) {
      presensiInput.readOnly = false;
      presensiInput.classList.remove('bg-slate-100', 'cursor-not-allowed');
    }

    // 4. Tampilkan kembali kolom Aksi & judul tabel
    if (presensiTableTitle) presensiTableTitle.textContent = 'Log & Riwayat Presensi Karyawan';
    if (breadcrumbCategory) breadcrumbCategory.textContent = 'Portal SDM';
    if (thAksi) thAksi.classList.remove('hidden');
  }

  // Settings Modal Info
  const setUsername = document.getElementById('settings-user-username');
  const setNama = document.getElementById('settings-user-nama');
  const setUnit = document.getElementById('settings-user-unit');
  if (setUsername) setUsername.textContent = currentAuthUser.username || '-';
  if (setNama) setNama.textContent = currentAuthUser.nama || '-';
  if (setUnit) setUnit.textContent = currentAuthUser.unit || 'Aero Corporation - Kantor Pusat';
}

// Switch between Login and Register Tabs (Matching Gambar 1)
function switchAuthTab(tab) {
  const loginBtn = document.getElementById('tab-btn-login');
  const regBtn = document.getElementById('tab-btn-register');
  const loginForm = document.getElementById('form-login');
  const regForm = document.getElementById('form-register');

  if (tab === 'login') {
    loginBtn.className = 'flex-1 py-2 rounded-md font-bold text-xs sm:text-sm text-slate-900 bg-white shadow-xs transition duration-150';
    regBtn.className = 'flex-1 py-2 rounded-md font-semibold text-xs sm:text-sm text-slate-600 hover:text-slate-900 transition duration-150';
    loginForm?.classList.remove('hidden');
    regForm?.classList.add('hidden');
  } else {
    regBtn.className = 'flex-1 py-2 rounded-md font-bold text-xs sm:text-sm text-slate-900 bg-white shadow-xs transition duration-150';
    loginBtn.className = 'flex-1 py-2 rounded-md font-semibold text-xs sm:text-sm text-slate-600 hover:text-slate-900 transition duration-150';
    regForm?.classList.remove('hidden');
    loginForm?.classList.add('hidden');
  }
}

// Handle Login Submit (Matching Gambar 1 "••• Memverifikasi...")
async function handleLoginSubmit(e) {
  e.preventDefault();
  const usernameOrEmail = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const submitBtn = document.getElementById('btn-login-submit');

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span>••• Memverifikasi...</span>`;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail, password })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    currentAuthUser = json.data;
    localStorage.setItem('aero_auth_user', JSON.stringify(currentAuthUser));

    applyAuthenticatedUserUI();

    Swal.fire({
      icon: 'success',
      title: 'Login Berhasil!',
      text: `Selamat datang kembali, ${currentAuthUser.nama || currentAuthUser.username}!`,
      timer: 1600,
      showConfirmButton: false
    });

    document.getElementById('login-view')?.classList.add('hidden');
    document.getElementById('app-layout')?.classList.remove('hidden');

    if (currentAuthUser.role === 'KARYAWAN') {
      switchTab('presensi');
      fetchPresensiTodaySummary();
      populatePresensiDropdowns();
      populatePulangDropdown();
      fetchPresensi(1);
    } else {
      updateSidebarNavState('karyawan');
      fetchStats();
      fetchKaryawan(1);
      fetchPresensiTodaySummary();
      populatePresensiDropdowns();
      populatePulangDropdown();
    }

  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Login Gagal',
      text: err.message,
      confirmButtonColor: '#0284c7'
    });
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>Login</span>`;
  }
}

// Handle Register Submit
async function handleRegisterSubmit(e) {
  e.preventDefault();
  const nama = document.getElementById('reg-nama').value;
  const username = document.getElementById('reg-username').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const submitBtn = document.getElementById('btn-reg-submit');

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span>Mendaftarkan...</span>`;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama, username, email, password })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    Swal.fire({
      icon: 'success',
      title: 'Pendaftaran Berhasil!',
      text: 'Akun Anda berhasil dibuat. Silakan login.',
      confirmButtonColor: '#0284c7'
    });

    document.getElementById('login-username').value = username;
    document.getElementById('login-password').value = password;
    switchAuthTab('login');
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Pendaftaran Gagal',
      text: err.message,
      confirmButtonColor: '#0284c7'
    });
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>Daftar Akun Baru</span>`;
  }
}

// Handle Forgot Password Click
function handleForgotPassword() {
  Swal.fire({
    title: 'Lupa Kata Sandi?',
    html: `
      <div class="text-left text-xs text-slate-600 space-y-2">
        <p>Silakan hubungi Administrator SDM Aero Corporation atau kirim email ke: <strong>support@aerocorp.co.id</strong>.</p>
        <div class="p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <p class="font-bold text-blue-900">Kredensial Bawaan (Default):</p>
          <p>Username / Email: <span class="font-mono font-bold text-blue-700">admin</span></p>
          <p>Password: <span class="font-mono font-bold text-blue-700">admin</span></p>
        </div>
      </div>
    `,
    icon: 'info',
    confirmButtonColor: '#0284c7',
    confirmButtonText: 'Tutup'
  });
}

// Handle Logout
function confirmLogout() {
  document.getElementById('dropdown-profile-card')?.classList.add('hidden');
  document.getElementById('dropdown-notifications')?.classList.add('hidden');

  Swal.fire({
    title: 'Keluar dari Akun?',
    text: 'Apakah Anda yakin ingin mengakhiri sesi login saat ini?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#e11d48',
    cancelButtonColor: '#64748b',
    confirmButtonText: '<i class="fa-solid fa-arrow-right-from-bracket mr-1"></i> Ya, Keluar',
    cancelButtonText: 'Batal'
  }).then((result) => {
    if (result.isConfirmed) {
      localStorage.removeItem('aero_auth_user');
      currentAuthUser = null;
      showLoginView();
      Swal.fire({
        icon: 'success',
        title: 'Berhasil Keluar',
        text: 'Sesi Anda telah ditutup dengan aman.',
        timer: 1500,
        showConfirmButton: false
      });
    }
  });
}

// Notification Dropdown Toggle (Matching Gambar 3)
async function toggleNotificationDropdown(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('dropdown-notifications');
  const profileCard = document.getElementById('dropdown-profile-card');
  if (profileCard) profileCard.classList.add('hidden');

  if (!dropdown) return;
  const isHidden = dropdown.classList.contains('hidden');

  if (isHidden) {
    dropdown.classList.remove('hidden');
    const listEl = document.getElementById('notifications-list');
    if (listEl) {
      try {
        const res = await fetch('/api/notifications');
        const json = await res.json();
        if (json.success && json.data.length > 0) {
          listEl.innerHTML = json.data.map(n => `
            <div class="p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50/50 border border-slate-100 flex items-start space-x-2.5 transition">
              <div class="w-7 h-7 rounded-lg ${n.color} flex items-center justify-center shrink-0 text-xs">
                <i class="fa-solid ${n.icon}"></i>
              </div>
              <div class="flex-1 overflow-hidden">
                <div class="flex items-center justify-between">
                  <h5 class="font-bold text-slate-800 text-[11px] truncate">${escapeHtml(n.title)}</h5>
                  <span class="text-[9px] text-slate-500">${escapeHtml(n.time)}</span>
                </div>
                <p class="text-[10px] text-slate-600 mt-0.5 leading-snug">${escapeHtml(n.desc)}</p>
              </div>
            </div>
          `).join('');
        }
      } catch (err) {
        listEl.innerHTML = '<p class="text-[11px] text-slate-500 italic">Gagal memuat notifikasi.</p>';
      }
    }
  } else {
    dropdown.classList.add('hidden');
  }
}

// Profile Dropdown Card Toggle (Matching Gambar 3)
function toggleProfileDropdown(e) {
  if (e) e.stopPropagation();
  const card = document.getElementById('dropdown-profile-card');
  const notifDropdown = document.getElementById('dropdown-notifications');
  if (notifDropdown) notifDropdown.classList.add('hidden');

  if (!card) return;
  card.classList.toggle('hidden');
}

// Settings Modal Handlers (Containing CSV Export & Office GPS Configuration)
async function openModalSettings() {
  document.getElementById('dropdown-profile-card')?.classList.add('hidden');
  applyAuthenticatedUserUI();
  document.getElementById('modal-settings')?.classList.remove('hidden');

  // Load current office location into form
  try {
    const res = await fetch('/api/office-location');
    const json = await res.json();
    if (json.success && json.data) {
      const office = json.data;
      officeConfigCache = office;
      const nameInp = document.getElementById('office-input-name');
      const radiusInp = document.getElementById('office-input-radius');
      const latInp = document.getElementById('office-input-lat');
      const lngInp = document.getElementById('office-input-lng');
      const hint = document.getElementById('office-current-coords-hint');

      if (nameInp) nameInp.value = office.nama_kantor || '';
      if (radiusInp) radiusInp.value = office.radius_meter || 200;
      if (latInp) latInp.value = office.latitude != null ? office.latitude : '';
      if (lngInp) lngInp.value = office.longitude != null ? office.longitude : '';
      if (hint) hint.textContent = `Titik aktif: ${office.latitude}, ${office.longitude} (Radius: ${office.radius_meter}m)`;
    }
  } catch (e) {
    console.error('Gagal memuat setting kantor:', e);
  }

  // Load audit logs automatically
  loadAuditLogs();
}

function closeModalSettings() {
  document.getElementById('modal-settings')?.classList.add('hidden');
}

// Handle Save Office Location (Admin)
async function handleSaveOfficeLocation(e) {
  e.preventDefault();
  const nama_kantor = document.getElementById('office-input-name').value;
  const radius_meter = document.getElementById('office-input-radius').value;
  const latitude = document.getElementById('office-input-lat').value;
  const longitude = document.getElementById('office-input-lng').value;
  const btn = document.getElementById('btn-save-office-loc');

  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/office-location', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama_kantor, radius_meter, latitude, longitude })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    officeConfigCache = json.data;
    Swal.fire({
      icon: 'success',
      title: 'Titik Kantor Disimpan!',
      text: `Lokasi ${json.data.nama_kantor} berhasil diatur pada koordinat (${json.data.latitude}, ${json.data.longitude}) radius ${json.data.radius_meter}m.`,
      timer: 2500,
      showConfirmButton: false
    });

    const hint = document.getElementById('office-current-coords-hint');
    if (hint) hint.textContent = `Titik aktif: ${json.data.latitude}, ${json.data.longitude} (Radius: ${json.data.radius_meter}m)`;

    // Refresh current GPS status against new office coords
    detectGPSLocation(false);
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Gagal Menyimpan Lokasi Kantor',
      text: err.message,
      confirmButtonColor: '#2563eb'
    });
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Set Office Location using Admin's current GPS position
function setOfficeLocationFromCurrentGPS() {
  if (!navigator.geolocation) {
    Swal.fire({ icon: 'error', title: 'GPS Tidak Didukung', text: 'Browser tidak mendukung GPS.' });
    return;
  }
  Swal.fire({
    title: 'Mendeteksi Posisi Anda...',
    text: 'Mengambil koordinat GPS lokasi perangkat Anda saat ini.',
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });

  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const latInp = document.getElementById('office-input-lat');
      const lngInp = document.getElementById('office-input-lng');
      if (latInp) latInp.value = lat;
      if (lngInp) lngInp.value = lng;
      Swal.fire({
        icon: 'success',
        title: 'Koordinat Ditemukan!',
        html: `Lokasi Anda: <strong>${lat.toFixed(6)}, ${lng.toFixed(6)}</strong> telah disalin ke input form. Silakan klik tombol <strong>Simpan Titik Kantor</strong> untuk menetapkannya.`,
        confirmButtonColor: '#2563eb'
      });
    },
    err => {
      Swal.fire({
        icon: 'warning',
        title: 'Izin Lokasi Diperlukan',
        text: 'Tidak dapat mendeteksi koordinat: ' + err.message,
        confirmButtonColor: '#2563eb'
      });
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// Handle Import CSV Submit
async function handleImportCsvSubmit(e) {
  e.preventDefault();
  const fileInput = document.getElementById('input-import-csv');
  const btn = document.getElementById('btn-submit-import-csv');
  const originalBtn = btn ? btn.innerHTML : '';

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Pilih File CSV',
      text: 'Silakan pilih file berformat .csv terlebih dahulu.',
      confirmButtonColor: '#4f46e5'
    });
    return;
  }

  const file = fileInput.files[0];
  if (!file.name.toLowerCase().endsWith('.csv')) {
    Swal.fire({
      icon: 'error',
      title: 'Format File Salah',
      text: 'Mohon unggah file dengan format .csv yang valid.',
      confirmButtonColor: '#4f46e5'
    });
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i>Mengimpor...`;
  }

  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/import/csv', {
      method: 'POST',
      body: formData
    });

    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    Swal.fire({
      icon: 'success',
      title: 'Impor CSV Berhasil!',
      html: `
        <div class="text-xs text-left space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200 mt-2">
          <p class="font-bold text-slate-800">${escapeHtml(json.message)}</p>
          <div class="flex items-center space-x-4 pt-1 text-xs">
            <span class="text-emerald-600 font-bold"><i class="fa-solid fa-circle-plus mr-1"></i>${json.data.inserted} Data Baru</span>
            <span class="text-blue-600 font-bold"><i class="fa-solid fa-arrows-rotate mr-1"></i>${json.data.updated} Diperbarui</span>
          </div>
        </div>
      `,
      confirmButtonColor: '#4f46e5'
    });

    // Reset file input
    fileInput.value = '';

    // Refresh Dashboard & Table Data
    fetchStats();
    fetchKaryawan(1);
    populatePresensiDropdowns();
    populatePulangDropdown();
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Gagal Impor CSV',
      text: err.message,
      confirmButtonColor: '#4f46e5'
    });
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalBtn;
    }
  }
}

// Change Password Modal Handlers
function openModalChangePassword() {
  document.getElementById('dropdown-profile-card')?.classList.add('hidden');
  const form = document.getElementById('form-change-password');
  if (form) form.reset();
  document.getElementById('modal-change-password')?.classList.remove('hidden');
}

function closeModalChangePassword() {
  document.getElementById('modal-change-password')?.classList.add('hidden');
}

async function handleChangePasswordSubmit(e) {
  e.preventDefault();
  if (!currentAuthUser) return;

  const oldPassword = document.getElementById('cp-old-password').value;
  const newPassword = document.getElementById('cp-new-password').value;
  const confirmPassword = document.getElementById('cp-confirm-password').value;
  const submitBtn = document.getElementById('btn-submit-cp');

  if (newPassword !== confirmPassword) {
    Swal.fire({ icon: 'warning', title: 'Kata Sandi Tidak Cocok', text: 'Konfirmasi kata sandi baru harus sama dengan kata sandi baru!', confirmButtonColor: '#0284c7' });
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span>Menyimpan...</span>';

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentAuthUser.id, oldPassword, newPassword })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    closeModalChangePassword();
    Swal.fire({
      icon: 'success',
      title: 'Kata Sandi Diperbarui!',
      text: json.message,
      confirmButtonColor: '#0284c7'
    });
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Gagal Ganti Kata Sandi', text: err.message, confirmButtonColor: '#0284c7' });
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>Simpan Kata Sandi</span>';
  }
}

// Help Guide Modal Handlers
function openModalHelpGuide() {
  document.getElementById('dropdown-profile-card')?.classList.add('hidden');
  document.getElementById('modal-help-guide')?.classList.remove('hidden');
}

function closeModalHelpGuide() {
  document.getElementById('modal-help-guide')?.classList.add('hidden');
}

// Setup Keyboard Shortcuts (e.g. Ctrl+K to search)
function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const input = document.getElementById('filter-search');
      if (input) {
        input.focus();
        input.select();
      }
    }
  });
}

// Server Time Sync & GPS Geolocation (Anti-tamper clock)
async function syncServerTime() {
  try {
    const reqStart = Date.now();
    const res = await fetch('/api/time');
    const json = await res.json();
    const reqEnd = Date.now();
    const latency = Math.round((reqEnd - reqStart) / 2);
    if (json.success && json.server_time_ms) {
      serverTimeOffsetMs = (json.server_time_ms + latency) - reqEnd;
      isServerTimeSynced = true;
    }
  } catch (e) {
    console.warn('Gagal sinkronisasi waktu server:', e);
  }
}

// Get verified real-time Date object
function getServerNow() {
  return new Date(Date.now() + serverTimeOffsetMs);
}

// Fetch office location coordinates & radius from server
async function fetchOfficeLocation() {
  try {
    const res = await fetch('/api/office-location');
    const json = await res.json();
    if (json.success) {
      officeConfigCache = json.data;
    }
  } catch (e) {
    console.error('Gagal mengambil titik kantor:', e);
  }
}

// Calculate distance between two GPS coordinates in meters (Haversine formula)
function calculateClientDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371e3;
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Detect GPS location from browser Geolocation API
function detectGPSLocation(showToast = false) {
  const badgeEl = document.getElementById('gps-status-badge');
  const distanceEl = document.getElementById('gps-distance-text');
  const coordsEl = document.getElementById('gps-coords-display');
  const btn = document.getElementById('btn-detect-gps');
  const mapLink = document.getElementById('gps-map-link');

  const latInput = document.getElementById('presensi-latitude');
  const lngInput = document.getElementById('presensi-longitude');
  const lokasiInput = document.getElementById('presensi-lokasi');

  if (!navigator.geolocation) {
    if (badgeEl) {
      badgeEl.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300';
      badgeEl.textContent = 'GPS Tidak Didukung';
    }
    if (distanceEl) distanceEl.textContent = 'Browser Anda tidak mendukung Geolocation.';
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i><span>Mendeteksi...</span>`;
  }
  if (badgeEl) {
    badgeEl.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200';
    badgeEl.textContent = 'Mencari Koordinat...';
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const acc = Math.round(position.coords.accuracy);

      currentGPSLocation.latitude = lat;
      currentGPSLocation.longitude = lng;
      currentGPSLocation.accuracy = acc;

      if (latInput) latInput.value = lat;
      if (lngInput) lngInput.value = lng;

      let distance = null;
      let isOffice = false;
      const office = officeConfigCache || { latitude: -6.3148979, longitude: 106.8382681, radius_meter: 200, nama_kantor: 'Kantor Pusat Aero Corporation' };

      if (office && office.latitude != null && office.longitude != null) {
        distance = calculateClientDistance(lat, lng, office.latitude, office.longitude);
        currentGPSLocation.distanceMeters = distance;
        isOffice = distance <= office.radius_meter;
        currentGPSLocation.isAtOffice = isOffice;
        currentGPSLocation.statusLokasi = isOffice ? 'Di Kantor' : 'Di Luar Kantor';
      }

      if (lokasiInput) lokasiInput.value = isOffice ? office.nama_kantor : 'Di Luar Kantor';

      if (badgeEl) {
        if (isOffice) {
          badgeEl.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300';
          badgeEl.innerHTML = `<i class="fa-solid fa-building mr-1"></i>Di Kantor (${distance}m)`;
        } else {
          badgeEl.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300';
          const distLabel = distance >= 1000 ? (distance / 1000).toFixed(1) + ' km' : `${distance} m`;
          badgeEl.innerHTML = `<i class="fa-solid fa-location-dot mr-1"></i>Di Luar Kantor (${distLabel})`;
        }
      }

      if (distanceEl) {
        distanceEl.textContent = isOffice 
          ? `Terverifikasi dalam radius ${office.radius_meter}m dari ${office.nama_kantor}`
          : `Berada di luar radius kantor (${office.nama_kantor})`;
      }

      if (coordsEl) {
        coordsEl.textContent = `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)} (±${acc}m)`;
      }

      if (mapLink) {
        mapLink.href = `https://www.google.com/maps?q=${lat},${lng}`;
        mapLink.classList.remove('hidden');
      }

      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-check mr-1 text-emerald-600"></i><span>Cek Lokasi</span>`;
      }

      if (showToast) {
        Swal.fire({
          icon: isOffice ? 'success' : 'info',
          title: isOffice ? 'Lokasi Valid: Di Kantor' : 'Lokasi: Di Luar Kantor',
          html: `Titik GPS terdeteksi: <strong>${lat.toFixed(5)}, ${lng.toFixed(5)}</strong><br>Jarak ke kantor: <strong>${distance} meter</strong> (Radius batas: ${office.radius_meter}m).`,
          timer: 3000,
          showConfirmButton: false
        });
      }
    },
    error => {
      console.warn('Geolocation error:', error);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1 text-amber-600"></i><span>Coba Lagi</span>`;
      }
      if (badgeEl) {
        badgeEl.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300';
        badgeEl.textContent = 'Izin Lokasi Ditolak';
      }
      if (distanceEl) {
        distanceEl.textContent = 'Mohon izinkan akses lokasi (GPS) pada browser agar verifikasi kantor terbaca.';
      }
      if (showToast) {
        Swal.fire({
          icon: 'warning',
          title: 'Izin Lokasi Diperlukan',
          text: 'Browser menolak izin lokasi. Silakan klik ikon gembok di address bar dan aktifkan perizinan Lokasi (Location) untuk situs ini.',
          confirmButtonColor: '#2563eb'
        });
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// Display Current Date in Indonesian (Using Server Verified Date)
function displayCurrentDate() {
  const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Jakarta' };
  const today = getServerNow().toLocaleDateString('id-ID', options);
  const el = document.getElementById('current-date');
  if (el) el.textContent = today;

  const presensiDateEl = document.getElementById('presensi-live-date');
  if (presensiDateEl) presensiDateEl.textContent = today;
}

// Live Clock & Time-based Greeting (Server Real-time Sync - Tamper Proof)
function startLiveClockAndGreeting() {
  const clockEl = document.getElementById('live-clock');
  const greetingEl = document.getElementById('hero-greeting');
  const presensiClockEl = document.getElementById('presensi-live-clock');
  const hadirLiveTime = document.getElementById('form-hadir-live-time');
  const pulangLiveTime = document.getElementById('pulang-info-jam-pulang');

  function update() {
    const now = getServerNow();
    const formatterTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const currentHms = formatterTime.format(now);
    const timeStr = `${currentHms} WIB`;

    if (clockEl) clockEl.textContent = timeStr;
    if (presensiClockEl) presensiClockEl.textContent = timeStr;
    if (pulangLiveTime) pulangLiveTime.textContent = timeStr;

    if (hadirLiveTime) {
      const isPast830 = currentHms > '08:30:00';
      const infoHadirCard = document.getElementById('section-info-hadir');
      const infoHadirDesc = infoHadirCard ? infoHadirCard.querySelector('p:nth-child(2)') : null;
      const hadirIconContainer = infoHadirCard ? infoHadirCard.querySelector('div:first-child') : null;

      if (isPast830) {
        hadirLiveTime.innerHTML = `${currentHms} WIB <span class="ml-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-300">Terlambat</span>`;
        hadirLiveTime.className = 'font-mono text-xs sm:text-sm font-extrabold text-amber-800 ml-1';
        if (infoHadirDesc) infoHadirDesc.textContent = 'Waktu server telah melewati pukul 08:30:00 WIB, kehadiran akan otomatis tercatat sebagai Terlambat.';
        if (infoHadirCard) {
          infoHadirCard.className = 'p-4 bg-amber-50/90 border border-amber-300 rounded-2xl flex items-center space-x-3.5 transition';
        }
        if (hadirIconContainer) {
          hadirIconContainer.className = 'w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm text-base';
        }
      } else {
        hadirLiveTime.innerHTML = `${currentHms} WIB <span class="ml-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-300">Tepat Waktu</span>`;
        hadirLiveTime.className = 'font-mono text-xs sm:text-sm font-extrabold text-emerald-800 ml-1';
        if (infoHadirDesc) infoHadirDesc.textContent = 'Jam presensi kehadiran diambil langsung dari server secara real-time saat Anda menekan tombol Simpan.';
        if (infoHadirCard) {
          infoHadirCard.className = 'p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-center space-x-3.5 transition';
        }
        if (hadirIconContainer) {
          hadirIconContainer.className = 'w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm text-base';
        }
      }
    }

    if (greetingEl) {
      const h = parseInt(currentHms.slice(0, 2), 10);
      let greeting = 'Selamat Datang, Tim HR! 👋';
      if (h >= 4 && h < 11) {
        greeting = 'Selamat Pagi, Tim HR! 🌅';
      } else if (h >= 11 && h < 15) {
        greeting = 'Selamat Siang, Tim HR! ☀️';
      } else if (h >= 15 && h < 18) {
        greeting = 'Selamat Sore, Tim HR! 🌇';
      } else {
        greeting = 'Selamat Malam, Tim HR! 🌙';
      }
      greetingEl.innerHTML = `${greeting}`;
    }
  }

  update();
  setInterval(update, 1000);
}

// Update Slim Sidebar Nav State (Matching Reference Image)
function updateSidebarNavState(activeTab) {
  const navItems = [
    { id: 'karyawan', icon: 'fa-users', title: 'Data Karyawan' },
    { id: 'presensi', icon: 'fa-id-badge', title: 'Presensi Karyawan' },
    { id: 'stats', icon: 'fa-chart-pie', title: 'Statistik & Payroll' },
    { id: 'about', icon: 'fa-circle-info', title: 'Tentang Aero Corporation' }
  ];

  navItems.forEach(item => {
    const wrapper = document.getElementById(`nav-wrapper-${item.id}`);
    if (!wrapper) return;

    if (item.id === activeTab) {
      wrapper.innerHTML = `
        <button id="sidebar-nav-${item.id}" onclick="switchTab('${item.id}')" title="${item.title}" class="nav-icon-active-outer">
          <span class="nav-icon-active-inner"><i class="fa-solid ${item.icon}"></i></span>
        </button>
      `;
    } else {
      wrapper.innerHTML = `
        <button id="sidebar-nav-${item.id}" onclick="switchTab('${item.id}')" title="${item.title}" class="nav-icon-inactive">
          <i class="fa-solid ${item.icon}"></i>
        </button>
      `;
    }
  });
}

// Mobile Sidebar Toggle (for responsive screens)
function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar-container');
  const overlay = document.getElementById('mobile-sidebar-overlay');
  if (!sidebar || !overlay) return;

  const isClosed = sidebar.classList.contains('-translate-x-full');
  if (isClosed) {
    sidebar.classList.remove('-translate-x-full');
    overlay.classList.remove('hidden');
  } else {
    sidebar.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
  }
}

// Switch Navigation Tabs
function switchTab(tab) {
  const isKaryawan = currentAuthUser && currentAuthUser.role === 'KARYAWAN';

  // If user is Karyawan, they are restricted strictly to Presensi tab
  if (isKaryawan) {
    tab = 'presensi';
  }

  const tabs = ['karyawan', 'presensi', 'stats', 'about'];
  const breadcrumbTitles = {
    'karyawan': 'Data Karyawan',
    'presensi': isKaryawan ? 'Portal Absensi Mandiri' : 'Daftar Presensi Karyawan',
    'stats': 'Statistik & Payroll',
    'about': 'Tentang Aero Corporation'
  };

  const breadcrumbEl = document.getElementById('breadcrumb-title');
  if (breadcrumbEl && breadcrumbTitles[tab]) {
    breadcrumbEl.textContent = breadcrumbTitles[tab];
  }

  tabs.forEach(t => {
    const content = document.getElementById(`tab-content-${t}`);
    if (content) {
      if (t === tab) {
        content.classList.remove('hidden');
      } else {
        content.classList.add('hidden');
      }
    }
  });

  // Ensure presensi form, summary KPI cards, and table visibility matches role requirement:
  // Karyawan: Hanya fitur absen saja (sembunyikan KPI cards & tabel)
  // Admin: Tampilkan semua kecuali fitur absen (tampilkan KPI cards & tabel)
  const presensiForms = document.getElementById('presensi-forms-container');
  const presensiSummaryCards = document.getElementById('presensi-summary-cards');
  const presensiTableContainer = document.getElementById('presensi-table-container');

  if (presensiForms) {
    if (isKaryawan) {
      presensiForms.classList.remove('hidden');
    } else {
      presensiForms.classList.add('hidden');
    }
  }

  if (presensiSummaryCards) {
    if (isKaryawan) {
      presensiSummaryCards.classList.add('hidden');
    } else {
      presensiSummaryCards.classList.remove('hidden');
    }
  }

  if (presensiTableContainer) {
    if (isKaryawan) {
      presensiTableContainer.classList.add('hidden');
    } else {
      presensiTableContainer.classList.remove('hidden');
    }
  }

  // Update slim sidebar active indicator
  updateSidebarNavState(tab);

  // Close mobile sidebar if open
  const sidebar = document.getElementById('sidebar-container');
  if (window.innerWidth < 768 && sidebar && !sidebar.classList.contains('-translate-x-full')) {
    toggleMobileSidebar();
  }

  if (tab === 'presensi') {
    populatePresensiDropdowns();
    populatePulangDropdown();
    if (!isKaryawan) {
      fetchPresensiTodaySummary();
      fetchPresensi(1);
    }
    detectGPSLocation(false);
    const formTgl = document.getElementById('form-presensi-input-tanggal');
    if (formTgl && !formTgl.value) {
      formTgl.value = new Date().toISOString().slice(0, 10);
    }
  } else if (tab === 'stats') {
    fetchStats();
  }
}

// 1. STATISTIK & METRIK (DASHBOARD)

async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    const json = await res.json();
    if (!json.success) return;

    const stats = json.data;
    const statTotal = document.getElementById('stat-total');
    const statAktif = document.getElementById('stat-aktif');
    const statCuti = document.getElementById('stat-cuti');
    const statMagang = document.getElementById('stat-magang');

    if (statTotal) statTotal.textContent = stats.totalKaryawan;
    if (statAktif) statAktif.textContent = stats.karyawanAktif;
    if (statCuti) statCuti.textContent = stats.karyawanCuti;
    if (statMagang) statMagang.textContent = stats.karyawanMagang;

    const badgeTotal = document.getElementById('sidebar-badge-total');
    if (badgeTotal) badgeTotal.textContent = stats.totalKaryawan;

    const totalGajiEl = document.getElementById('stat-total-gaji');
    const avgGajiEl = document.getElementById('stat-avg-gaji');
    if (totalGajiEl) totalGajiEl.textContent = formatRupiah(stats.totalGaji);
    if (avgGajiEl) avgGajiEl.textContent = `Rata-rata: ${formatRupiah(stats.avgGaji)} / orang`;

    // Populate Quick Department Strip
    const deptStrip = document.getElementById('quick-dept-strip');
    if (deptStrip) {
      if (!stats.departemenDistribusi || stats.departemenDistribusi.length === 0) {
        deptStrip.innerHTML = '<span class="text-xs text-slate-500 italic">Belum ada data divisi. Silakan tambahkan karyawan baru.</span>';
      } else {
        deptStrip.innerHTML = stats.departemenDistribusi.map(d => {
          let icon = 'fa-briefcase';
          let badgeColor = 'bg-slate-100 text-slate-700';
          if (d.departemen === 'Teknologi Informasi') {
            icon = 'fa-code';
            badgeColor = 'bg-sky-50 text-sky-700 border border-sky-200/60';
          } else if (d.departemen === 'Human Resources') {
            icon = 'fa-users';
            badgeColor = 'bg-purple-50 text-purple-700 border border-purple-200/60';
          } else if (d.departemen === 'Keuangan & Akuntansi') {
            icon = 'fa-coins';
            badgeColor = 'bg-emerald-50 text-emerald-700 border border-emerald-200/60';
          } else if (d.departemen === 'Pemasaran & Digital') {
            icon = 'fa-bullhorn';
            badgeColor = 'bg-pink-50 text-pink-700 border border-pink-200/60';
          } else if (d.departemen === 'Operasional & Logistik') {
            icon = 'fa-truck-fast';
            badgeColor = 'bg-amber-50 text-amber-700 border border-amber-200/60';
          } else if (d.departemen === 'Pengembangan Usaha') {
            icon = 'fa-chart-line';
            badgeColor = 'bg-blue-50 text-blue-700 border border-blue-200/60';
          }
          return `
            <div class="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl ${badgeColor} text-xs font-bold shadow-2xs">
              <i class="fa-solid ${icon} text-[10px]"></i>
              <span class="truncate max-w-[140px]">${d.departemen}</span>
              <span class="px-1.5 py-0.2 rounded-full bg-white/80 font-black text-[11px] shadow-2xs">${d.count}</span>
            </div>
          `;
        }).join('');
      }
    }

    renderCharts(stats);
  } catch (err) {
    console.error('Gagal mengambil statistik:', err);
  }
}

// Render Chart.js
function renderCharts(stats) {
  // Chart Departemen
  const deptCtx = document.getElementById('chart-departemen');
  if (deptCtx) {
    if (chartDepartemenInstance) {
      chartDepartemenInstance.destroy();
    }
    const labels = (stats.departemenDistribusi || []).map(d => d.departemen);
    const data = (stats.departemenDistribusi || []).map(d => d.count);

    chartDepartemenInstance = new Chart(deptCtx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: [
            '#1d4ed8', '#0284c7', '#0f766e', '#d97706', '#475569', '#6366f1', '#334155'
          ],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, font: { size: 11, family: '"Plus Jakarta Sans", sans-serif' } }
          }
        },
        cutout: '68%'
      }
    });
  }

  // Chart Status Kepegawaian
  const statusCtx = document.getElementById('chart-status');
  if (statusCtx) {
    if (chartStatusInstance) {
      chartStatusInstance.destroy();
    }
    const labels = (stats.statusDistribusi || []).map(s => s.status_kepegawaian);
    const data = (stats.statusDistribusi || []).map(s => s.count);

    chartStatusInstance = new Chart(statusCtx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Jumlah Karyawan',
          data: data,
          backgroundColor: ['#1d4ed8', '#0284c7', '#475569'],
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0, font: { family: '"Plus Jakarta Sans", sans-serif' } },
            grid: { color: 'rgba(226, 232, 240, 0.6)' }
          },
          x: {
            grid: { display: false },
            ticks: { font: { family: '"Plus Jakarta Sans", sans-serif' } }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }
}

// 2. DATA KARYAWAN (CRUD & TABEL)

async function fetchKaryawan(page = currentPage) {
  currentPage = page;
  const tbody = document.getElementById('table-karyawan-body');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="8" class="text-center py-12 text-slate-500">
        <i class="fa-solid fa-spinner fa-spin text-2xl mb-2 text-blue-600"></i>
        <p class="text-xs font-medium">Memuat data karyawan...</p>
      </td>
    </tr>
  `;

  const search = document.getElementById('filter-search')?.value || '';
  const departemen = document.getElementById('filter-departemen')?.value || '';
  const status_kerja = document.getElementById('filter-status-kerja')?.value || '';
  const status_kepegawaian = document.getElementById('filter-status-kepegawaian')?.value || '';
  const limit = document.getElementById('filter-limit')?.value || '10';

  // Toggle clear search button
  const clearBtn = document.getElementById('btn-clear-search');
  if (clearBtn) {
    if (search.trim()) {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }
  }

  const queryParams = new URLSearchParams({
    search,
    departemen,
    status_kerja,
    status_kepegawaian,
    sort_by: currentSort,
    order: currentOrder,
    page: currentPage,
    limit: limit
  });

  try {
    const res = await fetch(`/api/karyawan?${queryParams.toString()}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    currentKaryawanList = json.data;
    renderTable(json.data, json.pagination);
    renderPagination(json.pagination);

    const infoCount = document.getElementById('table-info-count');
    if (infoCount) {
      infoCount.textContent = `Total ${json.pagination.totalItems} karyawan terdaftar di database`;
    }

  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-10 text-rose-500">
          <i class="fa-solid fa-circle-exclamation text-2xl mb-2"></i>
          <p class="text-xs font-semibold">Terjadi kesalahan: ${err.message}</p>
        </td>
      </tr>
    `;
  }
}

// Render Table Rows (Modern Tech / SaaS Layout)
function renderTable(data, pagination) {
  const tbody = document.getElementById('table-karyawan-body');
  if (!tbody) return;

  if (data.length === 0) {
    const isFiltered = Boolean(
      (document.getElementById('filter-search') && document.getElementById('filter-search').value.trim()) ||
      (document.getElementById('filter-departemen') && document.getElementById('filter-departemen').value) ||
      (document.getElementById('filter-status-kerja') && document.getElementById('filter-status-kerja').value) ||
      (document.getElementById('filter-status-kepegawaian') && document.getElementById('filter-status-kepegawaian').value)
    );

    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-16 text-slate-400">
          <div class="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl mx-auto mb-3 shadow-inner">
            <i class="fa-solid fa-box-open"></i>
          </div>
          <h4 class="text-sm font-bold text-slate-700">${isFiltered ? 'Tidak ada data karyawan yang cocok' : 'Belum Ada Data Karyawan'}</h4>
          <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">${isFiltered ? 'Coba sesuaikan kata kunci pencarian atau ubah filter Anda.' : 'Database saat ini kosong. Silakan mulai menambahkan data karyawan perdana Aero Corporation.'}</p>
          <div class="mt-4 flex items-center justify-center space-x-2">
            ${isFiltered ? `<button onclick="resetFilter()" class="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"><i class="fa-solid fa-arrow-rotate-left mr-1"></i> Reset Filter</button>` : ''}
            <button onclick="openModalTambah()" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition">
              <i class="fa-solid fa-plus mr-1.5"></i> Tambah Karyawan Baru
            </button>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  const offset = pagination.limit === 'all' ? 0 : (pagination.page - 1) * pagination.limit;

  tbody.innerHTML = data.map((item, index) => {
    const no = offset + index + 1;
    const initial = getInitials(item.nama);
    
    // Status keaktifan badge (with dot)
    let statusKerjaBadge = '';
    if (item.status_kerja === 'Aktif') {
      statusKerjaBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-xs">
        <span class="w-1.5 h-1.5 mr-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Aktif
      </span>`;
    } else if (item.status_kerja === 'Cuti') {
      statusKerjaBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
        <span class="w-1.5 h-1.5 mr-1.5 rounded-full bg-amber-500"></span> Cuti
      </span>`;
    } else {
      statusKerjaBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
        <span class="w-1.5 h-1.5 mr-1.5 rounded-full bg-slate-400"></span> Nonaktif
      </span>`;
    }

    // Status kepegawaian badge
    let statusPegawaiBadge = '';
    if (item.status_kepegawaian === 'Tetap') {
      statusPegawaiBadge = `<span class="px-2.5 py-1 text-[11px] font-extrabold rounded-lg bg-blue-50 text-blue-700 border border-blue-200/50">Tetap</span>`;
    } else if (item.status_kepegawaian === 'Kontrak') {
      statusPegawaiBadge = `<span class="px-2.5 py-1 text-[11px] font-extrabold rounded-lg bg-teal-50 text-teal-700 border border-teal-200/50">Kontrak</span>`;
    } else {
      statusPegawaiBadge = `<span class="px-2.5 py-1 text-[11px] font-extrabold rounded-lg bg-purple-50 text-purple-700 border border-purple-200/50 flex items-center justify-center space-x-1 mx-auto max-w-[80px]">
        <i class="fa-solid fa-graduation-cap text-[10px]"></i>
        <span>Magang</span>
      </span>`;
    }

    // Department color coded pill
    const deptPill = getDepartmentBadge(item.departemen);

    // Avatar with status ring
    const avatarHtml = item.foto 
      ? `<img src="/uploads/${item.foto}" alt="${item.nama}" class="w-10 h-10 rounded-lg object-cover border border-slate-200 shadow-2xs shrink-0">`
      : `<div class="w-10 h-10 rounded-lg bg-blue-700 text-white font-extrabold flex items-center justify-center text-xs shrink-0 shadow-2xs">${initial}</div>`;

    return `
      <tr class="hover:bg-slate-50/80 transition duration-150 group">
        <td class="py-3.5 px-4 text-center font-bold text-slate-500 text-xs">${no}</td>
        
        <!-- Karyawan Profile & NIK -->
        <td class="py-3.5 px-4">
          <div class="flex items-center space-x-3">
            <div class="relative">
              ${avatarHtml}
              <span class="w-2.5 h-2.5 rounded-full ${item.status_kerja === 'Aktif' ? 'bg-emerald-500' : (item.status_kerja === 'Cuti' ? 'bg-amber-500' : 'bg-slate-400')} border-2 border-white absolute -bottom-0.5 -right-0.5"></span>
            </div>
            <div>
              <div class="font-extrabold text-slate-900 group-hover:text-blue-600 cursor-pointer transition flex items-center space-x-1.5" onclick="openModalDetail(${item.id})">
                <span>${escapeHtml(item.nama)}</span>
              </div>
              <div class="flex items-center space-x-2 text-xs text-slate-500 mt-1">
                <span class="font-mono whitespace-nowrap bg-slate-100 px-2 py-0.5 rounded-md text-[11px] text-slate-700 font-bold border border-slate-200/80 shadow-2xs">${item.nik}</span>
                <span>&bull;</span>
                <span class="truncate max-w-[170px] text-[11px] text-slate-600 font-medium">${escapeHtml(item.email)}</span>
              </div>
            </div>
          </div>
        </td>

        <!-- Departemen & Jabatan -->
        <td class="py-3.5 px-4">
          <div class="font-bold text-slate-800 text-xs sm:text-sm">${escapeHtml(item.jabatan)}</div>
          <div class="mt-1">${deptPill}</div>
        </td>

        <!-- Status Pegawai -->
        <td class="py-3.5 px-4 text-center">
          ${statusPegawaiBadge}
        </td>

        <!-- Status Kerja -->
        <td class="py-3.5 px-4 text-center">
          ${statusKerjaBadge}
        </td>

        <!-- Tanggal Masuk -->
        <td class="py-3.5 px-4 text-xs font-medium text-slate-600 whitespace-nowrap">
          <i class="fa-regular fa-calendar text-slate-500 mr-1 text-[11px]"></i>${formatDateIndo(item.tanggal_masuk)}
        </td>

        <!-- Gaji Pokok -->
        <td class="py-3.5 px-4 text-right font-extrabold text-slate-800 text-xs sm:text-sm font-mono whitespace-nowrap">
          ${formatRupiah(item.gaji)}
        </td>

        <!-- Aksi Buttons -->
        <td class="py-3.5 px-4 text-center">
          <div class="flex items-center justify-center space-x-1.5">
            <button onclick="openModalSlipGaji(${item.id})" title="Cetak Slip Gaji Digital" class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition shadow-xs">
              <i class="fa-solid fa-file-invoice-dollar text-xs"></i>
            </button>
            <button onclick="openModalDetail(${item.id})" title="Lihat & Cetak ID Card" class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition shadow-xs">
              <i class="fa-solid fa-id-badge text-xs"></i>
            </button>
            <button onclick="openModalEdit(${item.id})" title="Edit Data" class="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white flex items-center justify-center transition shadow-xs">
              <i class="fa-solid fa-pen text-xs"></i>
            </button>
            <button onclick="confirmDelete(${item.id}, '${escapeHtml(item.nama)}', '${item.nik}')" title="Hapus Data" class="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white flex items-center justify-center transition shadow-xs">
              <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Department Color & Icon Helper
function getDepartmentBadge(dept) {
  if (dept === 'Teknologi Informasi') {
    return `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200/60">
      <i class="fa-solid fa-code text-[9px] mr-1"></i> TI & Sistem
    </span>`;
  } else if (dept === 'Human Resources') {
    return `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200/60">
      <i class="fa-solid fa-users text-[9px] mr-1"></i> Human Resources
    </span>`;
  } else if (dept === 'Keuangan & Akuntansi') {
    return `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
      <i class="fa-solid fa-coins text-[9px] mr-1"></i> Keuangan
    </span>`;
  } else if (dept === 'Pemasaran & Digital') {
    return `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-pink-50 text-pink-700 border border-pink-200/60">
      <i class="fa-solid fa-bullhorn text-[9px] mr-1"></i> Pemasaran
    </span>`;
  } else if (dept === 'Operasional & Logistik') {
    return `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
      <i class="fa-solid fa-truck-fast text-[9px] mr-1"></i> Operasional
    </span>`;
  } else if (dept === 'Pengembangan Usaha') {
    return `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
      <i class="fa-solid fa-chart-line text-[9px] mr-1"></i> Bisnis Dev
    </span>`;
  } else {
    return `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
      <i class="fa-solid fa-briefcase text-[9px] mr-1"></i> ${escapeHtml(dept || 'Umum')}
    </span>`;
  }
}

// Render Pagination controls
function renderPagination(p) {
  const container = document.getElementById('pagination-controls');
  const info = document.getElementById('pagination-info');
  if (!container || !info) return;

  if (p.totalItems === 0) {
    info.textContent = 'Menampilkan 0 dari 0 data';
    container.innerHTML = '';
    return;
  }

  const start = (p.page - 1) * p.limit + 1;
  const end = Math.min(p.page * p.limit, p.totalItems);
  info.textContent = `Menampilkan ${start} - ${end} dari total ${p.totalItems} data`;

  let buttons = '';
  // Prev button
  buttons += `
    <button 
      onclick="fetchKaryawan(${p.page - 1})" 
      ${p.page <= 1 ? 'disabled' : ''} 
      class="w-8 h-8 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition"
    >
      <i class="fa-solid fa-chevron-left text-[10px]"></i>
    </button>
  `;

  // Page Numbers
  for (let i = 1; i <= p.totalPages; i++) {
    if (i === p.page) {
      buttons += `<button class="w-8 h-8 rounded-lg bg-blue-600 text-white text-xs font-black shadow-sm">${i}</button>`;
    } else if (i === 1 || i === p.totalPages || (i >= p.page - 1 && i <= p.page + 1)) {
      buttons += `<button onclick="fetchKaryawan(${i})" class="w-8 h-8 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition">${i}</button>`;
    } else if (i === p.page - 2 || i === p.page + 2) {
      buttons += `<span class="px-1 text-slate-300 text-xs">...</span>`;
    }
  }

  // Next button
  buttons += `
    <button 
      onclick="fetchKaryawan(${p.page + 1})" 
      ${p.page >= p.totalPages ? 'disabled' : ''} 
      class="w-8 h-8 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition"
    >
      <i class="fa-solid fa-chevron-right text-[10px]"></i>
    </button>
  `;

  container.innerHTML = buttons;
}

// Toggle Sort
function toggleSort(column) {
  if (currentSort === column) {
    currentOrder = currentOrder === 'ASC' ? 'DESC' : 'ASC';
  } else {
    currentSort = column;
    currentOrder = 'ASC';
  }

  // Reset all sort icons
  ['nama', 'departemen', 'tanggal_masuk', 'gaji'].forEach(col => {
    const icon = document.getElementById(`sort-icon-${col}`);
    if (icon) {
      if (col === currentSort) {
        icon.className = currentOrder === 'ASC' ? 'fa-solid fa-sort-up text-blue-600 ml-1' : 'fa-solid fa-sort-down text-blue-600 ml-1';
      } else {
        icon.className = 'fa-solid fa-sort text-slate-300 ml-1';
      }
    }
  });

  fetchKaryawan(1);
}

// Debounce search
function debounceSearch() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    fetchKaryawan(1);
  }, 350);
}

// Clear Search Input
function clearSearchInput() {
  const input = document.getElementById('filter-search');
  if (input) input.value = '';
  const btn = document.getElementById('btn-clear-search');
  if (btn) btn.classList.add('hidden');
  fetchKaryawan(1);
}

// Reset filters
function resetFilter() {
  const search = document.getElementById('filter-search');
  const dept = document.getElementById('filter-departemen');
  const sk = document.getElementById('filter-status-kerja');
  const sp = document.getElementById('filter-status-kepegawaian');
  const limit = document.getElementById('filter-limit');
  const btn = document.getElementById('btn-clear-search');

  if (search) search.value = '';
  if (dept) dept.value = '';
  if (sk) sk.value = '';
  if (sp) sp.value = '';
  if (limit) limit.value = '10';
  if (btn) btn.classList.add('hidden');

  currentSort = 'created_at';
  currentOrder = 'DESC';
  fetchKaryawan(1);
}

// Auto generate ID Card (AC0001, AC0002, ...) for Aero Corporation
async function generateNikAuto() {
  const nikInput = document.getElementById('form-nik');
  try {
    const res = await fetch('/api/karyawan/next-id');
    const json = await res.json();
    if (json.success && json.data && json.data.nextId) {
      if (nikInput) nikInput.value = json.data.nextId;
      return;
    }
  } catch (err) {
    console.warn('Gagal fetch next-id dari server:', err);
  }
  if (nikInput && !nikInput.value) {
    nikInput.value = 'AC0006';
  }
}

// Preview uploaded photo
function handlePreviewImage(input) {
  const previewImg = document.getElementById('form-preview-foto');
  const previewIcon = document.getElementById('form-preview-icon');
  
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (previewImg) {
        previewImg.src = e.target.result;
        previewImg.classList.remove('hidden');
      }
      if (previewIcon) previewIcon.classList.add('hidden');
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// Mapping Departemen ke Opsi Jabatan / Posisi (Sesuai kebutuhan divisi: Direktur, Manager, Ass Manager, Staff)
const jabatanByDepartemen = {
  'Direksi & Manajemen Eksekutif': [
    'Direktur Utama (CEO)',
    'Direktur Operasional (COO)',
    'Direktur Teknologi (CTO)',
    'Direktur Keuangan (CFO)',
    'Direktur Pengembangan Usaha (CBO)'
  ],
  'Teknologi Informasi': [
    'Manager IT',
    'Ass. Manager IT',
    'Staff IT (Software Engineer)',
    'Staff IT (Frontend Developer)',
    'Staff IT (Backend Developer)',
    'Staff IT (Mobile Developer)',
    'Staff IT (UI/UX Designer)',
    'Staff IT (DevOps & Sysadmin)',
    'Staff IT (QA Tester & Support)'
  ],
  'Human Resources': [
    'Manager HR',
    'Ass. Manager HR',
    'Staff HR (Rekrutmen & Talent Acquisition)',
    'Staff HR (Personalia & Administrasi)',
    'Staff HR (Pelatihan & People Development)',
    'Staff HR (Kompensasi & Benefit)'
  ],
  'Keuangan & Akuntansi': [
    'Manager Keuangan & Akuntansi',
    'Ass. Manager Keuangan & Akuntansi',
    'Staff Akuntansi & Pajak',
    'Staff Keuangan & Kasir',
    'Staff Payroll & Penggajian',
    'Staff Analis Finansial'
  ],
  'Pemasaran & Digital': [
    'Manager Pemasaran & Digital',
    'Ass. Manager Pemasaran & Digital',
    'Staff Digital Marketing & Ads',
    'Staff Media Sosial & Konten Kreator',
    'Staff Desain Grafis & Kreatif',
    'Staff Copywriter & Komunikasi'
  ],
  'Operasional & Logistik': [
    'Manager Operasional & Logistik',
    'Ass. Manager Operasional & Logistik',
    'Staff Operasional',
    'Staff Logistik & Gudang',
    'Staff Pengadaan & Supply Chain',
    'Staff General Affairs (GA)'
  ],
  'Pengembangan Usaha': [
    'Manager Pengembangan Usaha',
    'Ass. Manager Pengembangan Usaha',
    'Staff Business Development',
    'Staff Sales & Kerjasama Bisnis',
    'Staff Riset Pasar & Kemitraan'
  ]
};

// Update Dropdown Jabatan Options based on Departemen
function updateJabatanOptions(dept = null, selectedJabatan = null) {
  const deptSelect = document.getElementById('form-departemen');
  const jabatanSelect = document.getElementById('form-jabatan');
  if (!jabatanSelect) return;

  const currentDept = dept !== null ? dept : (deptSelect ? deptSelect.value : '');
  let optionsHtml = '';

  if (!currentDept) {
    optionsHtml = '<option value="">-- Pilih Departemen Terlebih Dahulu --</option>';
    for (const [d, jabatans] of Object.entries(jabatanByDepartemen)) {
      optionsHtml += `<optgroup label="${d}">`;
      jabatans.forEach(j => {
        const isSelected = selectedJabatan && selectedJabatan === j;
        optionsHtml += `<option value="${escapeHtml(j)}" ${isSelected ? 'selected' : ''}>${escapeHtml(j)}</option>`;
      });
      optionsHtml += '</optgroup>';
    }
  } else {
    optionsHtml = '<option value="">-- Pilih Jabatan / Posisi --</option>';
    const list = jabatanByDepartemen[currentDept] || [];
    let found = false;
    list.forEach(j => {
      const isSelected = selectedJabatan && selectedJabatan === j;
      if (isSelected) found = true;
      optionsHtml += `<option value="${escapeHtml(j)}" ${isSelected ? 'selected' : ''}>${escapeHtml(j)}</option>`;
    });

    // If existing value is not in default array, retain it so no data is lost
    if (selectedJabatan && !found) {
      optionsHtml += `<option value="${escapeHtml(selectedJabatan)}" selected>${escapeHtml(selectedJabatan)}</option>`;
    }
  }

  jabatanSelect.innerHTML = optionsHtml;
  if (selectedJabatan) {
    jabatanSelect.value = selectedJabatan;
  }
}

// Handler when user changes Departemen dropdown
function handleDepartemenChange() {
  updateJabatanOptions();
}

// Open Modal Tambah
function openModalTambah() {
  const form = document.getElementById('form-karyawan');
  if (form) form.reset();

  const formId = document.getElementById('form-id');
  if (formId) formId.value = '';

  const modalTitle = document.getElementById('modal-title');
  if (modalTitle) modalTitle.textContent = 'Tambah Karyawan Baru';

  const previewImg = document.getElementById('form-preview-foto');
  const previewIcon = document.getElementById('form-preview-icon');
  if (previewImg) {
    previewImg.src = '';
    previewImg.classList.add('hidden');
  }
  if (previewIcon) previewIcon.classList.remove('hidden');

  const tglMasuk = document.getElementById('form-tanggal-masuk');
  if (tglMasuk) tglMasuk.value = new Date().toISOString().slice(0, 10);

  generateNikAuto();
  updateJabatanOptions('');

  const modal = document.getElementById('modal-form-karyawan');
  if (modal) modal.classList.remove('hidden');
}

// Open Modal Edit
async function openModalEdit(id) {
  try {
    const res = await fetch(`/api/karyawan/${id}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    const data = json.data;
    document.getElementById('form-id').value = data.id;
    document.getElementById('form-nik').value = data.nik;
    document.getElementById('form-nama').value = data.nama;
    document.getElementById('form-email').value = data.email;
    document.getElementById('form-telepon').value = data.telepon;
    document.getElementById('form-jenis-kelamin').value = data.jenis_kelamin;
    document.getElementById('form-departemen').value = data.departemen;
    updateJabatanOptions(data.departemen, data.jabatan);
    document.getElementById('form-status-kepegawaian').value = data.status_kepegawaian;
    document.getElementById('form-status-kerja').value = data.status_kerja;
    document.getElementById('form-tanggal-masuk').value = data.tanggal_masuk;
    document.getElementById('form-gaji').value = data.gaji;
    document.getElementById('form-alamat').value = data.alamat || '';

    // Handle foto preview
    const previewImg = document.getElementById('form-preview-foto');
    const previewIcon = document.getElementById('form-preview-icon');
    if (data.foto) {
      previewImg.src = `/uploads/${data.foto}`;
      previewImg.classList.remove('hidden');
      previewIcon.classList.add('hidden');
    } else {
      previewImg.src = '';
      previewImg.classList.add('hidden');
      previewIcon.classList.remove('hidden');
    }

    document.getElementById('modal-title').textContent = 'Perbarui Data Karyawan';
    document.getElementById('modal-form-karyawan').classList.remove('hidden');
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Gagal Membuka Form',
      text: err.message,
      confirmButtonColor: '#2563eb'
    });
  }
}

// Close Modal Form
function closeModalForm() {
  const modal = document.getElementById('modal-form-karyawan');
  if (modal) modal.classList.add('hidden');
}

// Handle Form Submit (Tambah or Edit)
async function handleSubmitForm(e) {
  e.preventDefault();
  const form = document.getElementById('form-karyawan');
  const id = document.getElementById('form-id').value;
  const isEdit = Boolean(id);

  const formData = new FormData(form);
  const btnSubmit = document.getElementById('form-btn-submit');
  const originalBtnHtml = btnSubmit.innerHTML;

  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> <span>Menyimpan...</span>`;

  try {
    const url = isEdit ? `/api/karyawan/${id}` : '/api/karyawan';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      body: formData
    });

    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    closeModalForm();
    Swal.fire({
      icon: 'success',
      title: isEdit ? 'Berhasil Diperbarui!' : 'Berhasil Ditambahkan!',
      text: json.message,
      timer: 2000,
      showConfirmButton: false
    });

    fetchKaryawan(isEdit ? currentPage : 1);
    fetchStats();
    populatePresensiDropdowns();
    fetchPresensiTodaySummary();
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Terjadi Kesalahan',
      text: err.message,
      confirmButtonColor: '#2563eb'
    });
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = originalBtnHtml;
  }
}

// Confirm Delete with SweetAlert2
function confirmDelete(id, nama, nik) {
  Swal.fire({
    title: 'Hapus Data Karyawan?',
    html: `Apakah Anda yakin ingin menghapus data <strong>${nama}</strong> (ID Card: ${nik})?<br><span class="text-xs text-rose-500">Tindakan ini permanen dan riwayat presensi terkait akan dihapus.</span>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#e11d48',
    cancelButtonColor: '#64748b',
    confirmButtonText: '<i class="fa-solid fa-trash-can mr-1"></i> Ya, Hapus',
    cancelButtonText: 'Batal'
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/karyawan/${id}`, { method: 'DELETE' });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);

        Swal.fire({
          icon: 'success',
          title: 'Terhapus!',
          text: json.message,
          timer: 2000,
          showConfirmButton: false
        });

        fetchKaryawan(currentPage);
        fetchStats();
        populatePresensiDropdowns();
        fetchPresensiTodaySummary();
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Gagal Menghapus',
          text: err.message,
          confirmButtonColor: '#2563eb'
        });
      }
    }
  });
}

let currentDetailKaryawanId = null;

// Open Modal Detail (Digital ID Card)
async function openModalDetail(id) {
  try {
    currentDetailKaryawanId = id;
    const res = await fetch(`/api/karyawan/${id}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    const k = json.data;
    document.getElementById('detail-nama').textContent = k.nama;
    document.getElementById('detail-nik').textContent = k.nik;
    document.getElementById('detail-jabatan').textContent = k.jabatan;
    document.getElementById('detail-departemen').textContent = k.departemen;
    document.getElementById('detail-email').textContent = k.email;
    document.getElementById('detail-telepon').textContent = k.telepon;
    document.getElementById('detail-tgl-masuk').textContent = formatDateIndo(k.tanggal_masuk);
    document.getElementById('detail-status-kerja').textContent = k.status_kerja;
    document.getElementById('detail-alamat').textContent = k.alamat || 'Tidak dicantumkan';
    document.getElementById('detail-card-badge').textContent = (k.status_kepegawaian || 'TETAP').toUpperCase();

    // Foto
    const fotoImg = document.getElementById('detail-foto');
    const fotoIcon = document.getElementById('detail-foto-icon');
    if (k.foto) {
      fotoImg.src = `/uploads/${k.foto}`;
      fotoImg.classList.remove('hidden');
      fotoIcon.classList.add('hidden');
    } else {
      fotoImg.src = '';
      fotoImg.classList.add('hidden');
      fotoIcon.classList.remove('hidden');
    }

    document.getElementById('modal-detail-karyawan').classList.remove('hidden');
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Gagal Memuat Detail',
      text: err.message,
      confirmButtonColor: '#2563eb'
    });
  }
}

// Close Modal Detail
function closeModalDetail() {
  const modal = document.getElementById('modal-detail-karyawan');
  if (modal) modal.classList.add('hidden');
}

// Print ID Card
function printIdCard() {
  document.body.classList.add('printing-id-card');
  window.print();
  document.body.classList.remove('printing-id-card');
}

// ================= MODUL 1: LOGIKA SLIP GAJI DIGITAL ================= //
let currentSlipKaryawanId = null;

async function openModalSlipGaji(karyawanId, defaultBulan = '') {
  currentSlipKaryawanId = karyawanId;
  const modal = document.getElementById('modal-slip-gaji');
  if (!modal) return;
  modal.classList.remove('hidden');

  const monthInput = document.getElementById('slip-filter-bulan');
  if (monthInput) {
    if (defaultBulan) {
      monthInput.value = defaultBulan;
    } else if (!monthInput.value) {
      const now = new Date();
      const yr = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      monthInput.value = `${yr}-${mo}`;
    }
  }

  await fetchSlipGajiData();
}

function openModalSlipGajiFromDetail() {
  if (currentDetailKaryawanId) {
    closeModalDetail();
    openModalSlipGaji(currentDetailKaryawanId);
  }
}

function closeModalSlipGaji() {
  const modal = document.getElementById('modal-slip-gaji');
  if (modal) modal.classList.add('hidden');
}

async function fetchSlipGajiData() {
  if (!currentSlipKaryawanId) return;
  const monthInput = document.getElementById('slip-filter-bulan');
  const bulan = monthInput?.value || '';

  try {
    const res = await fetch(`/api/karyawan/${currentSlipKaryawanId}/slip-gaji?bulan=${bulan}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    const d = json.data;
    document.getElementById('slip-nomor').textContent = d.nomor_slip;
    
    // Format Month name in Indonesian (e.g. November 2026)
    const [y, m] = d.periode.split('-');
    const monthNamesIndo = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const monthName = monthNamesIndo[parseInt(m) - 1] || m;
    document.getElementById('slip-periode-label').textContent = `Periode: ${monthName} ${y}`;

    // Identitas Karyawan
    document.getElementById('slip-karyawan-nama').textContent = d.karyawan.nama;
    document.getElementById('slip-karyawan-nik').textContent = d.karyawan.nik;
    document.getElementById('slip-karyawan-jabatan').textContent = d.karyawan.jabatan;
    document.getElementById('slip-karyawan-departemen').textContent = d.karyawan.departemen;
    document.getElementById('slip-sign-karyawan').textContent = d.karyawan.nama;

    // Rekap Kehadiran
    document.getElementById('slip-presensi-hadir').textContent = d.rekap_presensi.total_hadir;
    document.getElementById('slip-presensi-terlambat').textContent = d.rekap_presensi.terlambat;
    document.getElementById('slip-presensi-izin').textContent = d.rekap_presensi.izin + d.rekap_presensi.sakit;

    // Rincian Penerimaan
    document.getElementById('slip-val-gaji-pokok').textContent = formatRupiah(d.rincian_penerimaan.gaji_pokok);
    document.getElementById('slip-val-tunj-jabatan').textContent = formatRupiah(d.rincian_penerimaan.tunjangan_jabatan);
    document.getElementById('slip-val-tunj-kehadiran').textContent = formatRupiah(d.rincian_penerimaan.tunjangan_kehadiran);
    document.getElementById('slip-val-tunj-komunikasi').textContent = formatRupiah(d.rincian_penerimaan.tunjangan_komunikasi);
    document.getElementById('slip-val-total-penerimaan').textContent = formatRupiah(d.rincian_penerimaan.total_penerimaan);

    // Rincian Potongan
    document.getElementById('slip-val-pot-terlambat').textContent = formatRupiah(d.rincian_potongan.potongan_terlambat);
    document.getElementById('slip-val-pot-bpjs').textContent = formatRupiah(d.rincian_potongan.bpjs_ketenagakerjaan);
    document.getElementById('slip-val-total-potongan').textContent = formatRupiah(d.rincian_potongan.total_potongan);

    // Gaji Bersih
    document.getElementById('slip-val-gaji-bersih').textContent = formatRupiah(d.gaji_bersih);
    document.getElementById('slip-tanggal-cetak').textContent = `Tanggal: ${d.tanggal_cetak} (WIB)`;
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Gagal Memuat Slip Gaji',
      text: err.message,
      confirmButtonColor: '#1d4ed8'
    });
  }
}

function printSlipGaji() {
  document.body.classList.add('printing-slip');
  window.print();
  document.body.classList.remove('printing-slip');
}

// ================= MODUL 2: LOGIKA REKAPITULASI BULANAN ================= //
let currentPresensiSubTab = 'daily';

function switchPresensiSubTab(tab) {
  currentPresensiSubTab = tab;
  const btnDaily = document.getElementById('btn-subtab-daily');
  const btnMonthly = document.getElementById('btn-subtab-monthly');
  const viewDaily = document.getElementById('presensi-subview-daily');
  const viewMonthly = document.getElementById('presensi-subview-monthly');

  if (tab === 'daily') {
    if (btnDaily) btnDaily.className = 'flex-1 sm:flex-none px-3 py-1.5 rounded-md bg-white text-slate-900 shadow-2xs font-bold transition flex items-center justify-center space-x-1.5';
    if (btnMonthly) btnMonthly.className = 'flex-1 sm:flex-none px-3 py-1.5 rounded-md text-slate-600 hover:text-slate-900 transition flex items-center justify-center space-x-1.5';
    viewDaily?.classList.remove('hidden');
    viewMonthly?.classList.add('hidden');
    fetchPresensi(currentPresensiPage);
  } else {
    if (btnDaily) btnDaily.className = 'flex-1 sm:flex-none px-3 py-1.5 rounded-md text-slate-600 hover:text-slate-900 transition flex items-center justify-center space-x-1.5';
    if (btnMonthly) btnMonthly.className = 'flex-1 sm:flex-none px-3 py-1.5 rounded-md bg-white text-slate-900 shadow-2xs font-bold transition flex items-center justify-center space-x-1.5';
    viewDaily?.classList.add('hidden');
    viewMonthly?.classList.remove('hidden');

    const filterMonth = document.getElementById('filter-rekap-bulan');
    if (filterMonth && !filterMonth.value) {
      const now = new Date();
      const yr = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      filterMonth.value = `${yr}-${mo}`;
    }
    fetchRekapBulanan();
  }
}

async function fetchRekapBulanan() {
  const tbody = document.getElementById('table-rekap-monthly-body');
  const summaryInfo = document.getElementById('rekap-summary-info');
  const exportBtn = document.getElementById('btn-export-rekap-csv');
  const filterMonth = document.getElementById('filter-rekap-bulan')?.value || '';
  const filterDept = document.getElementById('filter-rekap-departemen')?.value || '';

  if (exportBtn) {
    exportBtn.href = `/api/export/presensi/rekap/csv?bulan=${filterMonth}`;
  }

  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Menghitung rekapitulasi performa presensi seluruh staf...</td></tr>`;
  }

  try {
    const res = await fetch(`/api/presensi/rekap-bulanan?bulan=${filterMonth}&departemen=${encodeURIComponent(filterDept)}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    const data = json.data || [];
    if (summaryInfo) {
      summaryInfo.textContent = `Menampilkan rekapitulasi ${data.length} karyawan aktif periode ${json.bulan}.`;
    }

    if (data.length === 0) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-500">Tidak ada data karyawan ditemukan.</td></tr>`;
      return;
    }

    if (tbody) {
      tbody.innerHTML = data.map((item, idx) => {
        let badgeScore = 'bg-emerald-50 text-emerald-800 border-emerald-200';
        let statusText = 'Sangat Baik';
        if (item.persentase_kehadiran < 70) {
          badgeScore = 'bg-rose-50 text-rose-800 border-rose-200';
          statusText = 'Perlu Evaluasi';
        } else if (item.persentase_kehadiran < 85) {
          badgeScore = 'bg-amber-50 text-amber-800 border-amber-200';
          statusText = 'Cukup';
        }

        return `
          <tr class="hover:bg-slate-50 transition duration-150">
            <td class="py-3 px-4 text-center font-bold text-slate-500 text-xs">${idx + 1}</td>
            <td class="py-3 px-4">
              <div class="font-bold text-slate-900">${escapeHtml(item.nama)}</div>
              <div class="text-[11px] font-mono text-blue-700 font-semibold">${escapeHtml(item.nik)}</div>
            </td>
            <td class="py-3 px-4">
              <div class="text-xs text-slate-800 font-medium">${escapeHtml(item.departemen)}</div>
              <div class="text-[11px] text-slate-500">${escapeHtml(item.jabatan)}</div>
            </td>
            <td class="py-3 px-4 text-center font-bold text-emerald-700 font-mono">${item.tepat_waktu}</td>
            <td class="py-3 px-4 text-center font-bold ${item.terlambat > 0 ? 'text-amber-700 font-mono' : 'text-slate-400'}">${item.terlambat}</td>
            <td class="py-3 px-4 text-center font-bold ${item.izin + item.sakit > 0 ? 'text-sky-700 font-mono' : 'text-slate-400'}">${item.izin + item.sakit}</td>
            <td class="py-3 px-4 text-center font-black text-slate-900 font-mono">${item.total_hadir} hr</td>
            <td class="py-3 px-4 text-center">
              <div class="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeScore}">
                <span>${item.persentase_kehadiran}%</span>
                <span class="text-[10px] font-medium opacity-80">(${statusText})</span>
              </div>
            </td>
            <td class="py-3 px-4 text-center">
              <button onclick="openModalSlipGaji(${item.karyawan_id}, '${json.bulan}')"
                class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1 mx-auto shadow-2xs">
                <i class="fa-solid fa-file-invoice-dollar text-[11px]"></i>
                <span>Slip Gaji</span>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-rose-600">Gagal memuat rekap: ${escapeHtml(err.message)}</td></tr>`;
    }
  }
}

// ================= MODUL 4: LOGIKA AUDIT TRAIL ================= //
async function loadAuditLogs() {
  const container = document.getElementById('audit-log-container');
  if (!container) return;
  container.innerHTML = '<div class="text-slate-500 italic p-2 bg-white rounded border border-slate-200 text-center">Memuat riwayat audit...</div>';
  try {
    const res = await fetch('/api/audit-logs?limit=30');
    const json = await res.json();
    if (!json.success || !json.data || json.data.length === 0) {
      container.innerHTML = '<div class="text-slate-500 p-2 bg-white rounded border border-slate-200 text-center">Belum ada riwayat aktivitas yang tercatat.</div>';
      return;
    }

    container.innerHTML = json.data.map(log => {
      let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
      if (log.action.includes('LOGIN')) badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
      else if (log.action.includes('CREATE') || log.action.includes('INIT')) badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      else if (log.action.includes('UPDATE') || log.action.includes('SLIP')) badgeColor = 'bg-sky-50 text-sky-700 border-sky-200';
      else if (log.action.includes('DELETE')) badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';

      const timeStr = log.created_at ? log.created_at.replace('T', ' ').slice(0, 19) : '-';

      return `
        <div class="p-2 rounded bg-white border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5 hover:bg-slate-50 transition">
          <div class="flex items-center space-x-2">
            <span class="px-1.5 py-0.5 rounded text-[9px] font-bold border ${badgeColor} font-sans uppercase">${escapeHtml(log.action)}</span>
            <span class="text-slate-800 font-semibold">${escapeHtml(log.detail || '-')}</span>
          </div>
          <div class="flex items-center space-x-2 text-slate-500 text-[10px] shrink-0 font-mono">
            <span>${escapeHtml(log.username || 'System')}</span>
            <span>&bull;</span>
            <span>${timeStr}</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="text-rose-600 p-2 bg-white rounded border border-rose-200 text-center">Gagal memuat log: ${escapeHtml(err.message)}</div>`;
  }
}

// 3. FITUR PRESENSI & ABSENSI KARYAWAN

let currentPresensiKaryawanList = [];

// Populate Dropdown & Datalist Karyawan for Presensi & Modals
async function populatePresensiDropdowns() {
  try {
    const res = await fetch('/api/karyawan?status_kerja=Aktif&limit=all&sort_by=nama&order=ASC');
    const json = await res.json();
    if (!json.success) return;

    const list = json.data || [];
    currentPresensiKaryawanList = list;

    // Populate datalist for typing ID Card
    const datalist = document.getElementById('list-idcard-karyawan');
    if (datalist) {
      datalist.innerHTML = list.map(k => 
        `<option value="${k.nik}">${escapeHtml(k.nama)} - ${escapeHtml(k.jabatan)}</option>`
      ).join('');
    }

    const makeOptions = (defaultLabel) => {
      let html = `<option value="">${defaultLabel}</option>`;
      list.forEach(k => {
        html += `<option value="${k.id}">${escapeHtml(k.nama)} (${k.nik}) - ${escapeHtml(k.jabatan)}</option>`;
      });
      return html;
    };

    const presensiSelect = document.getElementById('presensi-select-karyawan');
    const manualSelect = document.getElementById('manual-karyawan-id');
    const izinSelect = document.getElementById('izin-karyawan-id');

    if (presensiSelect && presensiSelect.tagName === 'SELECT') presensiSelect.innerHTML = makeOptions('-- Pilih Karyawan Aktif --');
    if (manualSelect) manualSelect.innerHTML = makeOptions('-- Pilih Karyawan --');
    if (izinSelect) izinSelect.innerHTML = makeOptions('-- Pilih Karyawan --');
  } catch (err) {
    console.error('Gagal memuat daftar karyawan untuk presensi:', err);
  }
}

// Search & auto display employee name by typing ID Card (e.g. AC0001)
function handleSearchKaryawanByIdCard(val) {
  const hiddenInput = document.getElementById('presensi-select-karyawan');
  const badgeCard = document.getElementById('presensi-employee-badge');
  const hintEl = document.getElementById('presensi-idcard-hint');
  const badgeNama = document.getElementById('badge-emp-nama');
  const badgeIdCard = document.getElementById('badge-emp-idcard');
  const badgeJabatan = document.getElementById('badge-emp-jabatan');
  const badgeAvatar = document.getElementById('badge-emp-avatar');

  if (!val || !val.trim()) {
    if (hiddenInput) hiddenInput.value = '';
    if (badgeCard) badgeCard.classList.add('hidden');
    if (hintEl) hintEl.classList.remove('hidden');
    return;
  }

  const cleanVal = val.trim().toUpperCase();
  const matched = currentPresensiKaryawanList.find(k => k.nik && k.nik.toUpperCase() === cleanVal);

  if (matched) {
    if (hiddenInput) hiddenInput.value = matched.id;
    if (badgeNama) badgeNama.textContent = matched.nama;
    if (badgeIdCard) badgeIdCard.textContent = matched.nik;
    if (badgeJabatan) badgeJabatan.textContent = matched.jabatan + (matched.departemen ? ` • ${matched.departemen}` : '');
    if (badgeAvatar) {
      if (matched.foto) {
        badgeAvatar.innerHTML = `<img src="/uploads/${matched.foto}" alt="${escapeHtml(matched.nama)}" class="w-full h-full object-cover rounded-lg">`;
      } else {
        badgeAvatar.innerHTML = getInitials(matched.nama);
      }
    }
    if (badgeCard) badgeCard.classList.remove('hidden');
    if (hintEl) hintEl.classList.add('hidden');
  } else {
    if (hiddenInput) hiddenInput.value = '';
    if (badgeCard) badgeCard.classList.add('hidden');
    if (hintEl) hintEl.classList.remove('hidden');
  }
}

// Fetch Today's Presensi Summary KPIs
async function fetchPresensiTodaySummary() {
  if (currentAuthUser && currentAuthUser.role === 'KARYAWAN') return;
  try {
    const res = await fetch('/api/presensi/today');
    const json = await res.json();
    if (!json.success) return;

    const d = json.data;
    let hadir = 0;
    let terlambat = 0;
    let izin = 0;
    let sakit = 0;
    let belumPresensi = 0;

    if (d.employees && Array.isArray(d.employees)) {
      d.employees.forEach(e => {
        if (!e.presensi_id) {
          belumPresensi++;
        } else if (e.status_presensi === 'Izin') {
          izin++;
        } else if (e.status_presensi === 'Sakit') {
          sakit++;
        } else if (e.status_presensi === 'Terlambat' || (e.jam_masuk && e.jam_masuk > '08:30:00')) {
          terlambat++;
        } else if (e.status_presensi === 'Hadir') {
          hadir++;
        }
      });
    } else {
      const s = d.summary || {
        hadir: d.hadirCount || 0,
        terlambat: d.terlambatCount || 0,
        izin: d.izinCount || 0,
        sakit: d.sakitCount || 0,
        belumPresensi: d.belumAbsen || 0
      };
      hadir = s.hadir;
      terlambat = s.terlambat;
      izin = s.izin;
      sakit = s.sakit;
      belumPresensi = s.belumPresensi;
    }

    const hadirEl = document.getElementById('stat-presensi-hadir');
    const terlambatEl = document.getElementById('stat-presensi-terlambat');
    const izinEl = document.getElementById('stat-presensi-izin');
    const belumEl = document.getElementById('stat-presensi-belum');
    const badgePresensi = document.getElementById('sidebar-badge-presensi');

    if (hadirEl) hadirEl.textContent = hadir;
    if (terlambatEl) terlambatEl.textContent = terlambat;
    if (izinEl) izinEl.textContent = izin + sakit;
    if (belumEl) belumEl.textContent = belumPresensi;

    if (badgePresensi) {
      badgePresensi.textContent = hadir + terlambat;
    }
  } catch (err) {
    console.error('Gagal mengambil ringkasan presensi hari ini:', err);
  }
}

// Fetch Presensi Table with Filters
async function fetchPresensi(page = currentPresensiPage) {
  if (currentAuthUser && currentAuthUser.role === 'KARYAWAN') return;
  currentPresensiPage = page;
  const tbody = document.getElementById('table-presensi-body');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="8" class="text-center py-12 text-slate-400">
        <i class="fa-solid fa-spinner fa-spin text-2xl mb-2 text-blue-600"></i>
        <p class="text-xs font-medium">Memuat log presensi...</p>
      </td>
    </tr>
  `;

  const tanggal = document.getElementById('filter-presensi-tanggal')?.value || '';
  const status = document.getElementById('filter-presensi-status')?.value || '';
  const search = document.getElementById('filter-presensi-search')?.value || '';

  const params = new URLSearchParams({
    page: currentPresensiPage,
    limit: 10,
    tanggal,
    status,
    search
  });

  // Jika akun yang login adalah Karyawan, hanya tampilkan data presensi miliknya sendiri
  if (currentAuthUser && currentAuthUser.role === 'KARYAWAN' && currentAuthUser.karyawan_id) {
    params.set('karyawan_id', currentAuthUser.karyawan_id);
  }

  try {
    const res = await fetch(`/api/presensi?${params.toString()}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    renderPresensiTable(json.data, json.pagination);
    renderPresensiPagination(json.pagination);

    const infoCount = document.getElementById('presensi-info-count');
    if (infoCount) {
      infoCount.textContent = `Total ${json.pagination.totalItems} catatan presensi tersimpan`;
    }
  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-10 text-rose-500">
          <i class="fa-solid fa-circle-exclamation text-2xl mb-2"></i>
          <p class="text-xs font-semibold">Terjadi kesalahan: ${err.message}</p>
        </td>
      </tr>
    `;
  }
}

// Helper render badge lokasi kehadiran GPS
function renderPresensiLocationBadge(item) {
  if (item.status === 'Izin' || item.status === 'Sakit') {
    return `<span class="inline-flex items-center text-slate-600 font-medium text-[11px]"><i class="fa-solid fa-house-user mr-1 text-[10px]"></i>Daring / Izin</span>`;
  }
  if (!item.status_lokasi) {
    return `<span class="text-slate-300 font-mono text-xs">-</span>`;
  }
  const isOffice = item.status_lokasi === 'Di Kantor';
  const distStr = item.jarak_meter != null ? `${Math.round(item.jarak_meter)}m` : '';
  const badgeCls = isOffice 
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
    : 'bg-amber-50 text-amber-700 border-amber-200';
  const icon = isOffice ? 'fa-building-circle-check' : 'fa-location-crosshairs';
  const label = isOffice ? `Di Kantor ${distStr ? `(${distStr})` : ''}` : `Luar Kantor ${distStr ? `(${distStr})` : ''}`;

  let mapLink = '';
  if (item.latitude && item.longitude) {
    mapLink = `<a href="https://maps.google.com/?q=${item.latitude},${item.longitude}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center text-[10px] text-blue-600 hover:text-blue-800 hover:underline mt-0.5" title="Buka Koordinat GPS di Google Maps"><i class="fa-solid fa-map-pin mr-1 text-[9px]"></i>Peta GPS</a>`;
  }

  return `
    <div class="flex flex-col items-start space-y-0.5">
      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${badgeCls}">
        <i class="fa-solid ${icon} mr-1 text-[10px]"></i> ${label}
      </span>
      ${mapLink}
    </div>
  `;
}

// Render Presensi Table Rows
function renderPresensiTable(data, pagination) {
  const tbody = document.getElementById('table-presensi-body');
  if (!tbody) return;

  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-14 text-slate-500">
          <div class="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl mx-auto mb-2.5">
            <i class="fa-solid fa-clipboard-user"></i>
          </div>
          <h4 class="text-sm font-bold text-slate-700">Belum Ada Catatan Presensi</h4>
          <p class="text-xs text-slate-500 mt-1">Gunakan panel di atas untuk melakukan Absen Masuk atau ajukan Izin/Sakit.</p>
        </td>
      </tr>
    `;
    return;
  }

  const offset = (pagination.page - 1) * pagination.limit;

  tbody.innerHTML = data.map((item, index) => {
    const no = offset + index + 1;
    const initial = getInitials(item.nama);

    // Cek apakah masuk terlambat (status 'Terlambat' atau jam_masuk lewat 08:30:00)
    const isLate = (item.status === 'Terlambat') || 
                   (item.jam_masuk && item.jam_masuk > '08:30:00' && item.status !== 'Izin' && item.status !== 'Sakit');

    // Status Badge
    let statusBadge = '';
    if (isLate) {
      statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
        <i class="fa-solid fa-clock mr-1.5 text-[10px]"></i> Terlambat
      </span>`;
    } else if (item.status === 'Hadir') {
      statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <i class="fa-solid fa-circle-check mr-1.5 text-[10px]"></i> Hadir
      </span>`;
    } else if (item.status === 'Izin') {
      statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-sky-50 text-sky-700 border border-sky-200">
        <i class="fa-solid fa-envelope-open-text mr-1.5 text-[10px]"></i> Izin
      </span>`;
    } else {
      statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
        <i class="fa-solid fa-bed mr-1.5 text-[10px]"></i> Sakit
      </span>`;
    }

    const fotoHtml = item.foto 
      ? `<img src="/uploads/${item.foto}" alt="${item.nama}" class="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0">`
      : `<div class="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">${initial}</div>`;

    return `
      <tr class="hover:bg-slate-50/70 transition">
        <td class="py-3 px-4 text-center font-bold text-slate-500 text-xs">${no}</td>
        
        <!-- Karyawan -->
        <td class="py-3 px-4">
          <div class="flex items-center space-x-2.5">
            ${fotoHtml}
            <div>
              <p class="font-extrabold text-slate-900 text-xs sm:text-sm">${escapeHtml(item.nama)}</p>
              <div class="flex items-center space-x-1.5 text-[11px] text-slate-500">
                <span class="font-mono font-bold text-slate-600">${item.nik}</span>
                <span>&bull;</span>
                <span>${escapeHtml(item.departemen || '-')}</span>
              </div>
            </div>
          </div>
        </td>

        <!-- Tanggal -->
        <td class="py-3 px-4 whitespace-nowrap text-xs font-bold text-slate-700">
          <i class="fa-regular fa-calendar text-slate-500 mr-1"></i>${formatDateIndo(item.tanggal)}
        </td>

        <!-- Jam Masuk -->
        <td class="py-3 px-4 text-center whitespace-nowrap">
          ${item.jam_masuk 
            ? `<span class="font-mono font-extrabold text-xs text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">${item.jam_masuk}</span>`
            : `<span class="text-slate-300 font-mono text-xs">-</span>`
          }
        </td>

        <!-- Jam Pulang (Dibuat terpisah & ada tombol checkout cepat jika belum pulang) -->
        <td class="py-3 px-4 text-center whitespace-nowrap">
          ${item.jam_pulang 
            ? `<span class="font-mono font-extrabold text-xs text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">${item.jam_pulang}</span>`
            : (item.status === 'Hadir' || item.status === 'Terlambat')
              ? `<button type="button" onclick="quickAbsenPulang(${item.karyawan_id}, '${escapeHtml(item.nama)}')" class="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 text-[10px] font-bold transition shadow-2xs" title="Catat Pulang Sekarang"><i class="fa-solid fa-person-walking-arrow-right text-[10px]"></i><span>Pulang</span></button>`
              : `<span class="text-slate-300 font-mono text-xs">-</span>`
          }
        </td>

        <!-- Status -->
        <td class="py-3 px-4 text-center whitespace-nowrap">
          ${statusBadge}
        </td>

        <!-- Lokasi Kehadiran (GPS Geofencing) -->
        <td class="py-3 px-4 text-xs whitespace-nowrap">
          ${renderPresensiLocationBadge(item)}
        </td>

        <!-- Keterangan & Metode / Bukti -->
        <td class="py-3 px-4 text-xs">
          <p class="text-slate-700 font-medium truncate max-w-xs">${
            isLate
              ? '<span class="text-amber-700 font-semibold"><i class="fa-solid fa-clock text-[10px] mr-1"></i>Terlambat (Lewat 08:30)</span>'
              : item.status === 'Hadir' 
                ? '<span class="text-emerald-700 font-semibold"><i class="fa-solid fa-circle-check text-[10px] mr-1"></i>Tepat Waktu</span>' 
                : escapeHtml(item.keterangan || item.status)
          }</p>
          <div class="flex items-center space-x-2 mt-1">
            <span class="text-[10px] text-slate-500 font-medium">${escapeHtml(item.metode || 'Sistem')}</span>
            ${item.bukti_foto ? `
              <button type="button" onclick="viewBuktiFoto('/uploads/${item.bukti_foto}')" class="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-[10px] font-bold transition shadow-2xs">
                <i class="fa-solid fa-file-medical text-[10px] text-rose-600"></i>
                <span>Surat Dokter</span>
              </button>
            ` : ''}
          </div>
        </td>

        <!-- Aksi (Hanya untuk Admin) -->
        ${(currentAuthUser && currentAuthUser.role === 'KARYAWAN') ? '' : `
        <td class="py-3 px-4 text-center">
          <button onclick="deletePresensi(${item.id}, '${escapeHtml(item.nama)}', '${item.tanggal}')" title="Hapus Riwayat Presensi" class="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white flex items-center justify-center mx-auto transition shadow-xs">
            <i class="fa-solid fa-trash-can text-xs"></i>
          </button>
        </td>`}
      </tr>
    `;
  }).join('');
}

// Render Presensi Pagination
function renderPresensiPagination(p) {
  const container = document.getElementById('pagination-presensi-controls');
  const info = document.getElementById('pagination-presensi-info');
  if (!container || !info) return;

  if (p.totalItems === 0) {
    info.textContent = 'Menampilkan 0 dari 0 data';
    container.innerHTML = '';
    return;
  }

  const start = (p.page - 1) * p.limit + 1;
  const end = Math.min(p.page * p.limit, p.totalItems);
  info.textContent = `Menampilkan ${start} - ${end} dari total ${p.totalItems} data`;

  let buttons = '';
  // Prev button
  buttons += `
    <button 
      onclick="fetchPresensi(${p.page - 1})" 
      ${p.page <= 1 ? 'disabled' : ''} 
      class="w-7 h-7 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition"
    >
      <i class="fa-solid fa-chevron-left text-[9px]"></i>
    </button>
  `;

  for (let i = 1; i <= p.totalPages; i++) {
    if (i === p.page) {
      buttons += `<button class="w-7 h-7 rounded-lg bg-blue-600 text-white text-xs font-black shadow-sm">${i}</button>`;
    } else if (i === 1 || i === p.totalPages || (i >= p.page - 1 && i <= p.page + 1)) {
      buttons += `<button onclick="fetchPresensi(${i})" class="w-7 h-7 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition">${i}</button>`;
    } else if (i === p.page - 2 || i === p.page + 2) {
      buttons += `<span class="px-1 text-slate-300 text-xs">...</span>`;
    }
  }

  // Next button
  buttons += `
    <button 
      onclick="fetchPresensi(${p.page + 1})" 
      ${p.page >= p.totalPages ? 'disabled' : ''} 
      class="w-7 h-7 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition"
    >
      <i class="fa-solid fa-chevron-right text-[9px]"></i>
    </button>
  `;

  container.innerHTML = buttons;
}

// Quick filter Presensi Hari Ini
function setPresensiFilterToday() {
  const today = new Date().toISOString().slice(0, 10);
  const input = document.getElementById('filter-presensi-tanggal');
  if (input) input.value = today;
  fetchPresensi(1);
}

// Quick filter Presensi Semua Tanggal
function setPresensiFilterAll() {
  const input = document.getElementById('filter-presensi-tanggal');
  if (input) input.value = '';
  fetchPresensi(1);
}

// Debounce search presensi
function debouncePresensiSearch() {
  clearTimeout(debouncePresensiTimer);
  debouncePresensiTimer = setTimeout(() => {
    fetchPresensi(1);
  }, 350);
}

// FORMULIR PRESENSI & PERIZINAN KARYAWAN

let currentTodayAttendees = [];

// Handle Radio Status Change (Hadir, Izin, Sakit)
function handlePresensiStatusChange() {
  const statusSelected = document.querySelector('input[name="presensi_status"]:checked')?.value || 'Hadir';
  const sectionHadir = document.getElementById('section-info-hadir');
  const sectionIzin = document.getElementById('section-keterangan-izin');
  const sectionSakit = document.getElementById('section-bukti-sakit');
  const btnLabel = document.getElementById('btn-submit-presensi-label');

  // Highlight active radio card
  const radios = document.querySelectorAll('input[name="presensi_status"]');
  radios.forEach(r => {
    const card = r.closest('.status-radio-card');
    if (!card) return;
    if (r.checked) {
      if (r.value === 'Hadir') {
        card.className = 'status-radio-card cursor-pointer flex items-center justify-center space-x-2 py-3.5 px-3 rounded-2xl border-2 border-emerald-500 bg-emerald-50/40 transition';
      } else if (r.value === 'Izin') {
        card.className = 'status-radio-card cursor-pointer flex items-center justify-center space-x-2 py-3.5 px-3 rounded-2xl border-2 border-sky-500 bg-sky-50/40 transition';
      } else if (r.value === 'Sakit') {
        card.className = 'status-radio-card cursor-pointer flex items-center justify-center space-x-2 py-3.5 px-3 rounded-2xl border-2 border-rose-500 bg-rose-50/40 transition';
      }
    } else {
      card.className = 'status-radio-card cursor-pointer flex items-center justify-center space-x-2 py-3.5 px-3 rounded-2xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition';
    }
  });

  if (statusSelected === 'Hadir') {
    sectionHadir?.classList.remove('hidden');
    sectionIzin?.classList.add('hidden');
    sectionSakit?.classList.add('hidden');
    if (btnLabel) btnLabel.textContent = 'Simpan Kehadiran (Hadir)';
  } else if (statusSelected === 'Izin') {
    sectionHadir?.classList.add('hidden');
    sectionIzin?.classList.remove('hidden');
    sectionSakit?.classList.add('hidden');
    if (btnLabel) btnLabel.textContent = 'Kirim Permohonan Izin';
  } else if (statusSelected === 'Sakit') {
    sectionHadir?.classList.add('hidden');
    sectionIzin?.classList.add('hidden');
    sectionSakit?.classList.remove('hidden');
    if (btnLabel) btnLabel.textContent = 'Kirim Izin Sakit & Surat Dokter';
  }
}

// Handle Photo Preview for Doctor's Note / Surat Dokter
function handlePreviewBuktiSurat(input) {
  const container = document.getElementById('preview-bukti-container');
  const img = document.getElementById('preview-bukti-img');

  if (input.files && input.files[0]) {
    const file = input.files[0];
    if (file.size > 5 * 1024 * 1024) {
      Swal.fire({
        icon: 'error',
        title: 'File Terlalu Besar',
        text: 'Ukuran foto maksimal adalah 5MB',
        confirmButtonColor: '#2563eb'
      });
      input.value = '';
      if (container) container.classList.add('hidden');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (img) img.src = e.target.result;
      if (container) container.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  } else {
    if (container) container.classList.add('hidden');
  }
}

// Clear Attached Doctor's Note
function clearBuktiFoto() {
  const input = document.getElementById('form-presensi-bukti-foto');
  const container = document.getElementById('preview-bukti-container');
  const img = document.getElementById('preview-bukti-img');
  if (input) input.value = '';
  if (img) img.src = '';
  if (container) container.classList.add('hidden');
}

// Open View Modal for Doctor's Note Image
function viewBuktiFoto(imgUrl) {
  const modal = document.getElementById('modal-view-bukti');
  const img = document.getElementById('modal-bukti-img');
  const downloadBtn = document.getElementById('modal-bukti-download');

  if (img) img.src = imgUrl;
  if (downloadBtn) downloadBtn.href = imgUrl;
  if (modal) modal.classList.remove('hidden');
}

// Close View Modal for Doctor's Note Image
function closeModalViewBukti() {
  const modal = document.getElementById('modal-view-bukti');
  if (modal) modal.classList.add('hidden');
}

// Handle Main Form Presensi Submit (Supports Hadir, Izin, Sakit)
async function handleFormPresensiSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const btn = document.getElementById('btn-submit-presensi-main');
  const originalBtn = btn ? btn.innerHTML : '';

  const karyawanId = document.getElementById('presensi-select-karyawan')?.value;
  const tanggal = document.getElementById('form-presensi-input-tanggal')?.value;
  const status = form.querySelector('input[name="presensi_status"]:checked')?.value || 'Hadir';
  const fileInput = document.getElementById('form-presensi-bukti-foto');
  const keteranganIzin = document.getElementById('form-presensi-keterangan-izin')?.value || '';
  const keteranganSakit = document.getElementById('form-presensi-keterangan-sakit')?.value || '';

  if (!karyawanId) {
    Swal.fire({
      icon: 'warning',
      title: 'Pilih Karyawan',
      text: 'Silakan pilih karyawan yang akan dicatat presensinya.',
      confirmButtonColor: '#2563eb'
    });
    return;
  }

  if (!tanggal) {
    Swal.fire({
      icon: 'warning',
      title: 'Tentukan Tanggal',
      text: 'Silakan pilih tanggal presensi.',
      confirmButtonColor: '#2563eb'
    });
    return;
  }

  if (status === 'Izin' && !keteranganIzin.trim()) {
    Swal.fire({
      icon: 'warning',
      title: 'Alasan Izin Wajib Diisi',
      text: 'Mohon tuliskan keterangan atau alasan izin pada kolom yang disediakan.',
      confirmButtonColor: '#2563eb'
    });
    return;
  }

  if (status === 'Sakit' && (!fileInput || !fileInput.files || fileInput.files.length === 0)) {
    const confirmRes = await Swal.fire({
      title: 'Surat Dokter Belum Diunggah',
      text: 'Khusus presensi sakit disyaratkan melampirkan foto Surat Keterangan Dokter. Tetap simpan tanpa foto bukti?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Tetap Simpan',
      cancelButtonText: 'Batal, Mau Upload Foto'
    });
    if (!confirmRes.isConfirmed) return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i>Menyimpan Presensi...`;
  }

  try {
    const formData = new FormData();
    formData.append('karyawan_id', karyawanId);
    formData.append('tanggal', tanggal);

    let submitStatus = status;
    let submitKeterangan = '';

    if (status === 'Hadir') {
      // Waktu real-time saat mengisi/menyimpan form
      const now = new Date();
      const jam = String(now.getHours()).padStart(2, '0') + ':' + 
                  String(now.getMinutes()).padStart(2, '0') + ':' + 
                  String(now.getSeconds()).padStart(2, '0');
      formData.append('jam_masuk', jam);

      // Otomatis terdeteksi Terlambat jika jam masuk melewati 08:30:00 WIB
      if (jam > '08:30:00') {
        submitStatus = 'Terlambat';
        submitKeterangan = 'Terlambat (Lewat 08:30)';
      } else {
        submitStatus = 'Hadir';
        submitKeterangan = 'Tepat Waktu';
      }
      formData.append('status', submitStatus);
      formData.append('keterangan', submitKeterangan);

      // Verifikasi Lokasi GPS (Geofencing) jika terdeteksi
      const latInput = document.getElementById('presensi-lat');
      const lngInput = document.getElementById('presensi-lng');
      const locInput = document.getElementById('presensi-lokasi-text');
      if (latInput && latInput.value) formData.append('latitude', latInput.value);
      if (lngInput && lngInput.value) formData.append('longitude', lngInput.value);
      if (locInput && locInput.value) formData.append('lokasi', locInput.value);
    } else if (status === 'Izin') {
      formData.append('status', 'Izin');
      formData.append('keterangan', keteranganIzin.trim());
    } else if (status === 'Sakit') {
      formData.append('status', 'Sakit');
      formData.append('keterangan', keteranganSakit.trim() || 'Sakit');
      if (fileInput && fileInput.files && fileInput.files[0]) {
        formData.append('bukti_foto', fileInput.files[0]);
      }
    }

    const res = await fetch('/api/presensi/form', {
      method: 'POST',
      body: formData
    });

    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    Swal.fire({
      icon: 'success',
      title: 'Presensi Berhasil Dicatat!',
      text: json.message,
      timer: 2500,
      showConfirmButton: false
    });

    form.reset();
    clearBuktiFoto();
    const hadirRadio = form.querySelector('input[name="presensi_status"][value="Hadir"]');
    if (hadirRadio) hadirRadio.checked = true;
    handlePresensiStatusChange();

    if (currentAuthUser && currentAuthUser.role === 'KARYAWAN') {
      const presensiHidden = document.getElementById('presensi-select-karyawan');
      const presensiInput = document.getElementById('presensi-input-idcard');
      if (presensiHidden) presensiHidden.value = currentAuthUser.karyawan_id;
      if (presensiInput) presensiInput.value = currentAuthUser.nik;
      const badgeCard = document.getElementById('presensi-employee-badge');
      if (badgeCard) badgeCard.classList.remove('hidden');
      const hintEl = document.getElementById('presensi-idcard-hint');
      if (hintEl) hintEl.classList.add('hidden');
    } else {
      const idCardInput = document.getElementById('presensi-input-idcard');
      if (idCardInput) idCardInput.value = '';
      const badgeCard = document.getElementById('presensi-employee-badge');
      if (badgeCard) badgeCard.classList.add('hidden');
      const hintEl = document.getElementById('presensi-idcard-hint');
      if (hintEl) hintEl.classList.remove('hidden');
      const hiddenKaryawan = document.getElementById('presensi-select-karyawan');
      if (hiddenKaryawan) hiddenKaryawan.value = '';
    }

    const inputTgl = document.getElementById('form-presensi-input-tanggal');
    if (inputTgl) inputTgl.value = new Date().toISOString().slice(0, 10);

    fetchPresensiTodaySummary();
    populatePulangDropdown();
    fetchPresensi(1);
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Gagal Menyimpan Presensi',
      text: err.message,
      confirmButtonColor: '#2563eb'
    });
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalBtn;
    }
  }
}

// PENCATATAN ABSEN PULANG (TERPISAH SETELAH HADIR)

// Populate Dropdown & Datalist Absen Pulang (Hadir/Terlambat hari ini dan belum pulang)
async function populatePulangDropdown() {
  const select = document.getElementById('pulang-select-karyawan');
  const emptyState = document.getElementById('pulang-empty-state');
  const infoCard = document.getElementById('pulang-info-card');
  const btn = document.getElementById('btn-submit-pulang');
  const datalist = document.getElementById('list-idcard-pulang');
  const inputPulang = document.getElementById('pulang-input-idcard');

  try {
    const res = await fetch('/api/presensi/today');
    const json = await res.json();
    if (!json.success) return;

    const employees = json.data.employees || [];

    // Jika Role KARYAWAN: Tampilkan kondisi checkout untuk karyawan yang login secara khusus
    if (currentAuthUser && currentAuthUser.role === 'KARYAWAN') {
      const myEmp = employees.find(e => e.id === currentAuthUser.karyawan_id);
      if (inputPulang) {
        inputPulang.value = currentAuthUser.nik;
        inputPulang.readOnly = true;
        inputPulang.classList.add('bg-slate-100', 'cursor-not-allowed');
      }
      if (select) select.value = currentAuthUser.karyawan_id;

      if (!myEmp || !myEmp.presensi_id) {
        // Belum absen masuk
        if (emptyState) {
          emptyState.classList.remove('hidden');
          const p = emptyState.querySelector('p');
          if (p) p.textContent = 'Belum Mengisi Absen Masuk Hari Ini';
        }
        if (infoCard) infoCard.classList.add('hidden');
        if (btn) btn.disabled = true;
      } else if (myEmp.jam_pulang) {
        // Sudah absen pulang
        if (emptyState) {
          emptyState.classList.remove('hidden');
          const p = emptyState.querySelector('p');
          if (p) p.textContent = `Sudah Selesai Absen Pulang (Pukul ${myEmp.jam_pulang} WIB)`;
        }
        if (infoCard) infoCard.classList.add('hidden');
        if (btn) btn.disabled = true;
      } else if (myEmp.status_presensi === 'Hadir' || myEmp.status_presensi === 'Terlambat') {
        // Sudah absen masuk dan belum pulang -> Siap absen pulang!
        if (emptyState) emptyState.classList.add('hidden');
        if (infoCard) {
          infoCard.classList.remove('hidden');
          const jamMasukEl = document.getElementById('pulang-info-jam-masuk');
          if (jamMasukEl) jamMasukEl.textContent = myEmp.jam_masuk || '--:--:--';
        }
        if (btn) btn.disabled = false;
      } else {
        // Izin atau Sakit
        if (emptyState) {
          emptyState.classList.remove('hidden');
          const p = emptyState.querySelector('p');
          if (p) p.textContent = `Status: ${myEmp.status_presensi} (Tidak perlu absen pulang)`;
        }
        if (infoCard) infoCard.classList.add('hidden');
        if (btn) btn.disabled = true;
      }
      return;
    }

    currentTodayAttendees = employees.filter(e => 
      e.presensi_id && 
      (e.status_presensi === 'Hadir' || e.status_presensi === 'Terlambat') && 
      !e.jam_pulang
    );

    // Update Absen Pulang datalist
    if (datalist) {
      datalist.innerHTML = currentTodayAttendees.map(e => 
        `<option value="${e.nik}">${escapeHtml(e.nama)} - Masuk ${e.jam_masuk || '-'}</option>`
      ).join('');
    }

    if (currentTodayAttendees.length === 0) {
      if (select && select.tagName === 'SELECT') {
        select.innerHTML = '<option value="">-- Tidak Ada Karyawan Menunggu Pulang --</option>';
        select.disabled = true;
      }
      if (inputPulang) {
        inputPulang.disabled = true;
        inputPulang.placeholder = 'Semua hadir sudah pulang';
      }
      if (emptyState) emptyState.classList.remove('hidden');
      if (infoCard) infoCard.classList.add('hidden');
      if (btn) btn.disabled = true;
    } else {
      if (select && select.tagName === 'SELECT') {
        let html = '<option value="">-- Pilih Karyawan Hadir --</option>';
        currentTodayAttendees.forEach(e => {
          html += `<option value="${e.id}">${escapeHtml(e.nama)} (${e.nik}) - Masuk ${e.jam_masuk || '-'}</option>`;
        });
        select.innerHTML = html;
        select.disabled = false;
      }
      if (inputPulang) {
        inputPulang.disabled = false;
        inputPulang.placeholder = 'Ketik ID Card (misal: AC0001)';
      }
      if (emptyState) emptyState.classList.add('hidden');
      if (infoCard) infoCard.classList.add('hidden');
      if (btn) btn.disabled = true;
    }
  } catch (err) {
    console.error('Gagal memuat dropdown absen pulang:', err);
  }
}

// Search attendee by typing ID Card for checkout pulang
function handleSearchPulangByIdCard(val) {
  const hiddenInput = document.getElementById('pulang-select-karyawan');
  const infoCard = document.getElementById('pulang-info-card');
  const jamMasukEl = document.getElementById('pulang-info-jam-masuk');
  const btn = document.getElementById('btn-submit-pulang');

  if (!val || !val.trim()) {
    if (hiddenInput) hiddenInput.value = '';
    if (infoCard) infoCard.classList.add('hidden');
    if (btn) btn.disabled = true;
    return;
  }

  const cleanVal = val.trim().toUpperCase();
  const selected = currentTodayAttendees.find(e => e.nik && e.nik.toUpperCase() === cleanVal);

  if (selected) {
    if (hiddenInput) hiddenInput.value = selected.id;
    if (jamMasukEl) jamMasukEl.textContent = selected.jam_masuk || '--:--:--';
    if (infoCard) infoCard.classList.remove('hidden');
    if (btn) btn.disabled = false;
  } else {
    if (hiddenInput) hiddenInput.value = '';
    if (infoCard) infoCard.classList.add('hidden');
    if (btn) btn.disabled = true;
  }
}

// When employee is chosen in Absen Pulang dropdown
function handleSelectKaryawanPulang() {
  const select = document.getElementById('pulang-select-karyawan');
  const infoCard = document.getElementById('pulang-info-card');
  const jamMasukEl = document.getElementById('pulang-info-jam-masuk');
  const btn = document.getElementById('btn-submit-pulang');

  if (!select || !select.value) {
    if (infoCard) infoCard.classList.add('hidden');
    if (btn) btn.disabled = true;
    return;
  }

  const selected = currentTodayAttendees.find(e => String(e.id) === String(select.value));
  if (selected) {
    if (jamMasukEl) jamMasukEl.textContent = selected.jam_masuk || '--:--:--';
    if (infoCard) infoCard.classList.remove('hidden');
    if (btn) btn.disabled = false;
  }
}

// Handle Absen Pulang Submit
async function handleAbsenPulangSubmit() {
  const select = document.getElementById('pulang-select-karyawan');
  const karyawanId = select ? select.value : '';
  const btn = document.getElementById('btn-submit-pulang');
  const originalBtn = btn ? btn.innerHTML : '';

  if (!karyawanId) {
    Swal.fire({
      icon: 'warning',
      title: 'Pilih Karyawan',
      text: 'Silakan ketik atau pilih ID Card karyawan yang hendak dicatat kepulangannya.',
      confirmButtonColor: '#2563eb'
    });
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i>Mencatat Pulang...`;
  }

  try {
    const payload = { karyawan_id: karyawanId };
    if (currentGPSLocation) {
      payload.latitude = currentGPSLocation.latitude;
      payload.longitude = currentGPSLocation.longitude;
    }

    const res = await fetch('/api/presensi/pulang', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    Swal.fire({
      icon: 'success',
      title: 'Absen Pulang Berhasil!',
      text: json.message,
      timer: 2500,
      showConfirmButton: false
    });

    if (currentAuthUser && currentAuthUser.role === 'KARYAWAN') {
      const pulangHidden = document.getElementById('pulang-select-karyawan');
      const pulangInput = document.getElementById('pulang-input-idcard');
      if (pulangHidden) pulangHidden.value = currentAuthUser.karyawan_id;
      if (pulangInput) {
        pulangInput.value = currentAuthUser.nik;
        pulangInput.readOnly = true;
      }
    } else {
      const inputPulang = document.getElementById('pulang-input-idcard');
      if (inputPulang) inputPulang.value = '';
      const hiddenPulang = document.getElementById('pulang-select-karyawan');
      if (hiddenPulang) hiddenPulang.value = '';
    }
    const infoCard = document.getElementById('pulang-info-card');
    if (infoCard) infoCard.classList.add('hidden');

    fetchPresensiTodaySummary();
    populatePulangDropdown();
    fetchPresensi(1);
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Gagal Absen Pulang',
      text: err.message,
      confirmButtonColor: '#2563eb'
    });
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalBtn;
    }
  }
}

// Quick checkout directly from presensi table row
function quickAbsenPulang(karyawanId, nama) {
  Swal.fire({
    title: 'Catat Absen Pulang?',
    html: `Konfirmasi checkout kepulangan untuk <strong>${nama}</strong> pada waktu sekarang?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#4f46e5',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Ya, Catat Pulang',
    cancelButtonText: 'Batal'
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const res = await fetch('/api/presensi/pulang', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ karyawan_id: karyawanId })
        });

        const json = await res.json();
        if (!json.success) throw new Error(json.message);

        Swal.fire({
          icon: 'success',
          title: 'Pulang Berhasil Dicatat!',
          text: json.message,
          timer: 2000,
          showConfirmButton: false
        });

        fetchPresensiTodaySummary();
        populatePulangDropdown();
        fetchPresensi(currentPresensiPage);
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Gagal Absen Pulang',
          text: err.message,
          confirmButtonColor: '#2563eb'
        });
      }
    }
  });
}

// Handle Absen Masuk Real-Time
async function handleAbsenMasuk() {
  const select = document.getElementById('presensi-select-karyawan');
  const karyawanId = select ? select.value : '';

  if (!karyawanId) {
    Swal.fire({
      icon: 'warning',
      title: 'Pilih Karyawan Terlebih Dahulu',
      text: 'Silakan tentukan karyawan yang hendak melakukan Absen Masuk.',
      confirmButtonColor: '#2563eb'
    });
    return;
  }

  try {
    const res = await fetch('/api/presensi/masuk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ karyawan_id: karyawanId })
    });

    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    const isTerlambat = json.data?.status === 'Terlambat';
    Swal.fire({
      icon: isTerlambat ? 'warning' : 'success',
      title: isTerlambat ? 'Absen Masuk: Terlambat' : 'Absen Masuk Berhasil!',
      html: `Presensi atas nama <strong>${escapeHtml(json.data.nama)}</strong> berhasil dicatat pada pukul <strong>${json.data.jam_masuk} WIB</strong>.<br><span class="text-xs text-slate-500">${escapeHtml(json.message)}</span>`,
      timer: 3000,
      showConfirmButton: true,
      confirmButtonColor: '#2563eb'
    });

    fetchPresensiTodaySummary();
    fetchPresensi(1);
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Gagal Absen Masuk',
      text: err.message,
      confirmButtonColor: '#2563eb'
    });
  }
}

// Handle Absen Pulang Real-Time
async function handleAbsenPulang() {
  const select = document.getElementById('presensi-select-karyawan');
  const karyawanId = select ? select.value : '';

  if (!karyawanId) {
    Swal.fire({
      icon: 'warning',
      title: 'Pilih Karyawan Terlebih Dahulu',
      text: 'Silakan tentukan karyawan yang hendak melakukan Absen Pulang.',
      confirmButtonColor: '#2563eb'
    });
    return;
  }

  try {
    const payload = { karyawan_id: karyawanId };
    if (currentGPSLocation) {
      payload.latitude = currentGPSLocation.latitude;
      payload.longitude = currentGPSLocation.longitude;
    }

    const res = await fetch('/api/presensi/pulang', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    Swal.fire({
      icon: 'success',
      title: 'Absen Pulang Berhasil!',
      html: `Presensi kepulangan atas nama <strong>${escapeHtml(json.data.nama)}</strong> dicatat pada pukul <strong>${json.data.jam_pulang} WIB</strong>. Terima kasih atas dedikasi Anda hari ini!`,
      timer: 3000,
      showConfirmButton: true,
      confirmButtonColor: '#2563eb'
    });

    fetchPresensiTodaySummary();
    fetchPresensi(1);
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Gagal Absen Pulang',
      text: err.message,
      confirmButtonColor: '#2563eb'
    });
  }
}

// Open Modal Presensi Manual (Admin)
function openModalPresensiManual() {
  const form = document.getElementById('form-presensi-manual');
  if (form) form.reset();

  const manualTgl = document.getElementById('manual-tanggal');
  if (manualTgl) manualTgl.value = new Date().toISOString().slice(0, 10);

  const modal = document.getElementById('modal-presensi-manual');
  if (modal) modal.classList.remove('hidden');
}

// Close Modal Presensi Manual
function closeModalPresensiManual() {
  const modal = document.getElementById('modal-presensi-manual');
  if (modal) modal.classList.add('hidden');
}

// Submit Presensi Manual (Admin)
async function handleSubmitPresensiManual(e) {
  e.preventDefault();
  const form = document.getElementById('form-presensi-manual');
  const btn = document.getElementById('btn-submit-manual');
  const originalBtn = btn.innerHTML;

  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Menyimpan...`;

  const payload = {
    karyawan_id: form.karyawan_id.value,
    tanggal: form.tanggal.value,
    status: form.status.value,
    jam_masuk: form.jam_masuk.value || null,
    jam_pulang: form.jam_pulang.value || null,
    keterangan: form.keterangan.value || '',
    metode: 'Manual Admin'
  };

  try {
    const res = await fetch('/api/presensi/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    closeModalPresensiManual();
    Swal.fire({
      icon: 'success',
      title: 'Presensi Tersimpan!',
      text: json.message,
      timer: 2000,
      showConfirmButton: false
    });

    fetchPresensiTodaySummary();
    fetchPresensi(1);
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Gagal Menyimpan Presensi',
      text: err.message,
      confirmButtonColor: '#2563eb'
    });
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalBtn;
  }
}

// Open Modal Izin / Sakit
function openModalIzinSakit() {
  const form = document.getElementById('form-izin-sakit');
  if (form) form.reset();

  const kioskSelect = document.getElementById('presensi-select-karyawan');
  const izinSelect = document.getElementById('izin-karyawan-id');
  if (kioskSelect && izinSelect && kioskSelect.value) {
    izinSelect.value = kioskSelect.value;
  }

  const modal = document.getElementById('modal-izin-sakit');
  if (modal) modal.classList.remove('hidden');
}

// Close Modal Izin / Sakit
function closeModalIzinSakit() {
  const modal = document.getElementById('modal-izin-sakit');
  if (modal) modal.classList.add('hidden');
}

// Submit Form Izin / Sakit with Multer FormData Support
async function handleSubmitIzinSakit(e) {
  e.preventDefault();
  const form = document.getElementById('form-izin-sakit');
  const btn = document.getElementById('btn-submit-izin');
  const originalBtn = btn.innerHTML;

  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Mengirim...`;

  const today = new Date().toISOString().slice(0, 10);
  const statusSelected = form.querySelector('input[name="status"]:checked')?.value || 'Izin';
  const fileInput = document.getElementById('izin-bukti-foto');

  const formData = new FormData();
  formData.append('karyawan_id', form.karyawan_id.value);
  formData.append('tanggal', today);
  formData.append('status', statusSelected);
  formData.append('keterangan', form.keterangan.value || '');
  formData.append('metode', `Pengajuan ${statusSelected}`);

  if (fileInput && fileInput.files && fileInput.files[0]) {
    formData.append('bukti_foto', fileInput.files[0]);
  }

  try {
    const res = await fetch('/api/presensi/form', {
      method: 'POST',
      body: formData
    });

    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    closeModalIzinSakit();
    Swal.fire({
      icon: 'success',
      title: `Pengajuan ${statusSelected} Berhasil!`,
      text: `Presensi ${statusSelected} telah dicatat untuk hari ini.`,
      timer: 2500,
      showConfirmButton: false
    });

    fetchPresensiTodaySummary();
    fetchPresensi(1);
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Gagal Mengajukan Izin/Sakit',
      text: err.message,
      confirmButtonColor: '#2563eb'
    });
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalBtn;
  }
}

// Delete Presensi Record
function deletePresensi(id, nama, tanggal) {
  Swal.fire({
    title: 'Hapus Log Presensi?',
    html: `Apakah Anda yakin ingin menghapus data presensi <strong>${nama}</strong> pada tanggal <strong>${formatDateIndo(tanggal)}</strong>?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#e11d48',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Ya, Hapus',
    cancelButtonText: 'Batal'
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/presensi/${id}`, { method: 'DELETE' });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);

        Swal.fire({
          icon: 'success',
          title: 'Terhapus!',
          text: json.message,
          timer: 2000,
          showConfirmButton: false
        });

        fetchPresensiTodaySummary();
        fetchPresensi(currentPresensiPage);
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Gagal Menghapus Presensi',
          text: err.message,
          confirmButtonColor: '#2563eb'
        });
      }
    }
  });
}

// 4. UTILITIES & HELPER FUNCTIONS

// Format Currency to Indonesian Rupiah
function formatRupiah(val) {
  if (!val || isNaN(val)) return 'Rp 0';
  return 'Rp ' + Number(val).toLocaleString('id-ID');
}

// Format Date YYYY-MM-DD to Indonesian
function formatDateIndo(str) {
  if (!str) return '-';
  const parts = str.split('-');
  if (parts.length === 3) {
    const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const d = parseInt(parts[2], 10);
    const m = months[parseInt(parts[1], 10)] || parts[1];
    const y = parts[0];
    return `${d} ${m} ${y}`;
  }
  return str;
}

// Get Initials for Avatar Fallback
function getInitials(name) {
  if (!name) return 'AC';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Escape HTML Strings
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
