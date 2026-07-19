/* ================= SUPABASE SETUP ================= */
const SUPABASE_URL = 'https://utytmeyetfzyxcvbsrxa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0eXRtZXlldGZ6eXhjdmJzcnhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0NDAxMjUsImV4cCI6MjEwMDAxNjEyNX0.dj7tyOfVjj7hau9X--PbVBh9I5Uyp73QGfsLr8fEPdA';
const BUCKET = 'satria-files';
let sb;
try{
  if(typeof supabase === 'undefined') throw new Error('Library Supabase gagal dimuat dari internet. Cek koneksi HP lalu refresh halaman.');
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}catch(e){
  document.addEventListener('DOMContentLoaded', ()=>{
    const el = document.getElementById('authError');
    if(el){ el.style.color = 'var(--alert)'; el.textContent = e.message; }
  });
  console.error(e);
}

/* ================= LOCAL STATE CACHE ================= */
const STATE = { units:[], customers:[], contracts:[], blacklist:[], settings:{ business_name:'SATRIA RENTAL', min_units:10 } };

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function fmtDate(d){ if(!d) return '-'; const dt=new Date(d); return dt.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}); }
function fmtMoney(n){ return 'Rp' + (Number(n)||0).toLocaleString('id-ID'); }

/* ================= AUTH ================= */
const authScreen = document.getElementById('authScreen');
const mainApp = document.getElementById('mainApp');
const authError = document.getElementById('authError');

window.handleLogin = async function(){
  if(!sb){ authError.style.color='var(--alert)'; authError.textContent='Koneksi ke server belum siap. Refresh halaman dan coba lagi.'; return; }
  authError.style.color = 'var(--alert)'; authError.textContent = '';
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  if(!email || !password){ authError.textContent = 'Isi email dan password.'; return; }
  const btn = document.querySelector('.auth-box .btn-primary');
  const originalText = btn.textContent; btn.textContent = 'Memproses...'; btn.disabled = true;
  try{
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if(error){ authError.textContent = 'Gagal masuk: ' + error.message; btn.textContent = originalText; btn.disabled = false; return; }
    await enterApp();
  }catch(e){
    authError.textContent = 'Terjadi kesalahan tak terduga: ' + (e.message || e);
    btn.textContent = originalText; btn.disabled = false;
  }
};

window.handleSignup = async function(){
  if(!sb){ authError.style.color='var(--alert)'; authError.textContent='Koneksi ke server belum siap. Refresh halaman dan coba lagi.'; return; }
  authError.style.color = 'var(--alert)'; authError.textContent = '';
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  if(!email || password.length < 6){ authError.textContent = 'Email wajib diisi, password minimal 6 karakter.'; return; }
  const btn = document.querySelector('.auth-box .btn-ghost');
  const originalText = btn.textContent; btn.textContent = 'Memproses...'; btn.disabled = true;
  try{
    const { error } = await sb.auth.signUp({ email, password });
    if(error){ authError.textContent = 'Gagal daftar: ' + error.message; btn.textContent = originalText; btn.disabled = false; return; }
    authError.style.color = 'var(--go)';
    authError.textContent = 'Akun dibuat. Jika diminta verifikasi email, cek inbox lalu login.';
    btn.textContent = originalText; btn.disabled = false;
    const { data: { session } } = await sb.auth.getSession();
    if(session) await enterApp();
  }catch(e){
    authError.style.color = 'var(--alert)';
    authError.textContent = 'Terjadi kesalahan tak terduga: ' + (e.message || e);
    btn.textContent = originalText; btn.disabled = false;
  }
};

async function checkExistingSession(){
  const { data: { session } } = await sb.auth.getSession();
  if(session) await enterApp();
}

async function enterApp(){
  try{
    authScreen.style.display = 'none';
    mainApp.style.display = 'block';
    document.getElementById('logoutBtn').addEventListener('click', async ()=>{
      if(!confirm('Keluar dari akun?')) return;
      await sb.auth.signOut();
      mainApp.style.display = 'none';
      authScreen.style.display = 'flex';
    });
    await loadAllData();
    attachTabListeners();
    render();
  }catch(e){
    authScreen.style.display = 'flex';
    mainApp.style.display = 'none';
    authError.style.color = 'var(--alert)';
    authError.textContent = 'Gagal memuat data: ' + (e.message || e);
  }
}

/* ================= LOAD DATA FROM SUPABASE ================= */
async function loadAllData(){
  const [u, c, k, b, s] = await Promise.all([
    sb.from('units').select('*').order('created_at'),
    sb.from('customers').select('*').order('created_at'),
    sb.from('contracts').select('*').order('created_at', {ascending:false}),
    sb.from('blacklist').select('*').order('tgl_input', {ascending:false}),
    sb.from('settings').select('*').eq('id',1).single()
  ]);
  STATE.units = u.data || [];
  STATE.customers = c.data || [];
  STATE.contracts = k.data || [];
  STATE.blacklist = b.data || [];
  STATE.settings = s.data || STATE.settings;
  if(STATE.units.length === 0) await seedUnits();
}

