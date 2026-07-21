/* ================= SUPABASE SETUP ================= */
const SUPABASE_URL = 'https://utytmeyetfzyxcvbsrxa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0eXRtZXlldGZ6eXhjdmJzcnhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0NDAxMjUsImV4cCI6MjEwMDAxNjEyNX0.dj7tyOfVjj7hau9X--PbVBh9I5Uyp73QGfsLr8fEPdA';
let sb;
function trySetupSupabase(){
  if(typeof supabase === 'undefined') return false;
  try{ sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); return true; }
  catch(e){ console.error(e); return false; }
}
if(!trySetupSupabase()){
  let tries = 0;
  const retryTimer = setInterval(()=>{
    tries++;
    if(trySetupSupabase() || tries >= 10) clearInterval(retryTimer);
  }, 400);
}

const STATE = { leads: [] };
function daysSince(dateStr){
  if(!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000*60*60*24));
}
function fmtDate(d){ if(!d) return '-'; const dt=new Date(d); return dt.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}); }

const STATUS_LABEL = { baru:'Baru', demo_terkirim:'Demo Terkirim', followup_1:'Follow-up 1', followup_2:'Follow-up 2', deal:'Deal', batal:'Batal' };
const STATUS_CLASS = { baru:'belum', demo_terkirim:'lunas', followup_1:'belum', followup_2:'telat', deal:'lunas', batal:'telat' };

/* ================= AUTH ================= */
const authScreen = document.getElementById('authScreen');
const mainApp = document.getElementById('mainApp');
const authError = document.getElementById('authError');

function withTimeout(promise, ms, label){
  return Promise.race([
    promise,
    new Promise((_, reject)=> setTimeout(()=> reject(new Error(`${label} — waktu habis (cek internet Anda)`)), ms))
  ]);
}

window.handleLogin = async function(){
  if(!sb){ authError.style.color='var(--alert)'; authError.textContent='Koneksi ke server belum siap. Refresh halaman.'; return; }
  authError.style.color = 'var(--alert)'; authError.textContent = '';
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  if(!email || !password){ authError.textContent = 'Isi email dan password.'; return; }
  const btn = document.querySelector('.auth-box .btn-primary');
  const originalText = btn.textContent; btn.textContent = 'Memproses...'; btn.disabled = true;
  try{
    const { error } = await withTimeout(sb.auth.signInWithPassword({ email, password }), 8000, 'Login');
    if(error){ authError.textContent = 'Gagal masuk: ' + error.message; btn.textContent = originalText; btn.disabled = false; return; }
    await enterApp();
    btn.textContent = originalText; btn.disabled = false;
  }catch(e){
    authError.textContent = e.message || String(e);
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
      if(!confirm('Keluar dari panel?')) return;
      await sb.auth.signOut();
      mainApp.style.display = 'none';
      authScreen.style.display = 'flex';
    });
    await loadLeads();
    renderLeads();
  }catch(e){
    authScreen.style.display = 'flex';
    mainApp.style.display = 'none';
    authError.style.color = 'var(--alert)';
    authError.textContent = 'Gagal memuat data: ' + (e.message || e);
  }
}

async function loadLeads(){
  const { data } = await sb.from('leads').select('*').order('created_at', {ascending:false});
  STATE.leads = data || [];
}

/* ================= RENDER LEADS ================= */
function renderLeads(){
  const app = document.getElementById('app');
  const leads = STATE.leads;
  const needFollowup = leads.filter(l => {
    if(['deal','batal'].includes(l.status)) return false;
    const ref = l.last_contacted_at || l.created_at;
    return daysSince(ref) >= 3;
  }).length;

  app.innerHTML = `
    <div class="stat-strip" style="grid-template-columns:1fr 1fr;">
      <div class="stat-card"><div class="stat-num">${leads.length}</div><div class="stat-label">Total Leads</div></div>
      <div class="stat-card ${needFollowup>0?'warn':''}"><div class="stat-num">${needFollowup}</div><div class="stat-label">Perlu Follow-up</div></div>
    </div>
    <div class="section-title">Daftar Calon Klien</div>
    ${leads.length ? leads.map(leadCardHTML).join('') : `<div class="empty-state"><div class="empty-state-ic">🎯</div>Belum ada yang minta demo. Bagikan link demo-request.html ke calon klien.</div>`}
  `;
}

