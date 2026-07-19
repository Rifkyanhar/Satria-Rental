/* ================= DATA LAYER ================= */
const DB = {
  get(key, fallback){ try{ const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; }catch(e){ return fallback; } },
  set(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
};

const KEYS = { settings:'sr_settings', units:'sr_units', customers:'sr_customers', contracts:'sr_contracts', blacklist:'sr_blacklist' };

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function fmtDate(d){ if(!d) return '-'; const dt=new Date(d); return dt.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}); }
function fmtMoney(n){ return 'Rp' + (Number(n)||0).toLocaleString('id-ID'); }

function seedIfEmpty(){
  if(!localStorage.getItem(KEYS.settings)){
    DB.set(KEYS.settings, { businessName:'SATRIA RENTAL', minUnits:10 });
  }
  if(!localStorage.getItem(KEYS.units)){
    const models = ['Toyota Avanza','Honda Brio','Suzuki XL7','Toyota Innova','Daihatsu Xenia','Honda Mobilio','Toyota Calya','Mitsubishi Xpander','Suzuki Ertiga','Toyota Rush'];
    const units = models.map((m,i)=>({
      id: uid(),
      plat: `W ${1000+i*37} XX`,
      model: m,
      tahun: 2021 + (i % 4),
      status: 'tersedia',
      lokasi: 'Pool Satria Rental',
      lat:'', lng:'',
      lastUpdate: todayISO()
    }));
    DB.set(KEYS.units, units);
  }
  if(!localStorage.getItem(KEYS.customers)) DB.set(KEYS.customers, []);
  if(!localStorage.getItem(KEYS.contracts)) DB.set(KEYS.contracts, []);
  if(!localStorage.getItem(KEYS.blacklist)) DB.set(KEYS.blacklist, []);
}
seedIfEmpty();

/* ================= NAV / MODAL ================= */
const app = document.getElementById('app');
const tabs = document.querySelectorAll('.tab');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalBody = document.getElementById('modalBody');
let currentView = 'dashboard';

tabs.forEach(t=>t.addEventListener('click', ()=>{
  tabs.forEach(x=>x.classList.remove('active'));
  t.classList.add('active');
  currentView = t.dataset.view;
  render();
}));

function openModal(html){
  modalBody.innerHTML = `<button class="modal-close" onclick="closeModal()">✕</button>${html}`;
  modalBackdrop.classList.add('open');
}
function closeModal(){ modalBackdrop.classList.remove('open'); }
modalBackdrop.addEventListener('click', (e)=>{ if(e.target === modalBackdrop) closeModal(); });
window.closeModal = closeModal;

document.getElementById('settingsBtn').addEventListener('click', ()=>{
  const s = DB.get(KEYS.settings, {});
  openModal(`
    <h3 class="modal-title">Pengaturan</h3>
    <div class="field"><label>Nama Usaha Rental</label><input id="setBrand" value="${s.businessName||''}"></div>
    <div class="field"><label>Jumlah Unit Minimal Dikelola</label><input id="setMin" type="number" value="${s.minUnits||10}"></div>
    <button class="btn btn-primary btn-block" onclick="saveSettings()">Simpan</button>
    <p class="hint">Data tersimpan langsung di HP ini (offline). Belum ada sinkronisasi cloud.</p>
  `);
});
window.saveSettings = function(){
  const businessName = document.getElementById('setBrand').value.trim() || 'SATRIA RENTAL';
  const minUnits = parseInt(document.getElementById('setMin').value) || 10;
  DB.set(KEYS.settings, { businessName, minUnits });
  document.getElementById('brandName').textContent = businessName;
  closeModal();
};

/* ================= RENDER ROUTER ================= */
function render(){
  const s = DB.get(KEYS.settings, {});
  document.getElementById('brandName').textContent = s.businessName || 'SATRIA RENTAL';
  if(currentView==='dashboard') renderDashboard();
  else if(currentView==='armada') renderArmada();
  else if(currentView==='penyewa') renderPenyewa();
  else if(currentView==='kontrak') renderKontrak();
  else if(currentView==='blacklist') renderBlacklist();
}