async function seedUnits(){
  const models = ['Toyota Avanza','Honda Brio','Suzuki XL7','Toyota Innova','Daihatsu Xenia','Honda Mobilio','Toyota Calya','Mitsubishi Xpander','Suzuki Ertiga','Toyota Rush'];
  const rows = models.map((m,i)=>({
    plat: `W ${1000+i*37} XX`, model:m, tahun: 2021+(i%4), status:'tersedia',
    lokasi:'Pool Satria Rental', lat:'', lng:'', last_update: todayISO()
  }));
  const { data, error } = await sb.from('units').insert(rows).select();
  if(!error) STATE.units = data;
}

/* ================= FILE UPLOAD HELPER ================= */
async function uploadFile(file, prefix){
  const ext = (file.name.split('.').pop() || 'jpg');
  const path = `${prefix}/${uid()}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { upsert:true });
  if(error){ alert('Gagal upload file: ' + error.message); return null; }
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
async function uploadDataUrl(dataUrl, prefix){
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const path = `${prefix}/${uid()}.png`;
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { upsert:true, contentType:'image/png' });
  if(error){ alert('Gagal upload: ' + error.message); return null; }
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/* ================= NAV / MODAL ================= */
const app = document.getElementById('app');
let tabs, currentView = 'dashboard';
const modalBackdrop = document.getElementById('modalBackdrop');
const modalBody = document.getElementById('modalBody');

function attachTabListeners(){
  tabs = document.querySelectorAll('.tab');
  tabs.forEach(t=>t.addEventListener('click', ()=>{
    tabs.forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    currentView = t.dataset.view;
    render();
  }));
}

function openModal(html){
  modalBody.innerHTML = `<button class="modal-close" onclick="closeModal()">✕</button>${html}`;
  modalBackdrop.classList.add('open');
}
function closeModal(){ modalBackdrop.classList.remove('open'); }
modalBackdrop.addEventListener('click', (e)=>{ if(e.target === modalBackdrop) closeModal(); });
window.closeModal = closeModal;

document.getElementById('settingsBtn').addEventListener('click', ()=>{
  const s = STATE.settings;
  openModal(`
    <h3 class="modal-title">Pengaturan</h3>
    <div class="field"><label>Nama Usaha Rental</label><input id="setBrand" value="${s.business_name||''}"></div>
    <div class="field"><label>Jumlah Unit Minimal Dikelola</label><input id="setMin" type="number" value="${s.min_units||10}"></div>
    <button class="btn btn-primary btn-block" onclick="saveSettings()">Simpan</button>
    <p class="hint">Data tersimpan di Supabase — bisa diakses dari HP manapun setelah login.</p>
  `);
});
window.saveSettings = async function(){
  const business_name = document.getElementById('setBrand').value.trim() || 'SATRIA RENTAL';
  const min_units = parseInt(document.getElementById('setMin').value) || 10;
  await sb.from('settings').upsert({ id:1, business_name, min_units });
  STATE.settings = { business_name, min_units };
  document.getElementById('brandName').textContent = business_name;
  closeModal();
};

/* ================= RENDER ROUTER ================= */
function render(){
  document.getElementById('brandName').textContent = STATE.settings.business_name || 'SATRIA RENTAL';
  if(currentView==='dashboard') renderDashboard();
  else if(currentView==='armada') renderArmada();
  else if(currentView==='penyewa') renderPenyewa();
  else if(currentView==='kontrak') renderKontrak();
  else if(currentView==='blacklist') renderBlacklist();
}

/* ================= DASHBOARD ================= */
function renderDashboard(){
  const units = STATE.units, contracts = STATE.contracts;
  const tersedia = units.filter(u=>u.status==='tersedia').length;
  const disewa = units.filter(u=>u.status==='disewa').length;
  const perbaikan = units.filter(u=>u.status==='perbaikan').length;
  const belumLunas = contracts.filter(c=>!c.lunas).length;

  app.innerHTML = `
    <div class="section-title">Ringkasan Armada</div>
    <div class="stat-strip">
      <div class="stat-card go"><div class="stat-num">${tersedia}</div><div class="stat-label">Tersedia</div></div>
      <div class="stat-card warn"><div class="stat-num">${disewa}</div><div class="stat-label">Disewa</div></div>
      <div class="stat-card danger"><div class="stat-num">${perbaikan}</div><div class="stat-label">Perbaikan</div></div>
    </div>
    <div class="stat-strip" style="grid-template-columns:1fr 1fr;">
      <div class="stat-card"><div class="stat-num">${units.length}</div><div class="stat-label">Total Unit</div></div>
      <div class="stat-card ${belumLunas>0?'warn':''}"><div class="stat-num">${belumLunas}</div><div class="stat-label">Kontrak Belum Lunas</div></div>
    </div>
    <div class="section-title">Posisi Unit Aktif Disewa</div>
    ${renderPositionList(units)}
  `;
}
function renderPositionList(units){
  const disewa = units.filter(u=>u.status==='disewa');
  if(disewa.length===0) return `<div class="empty-state"><div class="empty-state-ic">🚗</div>Belum ada unit yang sedang disewa.</div>`;
  return disewa.map(u=>{
    const hasCoord = u.lat && u.lng;
    const mapsUrl = hasCoord ? `https://www.google.com/maps?q=${u.lat},${u.lng}` : null;
    return `
      <a class="map-link" href="${mapsUrl||'#'}" target="_blank" onclick="${mapsUrl?'':'event.preventDefault(); alert(\'Posisi belum diinput. Buka Armada > unit ini > Update Posisi.\')'}">
        <div>
          <div class="unit-model">${u.model}</div>
          <small>${u.plat} · ${u.tracker_brand?('GPS: '+u.tracker_brand+' · '):''}update: ${fmtDate(u.last_update)}</small>
        </div>
        <div>${hasCoord ? '📍 Lihat Peta' : '⚠ Belum ada titik'}</div>
      </a>
    `;
  }).join('');
}