function leadCardHTML(l){
  const ref = l.last_contacted_at || l.created_at;
  const idle = daysSince(ref);
  const stale = idle !== null && idle >= 3 && !['deal','batal'].includes(l.status);
  return `
    <div class="list-card">
      <div class="list-card-top">
        <div>
          <div class="list-card-name">${l.nama}</div>
          <div class="list-card-sub">${l.email}</div>
        </div>
        <span class="badge ${STATUS_CLASS[l.status]}">${STATUS_LABEL[l.status]}</span>
      </div>
      <div class="list-card-meta">
        Masuk: ${fmtDate(l.created_at)}${l.last_contacted_at ? ' · Kontak terakhir: '+fmtDate(l.last_contacted_at) : ''}
        ${stale ? `<br><span style="color:var(--signal);">⚠ Sudah ${idle} hari tanpa kabar</span>` : ''}
        ${l.catatan ? `<br>Catatan: ${l.catatan}` : ''}
      </div>
      <div class="list-card-actions" style="flex-wrap:wrap;">
        ${!['deal','batal'].includes(l.status) ? `<button class="btn btn-primary" onclick="sendFollowup('${l.id}')">📧 Kirim Follow-up</button>` : ''}
        <select onchange="updateLeadStatus('${l.id}', this.value)" style="background:var(--asphalt); color:var(--off-white); border:1px solid var(--asphalt-3); border-radius:8px; padding:8px 10px; font-size:.85rem;">
          ${Object.keys(STATUS_LABEL).map(k=>`<option value="${k}" ${l.status===k?'selected':''}>${STATUS_LABEL[k]}</option>`).join('')}
        </select>
        <button class="btn btn-ghost" onclick="editLeadNote('${l.id}')">Catatan</button>
      </div>
    </div>
  `;
}

window.updateLeadStatus = async function(id, status){
  const { data, error } = await sb.from('leads').update({ status }).eq('id', id).select().single();
  if(error){ alert('Gagal update: '+error.message); return; }
  const idx = STATE.leads.findIndex(x=>x.id===id); STATE.leads[idx] = data;
  renderLeads();
};

window.editLeadNote = function(id){
  const l = STATE.leads.find(x=>x.id===id);
  const note = prompt('Catatan untuk ' + l.nama + ':', l.catatan || '');
  if(note === null) return;
  sb.from('leads').update({ catatan: note }).eq('id', id).select().single().then(({data, error})=>{
    if(error){ alert('Gagal simpan catatan: '+error.message); return; }
    const idx = STATE.leads.findIndex(x=>x.id===id); STATE.leads[idx] = data;
    renderLeads();
  });
};

window.sendFollowup = async function(id){
  const l = STATE.leads.find(x=>x.id===id);
  if(!confirm(`Kirim email follow-up ke ${l.nama} (${l.email})?`)) return;
  try{
    const { error: fnErr } = await sb.functions.invoke('send-demo-email', {
      body: { nama: l.nama, email: l.email, mode: 'followup' }
    });
    if(fnErr) throw fnErr;
    const nextStatus = l.status === 'baru' || l.status === 'demo_terkirim' ? 'followup_1' : 'followup_2';
    const { data, error } = await sb.from('leads').update({ status: nextStatus, last_contacted_at: new Date().toISOString() }).eq('id', id).select().single();
    if(error) throw error;
    const idx = STATE.leads.findIndex(x=>x.id===id); STATE.leads[idx] = data;
    renderLeads();
    alert('Email follow-up terkirim.');
  }catch(e){
    alert('Gagal kirim: ' + (e.message || e));
  }
};

if(sb) checkExistingSession();