/* ================= DASHBOARD ================= */
function renderDashboard(){
  const units = DB.get(KEYS.units, []);
  const contracts = DB.get(KEYS.contracts, []);
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
  if(disewa.length===0){
    return `<div class="empty-state"><div class="empty-state-ic">🚗</div>Belum ada unit yang sedang disewa.</div>`;
  }
  return disewa.map(u=>{
    const hasCoord = u.lat && u.lng;
    const mapsUrl = hasCoord ? `https://www.google.com/maps?q=${u.lat},${u.lng}` : null;
    return `
      <a class="map-link" href="${mapsUrl||'#'}" target="_blank" onclick="${mapsUrl?'':'event.preventDefault(); alert(\'Posisi belum diinput. Buka Armada > unit ini > Update Posisi.\')'}">
        <div>
          <div class="unit-model">${u.model}</div>
          <small>${u.plat} · update terakhir: ${fmtDate(u.lastUpdate)}</small>
        </div>
        <div>${hasCoord ? '📍 Lihat Peta' : '⚠ Belum ada titik'}</div>
      </a>
    `;
  }).join('');
}

/* ================= ARMADA (UNITS) ================= */
function renderArmada(){
  const units = DB.get(KEYS.units, []);
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
window.openUnitForm = function(id){
  const units = DB.get(KEYS.units, []);
  const u = units.find(x=>x.id===id) || { id:'', plat:'', model:'', tahun:new Date().getFullYear(), status:'tersedia', lokasi:'Pool Satria Rental', lat:'', lng:'', lastUpdate:todayISO() };
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
    <div class="section-title" style="margin-top:4px;">Update Posisi (dari perangkat GPS unit)</div>
    <p class="hint" style="margin-bottom:10px;">Isi koordinat dari GPS tracker yang terpasang di mobil — bukan dari HP penyewa. Wajib dicantumkan di kontrak sewa agar sah secara hukum.</p>
    <div class="field"><label>Latitude</label><input id="uLat" value="${u.lat||''}" placeholder="-7.4478"></div>
    <div class="field"><label>Longitude</label><input id="uLng" value="${u.lng||''}" placeholder="112.7183"></div>
    <button class="btn btn-primary btn-block" onclick="saveUnit('${id||''}')">Simpan</button>
    ${id?`<button class="btn btn-danger btn-block" style="margin-top:8px;" onclick="deleteUnit('${id}')">Hapus Unit</button>`:''}
  `);
};
window.saveUnit = function(id){
  const units = DB.get(KEYS.units, []);
  const data = {
    plat: document.getElementById('uPlat').value.trim(),
    model: document.getElementById('uModel').value.trim(),
    tahun: parseInt(document.getElementById('uTahun').value)||new Date().getFullYear(),
    status: document.getElementById('uStatus').value,
    lokasi: document.getElementById('uLokasi').value.trim(),
    lat: document.getElementById('uLat').value.trim(),
    lng: document.getElementById('uLng').value.trim(),
    lastUpdate: todayISO()
  };
  if(!data.model || !data.plat){ alert('Model dan plat nomor wajib diisi.'); return; }
  if(id){
    const idx = units.findIndex(x=>x.id===id);
    units[idx] = {...units[idx], ...data};
  } else {
    units.push({ id: uid(), ...data });
  }
  DB.set(KEYS.units, units);
  closeModal(); render();
};
window.deleteUnit = function(id){
  if(!confirm('Hapus unit ini?')) return;
  DB.set(KEYS.units, DB.get(KEYS.units, []).filter(x=>x.id!==id));
  closeModal(); render();
};

/* ================= PENYEWA (CUSTOMERS) ================= */
function renderPenyewa(){
  const customers = DB.get(KEYS.customers, []);
  app.innerHTML = `
    <div class="section-title">Data Penyewa (${customers.length})</div>
    ${customers.length ? `<button class="btn btn-ghost btn-block" style="margin-bottom:12px;" onclick="printAllCustomers()">🖨 Cetak Semua Data Penyewa</button>` : ''}
    ${customers.length ? customers.map(customerCardHTML).join('') : `<div class="empty-state"><div class="empty-state-ic">🪪</div>Belum ada penyewa terdaftar.</div>`}
    <button class="fab" onclick="openCustomerForm()">+</button>
  `;
}

window.printAllCustomers = function(){
  const customers = DB.get(KEYS.customers, []);
  const s = DB.get(KEYS.settings, {});
  const contracts = DB.get(KEYS.contracts, []);
  const units = DB.get(KEYS.units, []);
  const bl = DB.get(KEYS.blacklist, []);

  const rows = customers.map((c,i)=>{
    const flagged = bl.some(b=>b.nik===c.nik);
    const custContracts = contracts.filter(k=>k.customerId===c.id);
    const riwayat = custContracts.length
      ? custContracts.map(k=>{
          const u = units.find(x=>x.id===k.unitId);
          return `${u?u.model+' ('+u.plat+')':'-'}: ${fmtDate(k.tglMulai)}–${fmtDate(k.tglSelesai)}, jaminan ${fmtMoney(k.deposit)}, ${k.lunas?'lunas':'belum lunas'}`;
        }).join('<br>')
      : '-';
    return `
      <div class="print-record">
        <div class="print-record-head">
          <strong>${i+1}. ${c.nama}</strong> ${flagged?'<span class="print-flag">⚠ BLACKLIST</span>':''}
        </div>
        <table class="print-table">
          <tr><td>NIK</td><td>${c.nik||'-'}</td></tr>
          <tr><td>No. HP</td><td>${c.hp||'-'}</td></tr>
          <tr><td>Alamat</td><td>${c.alamat||'-'}</td></tr>
          <tr><td>Terdaftar</td><td>${fmtDate(c.createdAt)}</td></tr>
          <tr><td>Riwayat Sewa</td><td>${riwayat}</td></tr>
        </table>
        <div class="print-photos">
          ${c.ktpFoto?`<div><small>Foto KTP</small><img src="${c.ktpFoto}"></div>`:''}
          ${c.selfieFoto?`<div><small>Foto Selfie</small><img src="${c.selfieFoto}"></div>`:''}
        </div>
      </div>
    `;
  }).join('');

  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>Data Penyewa - ${s.businessName||'Satria Rental'}</title>
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
    <h1>${s.businessName||'Satria Rental'} — Rekap Data Penyewa</h1>
    <div class="sub">Dicetak: ${fmtDate(todayISO())} · Total penyewa: ${customers.length}</div>
    ${rows}
    </body></html>
  `);
  win.document.close();
  win.focus();
  setTimeout(()=>win.print(), 300);
};
function customerCardHTML(c){
  return `
    <div class="list-card">
      <div class="list-card-top">
        <div>
          <div class="list-card-name">${c.nama}</div>
          <div class="list-card-sub">${c.hp||'-'}</div>
        </div>
      </div>
      <div class="list-card-meta">NIK: ${c.nik||'-'}<br>${c.alamat||'-'}</div>
      <div class="list-card-actions">
        <button class="btn btn-ghost" onclick="openCustomerForm('${c.id}')">Edit</button>
        <button class="btn btn-danger" onclick="deleteCustomer('${c.id}')">Hapus</button>
      </div>
    </div>
  `;
}
window.openCustomerForm = function(id){
  const list = DB.get(KEYS.customers, []);
  const c = list.find(x=>x.id===id) || { id:'', nama:'', nik:'', hp:'', alamat:'', ktpFoto:'', selfieFoto:'' };
  openModal(`
    <h3 class="modal-title">${id?'Edit Penyewa':'Tambah Penyewa'}</h3>
    <div class="field"><label>Nama Lengkap</label><input id="cNama" value="${c.nama}"></div>
    <div class="field"><label>NIK</label><input id="cNik" value="${c.nik}" maxlength="16"></div>
    <div class="field"><label>No. HP</label><input id="cHp" value="${c.hp}"></div>
    <div class="field"><label>Alamat</label><textarea id="cAlamat">${c.alamat}</textarea></div>
    <div class="field">
      <label>Foto KTP</label>
      <input type="file" accept="image/*" id="cKtpFile" onchange="previewFile(this,'cKtpPrev')">
      <img id="cKtpPrev" class="file-preview" src="${c.ktpFoto||''}" style="${c.ktpFoto?'display:block':''}">
    </div>
    <div class="field">
      <label>Foto Selfie (dengan KTP)</label>
      <input type="file" accept="image/*" id="cSelfieFile" onchange="previewFile(this,'cSelfiePrev')">
      <img id="cSelfiePrev" class="file-preview" src="${c.selfieFoto||''}" style="${c.selfieFoto?'display:block':''}">
    </div>
    <button class="btn btn-primary btn-block" onclick="saveCustomer('${id||''}')">Simpan</button>
    ${id?`<button class="btn btn-danger btn-block" style="margin-top:8px;" onclick="deleteCustomer('${id}')">Hapus Penyewa</button>`:''}
  `);
};
window.previewFile = function(input, previewId){
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (e)=>{
    const img = document.getElementById(previewId);
    img.src = e.target.result;
    img.style.display = 'block';
    img.dataset.base64 = e.target.result;
  };
  reader.readAsDataURL(file);
};
window.saveCustomer = function(id){
  const list = DB.get(KEYS.customers, []);
  const nama = document.getElementById('cNama').value.trim();
  const nik = document.getElementById('cNik').value.trim();
  if(!nama || !nik){ alert('Nama dan NIK wajib diisi untuk verifikasi.'); return; }

  // cek blacklist otomatis
  const bl = DB.get(KEYS.blacklist, []);
  const flagged = bl.find(b=>b.nik === nik);
  if(flagged && !confirm(`⚠ PERINGATAN: NIK ini tercatat di blacklist internal Anda (alasan: ${flagged.alasan}). Tetap lanjutkan simpan data penyewa ini?`)) return;

  const ktpPrev = document.getElementById('cKtpPrev');
  const selfiePrev = document.getElementById('cSelfiePrev');
  const data = {
    nama, nik,
    hp: document.getElementById('cHp').value.trim(),
    alamat: document.getElementById('cAlamat').value.trim(),
    ktpFoto: ktpPrev.dataset.base64 || ktpPrev.src.startsWith('data:') ? (ktpPrev.dataset.base64||ktpPrev.src) : '',
    selfieFoto: selfiePrev.dataset.base64 || (selfiePrev.src.startsWith('data:') ? selfiePrev.src : '')
  };
  if(id){
    const idx = list.findIndex(x=>x.id===id);
    list[idx] = {...list[idx], ...data};
  } else {
    list.push({ id: uid(), ...data, createdAt: todayISO() });
  }
  DB.set(KEYS.customers, list);
  closeModal(); render();
};
window.deleteCustomer = function(id){
  if(!confirm('Hapus data penyewa ini?')) return;
  DB.set(KEYS.customers, DB.get(KEYS.customers, []).filter(x=>x.id!==id));
  closeModal(); render();
};