/* ================= ARMADA (UNITS) ================= */
function renderArmada(){
  const units = STATE.units;
  app.innerHTML = `
    <div class="section-title">Daftar Unit (${units.length})</div>
    <div class="fleet-grid">
      ${units.length ? units.map(unitCardHTML).join('') : `<div class="empty-state"><div class="empty-state-ic">🚗</div>Belum ada unit. Tambah unit baru lewat tombol +.</div>`}
    </div>
    <button class="fab" onclick="openUnitForm()">+</button>
  `;
}
function unitCardHTML(u){
  return `
    <div class="unit-card" onclick="openUnitForm('${u.id}')">
      <span class="led ${u.status}"></span>
      <div class="unit-info">
        <div class="unit-model">${u.model} <span class="plat" style="font-size:.7rem; padding:2px 6px;">${u.plat}</span></div>
        <div class="unit-sub">Tahun ${u.tahun} · ${u.lokasi||'-'}</div>
      </div>
      <span class="status-pill ${u.status}">${u.status}</span>
    </div>
  `;
}
const TRACKER_BRANDS = ['(Belum dipasang)','Super Spring VT-100 M','Super Spring PORTA M20','Concox (Wetrack/GT06N)','Sinotrack ST-901','Sinotrack ST-905','GPS KU','TKSTAR TK905','TKSTAR TK915','Lainnya'];
window.openUnitForm = function(id){
  const u = STATE.units.find(x=>x.id===id) || { id:'', plat:'', model:'', tahun:new Date().getFullYear(), status:'tersedia', lokasi:'Pool Satria Rental', lat:'', lng:'', tracker_brand:'', last_update:todayISO() };
  openModal(`
    <h3 class="modal-title">${id?'Edit Unit':'Tambah Unit'}</h3>
    <div class="field"><label>Model Mobil</label><input id="uModel" value="${u.model}" placeholder="cth: Suzuki XL7"></div>
    <div class="field"><label>Plat Nomor</label><input id="uPlat" value="${u.plat}" placeholder="cth: W 1039 YS"></div>
    <div class="field"><label>Tahun</label><input id="uTahun" type="number" value="${u.tahun}"></div>
    <div class="field"><label>Status</label>
      <select id="uStatus">
        <option value="tersedia" ${u.status==='tersedia'?'selected':''}>Tersedia</option>
        <option value="disewa" ${u.status==='disewa'?'selected':''}>Disewa</option>
        <option value="perbaikan" ${u.status==='perbaikan'?'selected':''}>Perbaikan</option>
      </select>
    </div>
    <div class="field"><label>Lokasi / Keterangan</label><input id="uLokasi" value="${u.lokasi||''}"></div>
    <div class="section-title" style="margin-top:4px;">GPS Tracker Terpasang</div>
    <div class="field"><label>Merk / Tipe Tracker</label>
      <select id="uTrackerBrand">${TRACKER_BRANDS.map(b=>`<option ${u.tracker_brand===b?'selected':''}>${b}</option>`).join('')}</select>
    </div>
    <p class="hint" style="margin-bottom:10px;">Buka app/platform bawaan tracker di atas untuk lihat koordinat unit, lalu salin manual ke bawah ini.</p>
    <div class="field"><label>Latitude</label><input id="uLat" value="${u.lat||''}" placeholder="-7.4478"></div>
    <div class="field"><label>Longitude</label><input id="uLng" value="${u.lng||''}" placeholder="112.7183"></div>
    <button class="btn btn-primary btn-block" onclick="saveUnit('${id||''}')">Simpan</button>
    ${id?`<button class="btn btn-danger btn-block" style="margin-top:8px;" onclick="deleteUnit('${id}')">Hapus Unit</button>`:''}
  `);
};
window.saveUnit = async function(id){
  const data = {
    plat: document.getElementById('uPlat').value.trim(),
    model: document.getElementById('uModel').value.trim(),
    tahun: parseInt(document.getElementById('uTahun').value)||new Date().getFullYear(),
    status: document.getElementById('uStatus').value,
    lokasi: document.getElementById('uLokasi').value.trim(),
    tracker_brand: document.getElementById('uTrackerBrand').value,
    lat: document.getElementById('uLat').value.trim(),
    lng: document.getElementById('uLng').value.trim(),
    last_update: todayISO()
  };
  if(!data.model || !data.plat){ alert('Model dan plat nomor wajib diisi.'); return; }
  if(id){
    const { data: row, error } = await sb.from('units').update(data).eq('id', id).select().single();
    if(error){ alert('Gagal simpan: '+error.message); return; }
    const idx = STATE.units.findIndex(x=>x.id===id); STATE.units[idx] = row;
  } else {
    const { data: row, error } = await sb.from('units').insert(data).select().single();
    if(error){ alert('Gagal simpan: '+error.message); return; }
    STATE.units.push(row);
  }
  closeModal(); render();
};
window.deleteUnit = async function(id){
  if(!confirm('Hapus unit ini?')) return;
  const { error } = await sb.from('units').delete().eq('id', id);
  if(error){ alert('Gagal hapus: '+error.message); return; }
  STATE.units = STATE.units.filter(x=>x.id!==id);
  closeModal(); render();
};