/* ================= KONTRAK (CONTRACTS) ================= */
function renderKontrak(){
  const contracts = DB.get(KEYS.contracts, []).slice().sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''));
  const units = DB.get(KEYS.units, []);
  const customers = DB.get(KEYS.customers, []);
  app.innerHTML = `
    <div class="section-title">Kontrak Sewa (${contracts.length})</div>
    ${contracts.length ? contracts.map(c=>contractCardHTML(c, units, customers)).join('') : `<div class="empty-state"><div class="empty-state-ic">📄</div>Belum ada kontrak. Buat kontrak baru untuk mulai sewa.</div>`}
    <button class="fab" onclick="openContractForm()">+</button>
  `;
}
function contractCardHTML(c, units, customers){
  const u = units.find(x=>x.id===c.unitId);
  const cust = customers.find(x=>x.id===c.customerId);
  const badge = c.lunas ? '<span class="badge lunas">Lunas</span>' : (new Date(c.tglSelesai) < new Date() ? '<span class="badge telat">Telat</span>' : '<span class="badge belum">Belum Lunas</span>');
  return `
    <div class="list-card">
      <div class="list-card-top">
        <div>
          <div class="list-card-name">${cust?cust.nama:'(penyewa dihapus)'}</div>
          <div class="list-card-sub">${u?u.model+' · '+u.plat:'(unit dihapus)'}</div>
        </div>
        ${badge}
      </div>
      <div class="list-card-meta">
        ${fmtDate(c.tglMulai)} → ${fmtDate(c.tglSelesai)}<br>
        Jaminan: ${fmtMoney(c.deposit)} ${c.denda?('· Denda: '+fmtMoney(c.denda)):''}
      </div>
      <div class="list-card-actions">
        <button class="btn btn-ghost" onclick="viewContract('${c.id}')">Lihat Kontrak</button>
        <button class="btn btn-ghost" onclick="toggleLunas('${c.id}')">${c.lunas?'Tandai Belum Lunas':'Tandai Lunas'}</button>
      </div>
    </div>
  `;
}
window.toggleLunas = function(id){
  const list = DB.get(KEYS.contracts, []);
  const idx = list.findIndex(x=>x.id===id);
  list[idx].lunas = !list[idx].lunas;
  DB.set(KEYS.contracts, list);
  render();
};

window.openContractForm = function(){
  const units = DB.get(KEYS.units, []).filter(u=>u.status==='tersedia');
  const customers = DB.get(KEYS.customers, []);
  if(customers.length===0){ alert('Tambahkan data penyewa dulu di tab Penyewa (wajib upload KTP untuk verifikasi).'); return; }
  if(units.length===0){ alert('Tidak ada unit berstatus tersedia saat ini.'); return; }
  openModal(`
    <h3 class="modal-title">Buat Kontrak Sewa</h3>
    <div class="field"><label>Penyewa</label>
      <select id="kCustomer">${customers.map(c=>`<option value="${c.id}">${c.nama} — NIK ${c.nik}</option>`).join('')}</select>
    </div>
    <div class="field"><label>Unit</label>
      <select id="kUnit">${units.map(u=>`<option value="${u.id}">${u.model} — ${u.plat}</option>`).join('')}</select>
    </div>
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
    <div class="field">
      <label><input type="checkbox" id="kSetuju" style="width:auto; margin-right:6px;">Penyewa menyetujui seluruh klausul di atas</label>
    </div>

    <div class="field">
      <label>Tanda Tangan Penyewa</label>
      <div class="sig-wrap"><canvas id="sigCanvas"></canvas></div>
      <button class="btn btn-ghost" style="margin-top:8px;" onclick="clearSig()">Bersihkan Tanda Tangan</button>
    </div>

    <button class="btn btn-primary btn-block" style="margin-top:6px;" onclick="saveContract()">Buat Kontrak & Tandai Unit Disewa</button>
  `);
  setTimeout(initSignaturePad, 50);
};