/* ================= PENYEWA (CUSTOMERS) ================= */
function renderPenyewa(){
  const customers = STATE.customers;
  app.innerHTML = `
    <div class="section-title">Data Penyewa (${customers.length})</div>
    ${customers.length ? `<button class="btn btn-ghost btn-block" style="margin-bottom:12px;" onclick="printAllCustomers()">🖨 Cetak Semua Data Penyewa</button>` : ''}
    ${customers.length ? customers.map(customerCardHTML).join('') : `<div class="empty-state"><div class="empty-state-ic">🪪</div>Belum ada penyewa terdaftar.</div>`}
    <button class="fab" onclick="openCustomerForm()">+</button>
  `;
}
function customerCardHTML(c){
  const faceBadge = c.face_match_score == null ? ''
    : c.face_verified ? '<span class="badge lunas">Wajah Cocok</span>'
    : '<span class="badge telat">Wajah Perlu Dicek</span>';
  return `
    <div class="list-card">
      <div class="list-card-top">
        <div><div class="list-card-name">${c.nama}</div><div class="list-card-sub">${c.hp||'-'}</div></div>
        ${faceBadge}
      </div>
      <div class="list-card-meta">NIK: ${c.nik||'-'}<br>${c.alamat||'-'}</div>
      <div class="list-card-actions">
        <button class="btn btn-ghost" onclick="openCustomerForm('${c.id}')">Edit</button>
        <button class="btn btn-danger" onclick="deleteCustomer('${c.id}')">Hapus</button>
      </div>
    </div>
  `;
}
/* ================= VERIFIKASI WAJAH ================= */
const FACE_MODEL_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights';
let faceModelsLoaded = false;
async function loadFaceModels(){
  if(faceModelsLoaded) return;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_URL)
  ]);
  faceModelsLoaded = true;
}
function loadImageEl(src){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = ()=>resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
function faceResultHTML(score, verified){
  if(score === null) return `<p class="hint" style="color:var(--alert);">Wajah tidak terdeteksi di salah satu foto. Pastikan wajah terlihat jelas, lalu ulangi.</p>`;
  const pct = Math.round(score*100);
  const cls = verified ? 'go' : (pct>=40 ? 'warn' : 'danger');
  const label = verified ? 'Cocok' : (pct>=40 ? 'Perlu Dicek Manual' : 'Kemungkinan Tidak Cocok');
  return `<div class="face-score ${cls}"><strong>${label}</strong> — kemiripan ${pct}%<br><span class="hint">Tetap cocokkan manual dengan KTP fisik saat serah terima.</span></div>`;
}
window.runFaceCheck = async function(){
  const ktpSrc = document.getElementById('cKtpPrev').src;
  const selfieSrc = document.getElementById('cSelfiePrev').src;
  if(!ktpSrc || !selfieSrc || !ktpSrc.startsWith('data:') && !ktpSrc.startsWith('http') || (!selfieSrc.startsWith('data:') && !selfieSrc.startsWith('http'))){
    alert('Upload dulu foto KTP dan foto selfie sebelum cek kecocokan.'); return;
  }
  const btn = document.getElementById('cCheckFaceBtn');
  btn.textContent = 'Memuat model AI...'; btn.disabled = true;
  try{
    await loadFaceModels();
    btn.textContent = 'Menganalisis wajah...';
    const [ktpImg, selfieImg] = await Promise.all([loadImageEl(ktpSrc), loadImageEl(selfieSrc)]);
    const opts = new faceapi.TinyFaceDetectorOptions();
    const ktpDet = await faceapi.detectSingleFace(ktpImg, opts).withFaceLandmarks().withFaceDescriptor();
    const selfieDet = await faceapi.detectSingleFace(selfieImg, opts).withFaceLandmarks().withFaceDescriptor();
    if(!ktpDet || !selfieDet){
      window._faceScore = null; window._faceVerified = false;
      document.getElementById('faceResult').innerHTML = faceResultHTML(null, false);
    } else {
      const dist = faceapi.euclideanDistance(ktpDet.descriptor, selfieDet.descriptor);
      const score = Math.max(0, 1 - dist/1.0);
      const verified = dist < 0.5;
      window._faceScore = Math.round(score*1000)/1000;
      window._faceVerified = verified;
      document.getElementById('faceResult').innerHTML = faceResultHTML(window._faceScore, verified);
    }
  }catch(e){
    document.getElementById('faceResult').innerHTML = `<p class="hint" style="color:var(--alert);">Gagal menganalisis: ${e.message}</p>`;
  }
  btn.textContent = '🔍 Cek Kecocokan Wajah KTP & Selfie'; btn.disabled = false;
};


  const c = STATE.customers.find(x=>x.id===id) || { id:'', nama:'', nik:'', hp:'', alamat:'', ktp_foto:'', selfie_foto:'' };
  openModal(`
    <h3 class="modal-title">${id?'Edit Penyewa':'Tambah Penyewa'}</h3>
    <div class="field"><label>Nama Lengkap</label><input id="cNama" value="${c.nama}"></div>
    <div class="field"><label>NIK</label><input id="cNik" value="${c.nik}" maxlength="16"></div>
    <div class="field"><label>No. HP</label><input id="cHp" value="${c.hp}"></div>
    <div class="field"><label>Alamat</label><textarea id="cAlamat">${c.alamat}</textarea></div>
    <div class="field">
      <label>Foto KTP</label>
      <input type="file" accept="image/*" id="cKtpFile">
      <img id="cKtpPrev" class="file-preview" src="${c.ktp_foto||''}" style="${c.ktp_foto?'display:block':''}">
    </div>
    <div class="field">
      <label>Foto Selfie (wajib pakai kamera langsung, bukan galeri)</label>
      <input type="file" accept="image/*" capture="user" id="cSelfieFile">
      <img id="cSelfiePrev" class="file-preview" src="${c.selfie_foto||''}" style="${c.selfie_foto?'display:block':''}">
    </div>
    <button class="btn btn-ghost btn-block" id="cCheckFaceBtn" onclick="runFaceCheck()">🔍 Cek Kecocokan Wajah KTP & Selfie</button>
    <div id="faceResult" class="face-result"></div>
    <button class="btn btn-primary btn-block" id="cSaveBtn" style="margin-top:12px;" onclick="saveCustomer('${id||''}')">Simpan</button>
    ${id?`<button class="btn btn-danger btn-block" style="margin-top:8px;" onclick="deleteCustomer('${id}')">Hapus Penyewa</button>`:''}
  `);
  window._faceScore = c.face_match_score || null;
  window._faceVerified = c.face_verified || false;
  if(c.face_match_score){
    document.getElementById('faceResult').innerHTML = faceResultHTML(c.face_match_score, c.face_verified);
  }
  ['cKtpFile','cSelfieFile'].forEach(fid=>{
    document.getElementById(fid).addEventListener('change', (e)=>{
      const file = e.target.files[0]; if(!file) return;
      const prevId = fid==='cKtpFile'?'cKtpPrev':'cSelfiePrev';
      const reader = new FileReader();
      reader.onload = (ev)=>{ const img = document.getElementById(prevId); img.src = ev.target.result; img.style.display='block'; };
      reader.readAsDataURL(file);
    });
  });
};
window.saveCustomer = async function(id){
  const nama = document.getElementById('cNama').value.trim();
  const nik = document.getElementById('cNik').value.trim();
  if(!nama || !nik){ alert('Nama dan NIK wajib diisi untuk verifikasi.'); return; }

  const flagged = STATE.blacklist.find(b=>b.nik === nik);
  if(flagged && !confirm(`⚠ PERINGATAN: NIK ini tercatat di blacklist internal Anda (alasan: ${flagged.alasan}). Tetap lanjutkan simpan data penyewa ini?`)) return;

  const btn = document.getElementById('cSaveBtn'); btn.textContent = 'Menyimpan...'; btn.disabled = true;

  const ktpFile = document.getElementById('cKtpFile').files[0];
  const selfieFile = document.getElementById('cSelfieFile').files[0];
  const existing = STATE.customers.find(x=>x.id===id) || {};
  let ktp_foto = existing.ktp_foto || '';
  let selfie_foto = existing.selfie_foto || '';
  if(ktpFile) ktp_foto = await uploadFile(ktpFile, 'ktp') || ktp_foto;
  if(selfieFile) selfie_foto = await uploadFile(selfieFile, 'selfie') || selfie_foto;

  const data = {
    nama, nik,
    hp: document.getElementById('cHp').value.trim(),
    alamat: document.getElementById('cAlamat').value.trim(),
    ktp_foto, selfie_foto,
    face_match_score: window._faceScore ?? null,
    face_verified: window._faceVerified ?? false
  };
  if(id){
    const { data: row, error } = await sb.from('customers').update(data).eq('id', id).select().single();
    if(error){ alert('Gagal simpan: '+error.message); return; }
    const idx = STATE.customers.findIndex(x=>x.id===id); STATE.customers[idx] = row;
  } else {
    const { data: row, error } = await sb.from('customers').insert(data).select().single();
    if(error){ alert('Gagal simpan: '+error.message); return; }
    STATE.customers.push(row);
  }
  closeModal(); render();
};
window.deleteCustomer = async function(id){
  if(!confirm('Hapus data penyewa ini?')) return;
  const { error } = await sb.from('customers').delete().eq('id', id);
  if(error){ alert('Gagal hapus: '+error.message); return; }
  STATE.customers = STATE.customers.filter(x=>x.id!==id);
  closeModal(); render();
};