let sigCtx, sigDrawing=false, sigHasContent=false;
function initSignaturePad(){
  const canvas = document.getElementById('sigCanvas');
  if(!canvas) return;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;
  sigCtx = canvas.getContext('2d');
  sigCtx.scale(devicePixelRatio, devicePixelRatio);
  sigCtx.strokeStyle = '#F4F1EA';
  sigCtx.lineWidth = 2;
  sigCtx.lineCap = 'round';
  sigHasContent = false;

  function pos(e){
    const r = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: p.clientX - r.left, y: p.clientY - r.top };
  }
  function start(e){ sigDrawing=true; sigHasContent=true; const p=pos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x,p.y); e.preventDefault(); }
  function move(e){ if(!sigDrawing) return; const p=pos(e); sigCtx.lineTo(p.x,p.y); sigCtx.stroke(); e.preventDefault(); }
  function end(){ sigDrawing=false; }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, {passive:false});
  canvas.addEventListener('touchmove', move, {passive:false});
  canvas.addEventListener('touchend', end);
}
window.clearSig = function(){
  const canvas = document.getElementById('sigCanvas');
  sigCtx.clearRect(0,0,canvas.width,canvas.height);
  sigHasContent = false;
};

window.saveContract = function(){
  if(!document.getElementById('kSetuju').checked){ alert('Penyewa harus menyetujui klausul kontrak (termasuk klausul GPS) sebelum kontrak dibuat.'); return; }
  if(!sigHasContent){ alert('Tanda tangan penyewa wajib diisi.'); return; }
  const tglSelesai = document.getElementById('kSelesai').value;
  if(!tglSelesai){ alert('Tanggal selesai wajib diisi.'); return; }

  const customerId = document.getElementById('kCustomer').value;
  const unitId = document.getElementById('kUnit').value;
  const contract = {
    id: uid(),
    customerId, unitId,
    tglMulai: document.getElementById('kMulai').value,
    tglSelesai,
    deposit: parseInt(document.getElementById('kDeposit').value)||0,
    denda: 0,
    lunas: false,
    signature: document.getElementById('sigCanvas').toDataURL(),
    createdAt: new Date().toISOString()
  };
  const contracts = DB.get(KEYS.contracts, []);
  contracts.push(contract);
  DB.set(KEYS.contracts, contracts);

  const units = DB.get(KEYS.units, []);
  const idx = units.findIndex(u=>u.id===unitId);
  units[idx].status = 'disewa';
  DB.set(KEYS.units, units);

  closeModal(); currentView='kontrak'; tabs.forEach(t=>t.classList.toggle('active', t.dataset.view==='kontrak')); render();
};

window.viewContract = function(id){
  const c = DB.get(KEYS.contracts, []).find(x=>x.id===id);
  const u = DB.get(KEYS.units, []).find(x=>x.id===c.unitId);
  const cust = DB.get(KEYS.customers, []).find(x=>x.id===c.customerId);
  const s = DB.get(KEYS.settings, {});
  openModal(`
    <h3 class="modal-title">Kontrak Sewa</h3>
    <p class="hint">${s.businessName||'Satria Rental'} — dibuat ${fmtDate(c.createdAt)}</p>
    <div class="list-card-meta" style="margin-bottom:14px;">
      Penyewa: ${cust?cust.nama:'-'} (NIK ${cust?cust.nik:'-'})<br>
      Unit: ${u?u.model+' / '+u.plat:'-'}<br>
      Periode: ${fmtDate(c.tglMulai)} — ${fmtDate(c.tglSelesai)}<br>
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
  const bl = DB.get(KEYS.blacklist, []).slice().sort((a,b)=>(b.tglInput||'').localeCompare(a.tglInput||''));
  app.innerHTML = `
    <div class="section-title">Blacklist Internal (${bl.length})</div>
    <p class="hint" style="margin-bottom:14px;">Catatan penyewa bermasalah berdasarkan riwayat transaksi bisnis Anda sendiri. NIK yang masuk daftar ini akan otomatis memicu peringatan saat didaftarkan sebagai penyewa baru.</p>
    ${bl.length ? bl.map(blacklistCardHTML).join('') : `<div class="empty-state"><div class="empty-state-ic">⛔</div>Belum ada catatan blacklist.</div>`}
    <button class="fab" onclick="openBlacklistForm()">+</button>
  `;
}
function blacklistCardHTML(b){
  return `
    <div class="list-card">
      <div class="list-card-top">
        <div>
          <div class="list-card-name">${b.nama}</div>
          <div class="list-card-sub">NIK: ${b.nik}</div>
        </div>
      </div>
      <div class="list-card-meta">${b.alasan}<br>Dicatat: ${fmtDate(b.tglInput)}</div>
      <div class="list-card-actions">
        <button class="btn btn-danger" onclick="deleteBlacklist('${b.id}')">Hapus</button>
      </div>
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
window.saveBlacklist = function(){
  const nama = document.getElementById('bNama').value.trim();
  const nik = document.getElementById('bNik').value.trim();
  const alasan = document.getElementById('bAlasan').value.trim();
  if(!nama || !nik || !alasan){ alert('Semua kolom wajib diisi.'); return; }
  const list = DB.get(KEYS.blacklist, []);
  list.push({ id: uid(), nama, nik, alasan, tglInput: todayISO() });
  DB.set(KEYS.blacklist, list);
  closeModal(); render();
};
window.deleteBlacklist = function(id){
  if(!confirm('Hapus catatan ini?')) return;
  DB.set(KEYS.blacklist, DB.get(KEYS.blacklist, []).filter(x=>x.id!==id));
  render();
};

/* ================= PWA INSTALL ================= */
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}

/* ================= INIT ================= */
render();