window.printAllCustomers = function(){
  const customers = STATE.customers, s = STATE.settings, contracts = STATE.contracts, units = STATE.units, bl = STATE.blacklist;
  const rows = customers.map((c,i)=>{
    const flagged = bl.some(b=>b.nik===c.nik);
    const custContracts = contracts.filter(k=>k.customer_id===c.id);
    const riwayat = custContracts.length
      ? custContracts.map(k=>{
          const u = units.find(x=>x.id===k.unit_id);
          return `${u?u.model+' ('+u.plat+')':'-'}: ${fmtDate(k.tgl_mulai)}–${fmtDate(k.tgl_selesai)}, jaminan ${fmtMoney(k.deposit)}, ${k.lunas?'lunas':'belum lunas'}`;
        }).join('<br>')
      : '-';
    return `
      <div class="print-record">
        <div class="print-record-head"><strong>${i+1}. ${c.nama}</strong> ${flagged?'<span class="print-flag">⚠ BLACKLIST</span>':''}</div>
        <table class="print-table">
          <tr><td>NIK</td><td>${c.nik||'-'}</td></tr>
          <tr><td>No. HP</td><td>${c.hp||'-'}</td></tr>
          <tr><td>Alamat</td><td>${c.alamat||'-'}</td></tr>
          <tr><td>Terdaftar</td><td>${fmtDate(c.created_at)}</td></tr>
          <tr><td>Riwayat Sewa</td><td>${riwayat}</td></tr>
        </table>
        <div class="print-photos">
          ${c.ktp_foto?`<div><small>Foto KTP</small><img src="${c.ktp_foto}"></div>`:''}
          ${c.selfie_foto?`<div><small>Foto Selfie</small><img src="${c.selfie_foto}"></div>`:''}
        </div>
      </div>
    `;
  }).join('');
  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>Data Penyewa - ${s.business_name||'Satria Rental'}</title>
    <style>
      body{font-family:Arial, sans-serif; padding:24px; color:#111;}
      h1{font-size:18px; margin-bottom:2px;}
      .sub{color:#555; font-size:12px; margin-bottom:20px;}
      .print-record{border-bottom:1px solid #ccc; padding:14px 0; page-break-inside:avoid;}
      .print-record-head{font-size:14px; margin-bottom:6px;}
      .print-flag{color:#b02a2a; font-weight:bold; font-size:11px; margin-left:6px;}
      .print-table{width:100%; border-collapse:collapse; font-size:12px; margin-bottom:8px;}
      .print-table td{padding:3px 6px; vertical-align:top; border-bottom:1px solid #eee;}
      .print-table td:first-child{width:120px; color:#666;}
      .print-photos{display:flex; gap:12px;}
      .print-photos img{max-width:160px; max-height:110px; object-fit:contain; border:1px solid #ccc;}
      .print-photos small{display:block; color:#666; font-size:10px; margin-bottom:2px;}
      @media print{ body{padding:0;} }
    </style>
    </head><body>
    <h1>${s.business_name||'Satria Rental'} — Rekap Data Penyewa</h1>
    <div class="sub">Dicetak: ${fmtDate(todayISO())} · Total penyewa: ${customers.length}</div>
    ${rows}
    </body></html>
  `);
  win.document.close(); win.focus();
  setTimeout(()=>win.print(), 300);
};

/* ================= KONTRAK (CONTRACTS) ================= */
function renderKontrak(){
  const contracts = STATE.contracts;
  app.innerHTML = `
    <div class="section-title">Kontrak Sewa (${contracts.length})</div>
    ${contracts.length ? contracts.map(contractCardHTML).join('') : `<div class="empty-state"><div class="empty-state-ic">📄</div>Belum ada kontrak. Buat kontrak baru untuk mulai sewa.</div>`}
    <button class="fab" onclick="openContractForm()">+</button>
  `;
}
function contractCardHTML(c){
  const u = STATE.units.find(x=>x.id===c.unit_id);
  const cust = STATE.customers.find(x=>x.id===c.customer_id);
  const badge = c.lunas ? '<span class="badge lunas">Lunas</span>' : (new Date(c.tgl_selesai) < new Date() ? '<span class="badge telat">Telat</span>' : '<span class="badge belum">Belum Lunas</span>');
  return `
    <div class="list-card">
      <div class="list-card-top">
        <div>
          <div class="list-card-name">${cust?cust.nama:'(penyewa dihapus)'}</div>
          <div class="list-card-sub">${u?u.model+' · '+u.plat:'(unit dihapus)'}</div>
        </div>
        ${badge}
      </div>
      <div class="list-card-meta">${fmtDate(c.tgl_mulai)} → ${fmtDate(c.tgl_selesai)}<br>Jaminan: ${fmtMoney(c.deposit)} ${c.denda?('· Denda: '+fmtMoney(c.denda)):''}</div>
      <div class="list-card-actions">
        <button class="btn btn-ghost" onclick="viewContract('${c.id}')">Lihat Kontrak</button>
        <button class="btn btn-ghost" onclick="toggleLunas('${c.id}')">${c.lunas?'Tandai Belum Lunas':'Tandai Lunas'}</button>
      </div>
    </div>
  `;
}
window.toggleLunas = async function(id){
  const c = STATE.contracts.find(x=>x.id===id);
  const { data, error } = await sb.from('contracts').update({ lunas: !c.lunas }).eq('id', id).select().single();
  if(error){ alert('Gagal update: '+error.message); return; }
  const idx = STATE.contracts.findIndex(x=>x.id===id); STATE.contracts[idx] = data;
  render();
};

window.openContractForm = function(){
  const units = STATE.units.filter(u=>u.status==='tersedia');
  const customers = STATE.customers;
  if(customers.length===0){ alert('Tambahkan data penyewa dulu di tab Penyewa (wajib upload KTP untuk verifikasi).'); return; }
  if(units.length===0){ alert('Tidak ada unit berstatus tersedia saat ini.'); return; }
  openModal(`
    <h3 class="modal-title">Buat Kontrak Sewa</h3>
    <div class="field"><label>Penyewa</label><select id="kCustomer">${customers.map(c=>`<option value="${c.id}">${c.nama} — NIK ${c.nik}</option>`).join('')}</select></div>
    <div class="field"><label>Unit</label><select id="kUnit">${units.map(u=>`<option value="${u.id}">${u.model} — ${u.plat}</option>`).join('')}</select></div>
    <div class="field"><label>Tanggal Mulai</label><input id="kMulai" type="date" value="${todayISO()}"></div>
    <div class="field"><label>Tanggal Selesai</label><input id="kSelesai" type="date"></div>
    <div class="field"><label>Jaminan / Deposit (Rp)</label><input id="kDeposit" type="number" placeholder="cth: 500000"></div>
    <div class="clause-box">
      <strong>Klausul Kontrak:</strong><br>
      1. Unit dilengkapi perangkat GPS tracker yang aktif selama masa sewa untuk keperluan keamanan aset. Penyewa memahami dan menyetujui hal ini.<br>
      2. Jaminan/deposit akan dikembalikan setelah unit dikembalikan dalam kondisi baik dan sesuai kesepakatan.<br>
      3. Penyewa dilarang menggadaikan, mengalihkan, atau mengubah dokumen/plat unit tanpa izin tertulis pemilik.<br>
      4. Pelanggaran atas poin 3 dapat diproses secara hukum sesuai ketentuan yang berlaku.
    </div>
    <div class="field"><label><input type="checkbox" id="kSetuju" style="width:auto; margin-right:6px;">Penyewa menyetujui seluruh klausul di atas</label></div>
    <div class="field">
      <label>Tanda Tangan Penyewa</label>
      <div class="sig-wrap"><canvas id="sigCanvas"></canvas></div>
      <button class="btn btn-ghost" style="margin-top:8px;" onclick="clearSig()">Bersihkan Tanda Tangan</button>
    </div>
    <button class="btn btn-primary btn-block" id="kSaveBtn" style="margin-top:6px;" onclick="saveContract()">Buat Kontrak & Tandai Unit Disewa</button>
  `);
  setTimeout(initSignaturePad, 50);
};

let sigCtx, sigDrawing=false, sigHasContent=false;
function initSignaturePad(){
  const canvas = document.getElementById('sigCanvas'); if(!canvas) return;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio; canvas.height = rect.height * devicePixelRatio;
  sigCtx = canvas.getContext('2d'); sigCtx.scale(devicePixelRatio, devicePixelRatio);
  sigCtx.strokeStyle = '#F4F1EA'; sigCtx.lineWidth = 2; sigCtx.lineCap = 'round';
  sigHasContent = false;
  function pos(e){ const r = canvas.getBoundingClientRect(); const p = e.touches ? e.touches[0] : e; return { x: p.clientX - r.left, y: p.clientY - r.top }; }
  function start(e){ sigDrawing=true; sigHasContent=true; const p=pos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x,p.y); e.preventDefault(); }
  function move(e){ if(!sigDrawing) return; const p=pos(e); sigCtx.lineTo(p.x,p.y); sigCtx.stroke(); e.preventDefault(); }
  function end(){ sigDrawing=false; }
  canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, {passive:false}); canvas.addEventListener('touchmove', move, {passive:false}); canvas.addEventListener('touchend', end);
}
window.clearSig = function(){ const canvas = document.getElementById('sigCanvas'); sigCtx.clearRect(0,0,canvas.width,canvas.height); sigHasContent = false; };

window.saveContract = async function(){
  if(!document.getElementById('kSetuju').checked){ alert('Penyewa harus menyetujui klausul kontrak (termasuk klausul GPS) sebelum kontrak dibuat.'); return; }
  if(!sigHasContent){ alert('Tanda tangan penyewa wajib diisi.'); return; }
  const tgl_selesai = document.getElementById('kSelesai').value;
  if(!tgl_selesai){ alert('Tanggal selesai wajib diisi.'); return; }

  const btn = document.getElementById('kSaveBtn'); btn.textContent = 'Menyimpan...'; btn.disabled = true;

  const customer_id = document.getElementById('kCustomer').value;
  const unit_id = document.getElementById('kUnit').value;
  const sigDataUrl = document.getElementById('sigCanvas').toDataURL();
  const signature = await uploadDataUrl(sigDataUrl, 'signatures');

  const payload = {
    customer_id, unit_id,
    tgl_mulai: document.getElementById('kMulai').value,
    tgl_selesai, deposit: parseInt(document.getElementById('kDeposit').value)||0,
    denda: 0, lunas:false, signature
  };
  const { data: row, error } = await sb.from('contracts').insert(payload).select().single();
  if(error){ alert('Gagal simpan kontrak: '+error.message); return; }
  STATE.contracts.unshift(row);

  const { data: unitRow, error: unitErr } = await sb.from('units').update({ status:'disewa' }).eq('id', unit_id).select().single();
  if(!unitErr){ const idx = STATE.units.findIndex(u=>u.id===unit_id); STATE.units[idx] = unitRow; }

  closeModal();
  currentView='kontrak';
  tabs.forEach(t=>t.classList.toggle('active', t.dataset.view==='kontrak'));
  render();
};

window.viewContract = function(id){
  const c = STATE.contracts.find(x=>x.id===id);
  const u = STATE.units.find(x=>x.id===c.unit_id);
  const cust = STATE.customers.find(x=>x.id===c.customer_id);
  const s = STATE.settings;
  openModal(`
    <h3 class="modal-title">Kontrak Sewa</h3>
    <p class="hint">${s.business_name||'Satria Rental'} — dibuat ${fmtDate(c.created_at)}</p>
    <div class="list-card-meta" style="margin-bottom:14px;">
      Penyewa: ${cust?cust.nama:'-'} (NIK ${cust?cust.nik:'-'})<br>
      Unit: ${u?u.model+' / '+u.plat:'-'}<br>
      Periode: ${fmtDate(c.tgl_mulai)} — ${fmtDate(c.tgl_selesai)}<br>
      Jaminan: ${fmtMoney(c.deposit)}<br>
      Status: ${c.lunas?'Lunas':'Belum Lunas'}
    </div>
    <div class="clause-box">Kontrak ini mencakup klausul GPS tracker aktif pada unit selama masa sewa, dan ketentuan jaminan/deposit sebagaimana disepakati kedua pihak.</div>
    <label style="font-size:.78rem;color:var(--chrome-dim); text-transform:uppercase;">Tanda Tangan Penyewa</label>
    <img src="${c.signature}" style="width:100%; background:#0B0C0D; border-radius:8px; margin-top:6px;">
    <button class="btn btn-ghost btn-block" style="margin-top:14px;" onclick="window.print()">Cetak / Simpan PDF</button>
  `);
};

/* ================= BLACKLIST ================= */
function renderBlacklist(){
  const bl = STATE.blacklist;
  app.innerHTML = `
    <div class="section-title">Blacklist Internal (${bl.length})</div>
    <p class="hint" style="margin-bottom:14px;">Catatan penyewa bermasalah berdasarkan riwayat transaksi bisnis Anda sendiri. NIK yang masuk daftar ini otomatis memicu peringatan saat didaftarkan sebagai penyewa baru.</p>
    ${bl.length ? bl.map(blacklistCardHTML).join('') : `<div class="empty-state"><div class="empty-state-ic">⛔</div>Belum ada catatan blacklist.</div>`}
    <button class="fab" onclick="openBlacklistForm()">+</button>
  `;
}
function blacklistCardHTML(b){
  return `
    <div class="list-card">
      <div class="list-card-top"><div><div class="list-card-name">${b.nama}</div><div class="list-card-sub">NIK: ${b.nik}</div></div></div>
      <div class="list-card-meta">${b.alasan}<br>Dicatat: ${fmtDate(b.tgl_input)}</div>
      <div class="list-card-actions"><button class="btn btn-danger" onclick="deleteBlacklist('${b.id}')">Hapus</button></div>
    </div>
  `;
}
window.openBlacklistForm = function(){
  openModal(`
    <h3 class="modal-title">Tambah Catatan Blacklist</h3>
    <div class="field"><label>Nama</label><input id="bNama"></div>
    <div class="field"><label>NIK</label><input id="bNik" maxlength="16"></div>
    <div class="field"><label>Alasan</label><textarea id="bAlasan" placeholder="cth: menggadaikan unit tanpa izin, kabur saat jatuh tempo, dll."></textarea></div>
    <button class="btn btn-primary btn-block" onclick="saveBlacklist()">Simpan</button>
  `);
};
window.saveBlacklist = async function(){
  const nama = document.getElementById('bNama').value.trim();
  const nik = document.getElementById('bNik').value.trim();
  const alasan = document.getElementById('bAlasan').value.trim();
  if(!nama || !nik || !alasan){ alert('Semua kolom wajib diisi.'); return; }
  const { data, error } = await sb.from('blacklist').insert({ nama, nik, alasan }).select().single();
  if(error){ alert('Gagal simpan: '+error.message); return; }
  STATE.blacklist.unshift(data);
  closeModal(); render();
};
window.deleteBlacklist = async function(id){
  if(!confirm('Hapus catatan ini?')) return;
  const { error } = await sb.from('blacklist').delete().eq('id', id);
  if(error){ alert('Gagal hapus: '+error.message); return; }
  STATE.blacklist = STATE.blacklist.filter(x=>x.id!==id);
  render();
};

/* ================= PWA / INIT ================= */
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{ navigator.serviceWorker.register('sw.js').catch(()=>{}); });
}
if(sb) checkExistingSession();
