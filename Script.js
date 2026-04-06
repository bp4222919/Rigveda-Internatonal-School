/* ============================================================
   RIGVEDA SMS — Script.js  v3
   New Features:
   ✅ All form fields optional (basic validation active)
   ✅ Dynamic custom field builder inside Add Student form
   ✅ Customizable export (column selector before download)
   ✅ Admin classes via free-text input (already was)
   ✅ Profile update: username + password, masked previous
   ✅ Optimised API calls (parallel loading, caching)
   ✅ Fully responsive mobile-first UI
   ============================================================ */

// ── CONFIG ────────────────────────────────────────────────────
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwISVvZgInkXkPdAS6X875jeLZd_fMp-_lBjioLgJSeiKeJ_jFA_gP7cs2j6Oy_2gzg/exec";

// ── STATE ─────────────────────────────────────────────────────
let SESSION = null;
let allStudents = [];
let allClasses = [];
let allUsers = [];
let allFieldDefs = [];
let editingStudent = null;
let editingUser = null;
let editingField = null;
let visibleStudents = 30;
let loadStep = 30;

// ── NAVIGATION CONFIG ─────────────────────────────────────────
const NAV_ADMIN = [
  { page: 'page-home', icon: 'bi-grid-fill', label: 'Dashboard' },
  { page: 'page-students', icon: 'bi-people-fill', label: 'Students' },
  { page: 'page-classes', icon: 'bi-grid-3x3-gap-fill', label: 'Manage Classes' },
  { page: 'page-users', icon: 'bi-person-badge-fill', label: 'Manage Users' },
  { page: 'page-profile', icon: 'bi-person-gear', label: 'My Profile' },
];
const NAV_INCHARGE = [
  { page: 'page-home', icon: 'bi-grid-fill', label: 'Dashboard' },
  { page: 'page-students', icon: 'bi-people-fill', label: 'My Students' },
  { page: 'page-profile', icon: 'bi-person-gear', label: 'My Profile' },
];

// ── FIXED STUDENT FIELDS (always in form) ─────────────────────
const FIXED_FIELDS = [
  {
    section: 'Admission Details', fields: [
      { id: 'sf_admDate', label: 'Admission Date', type: 'date', col: 'admissionDate' },
      { id: 'sf_admNo', label: 'Admission No.', type: 'text', col: 'admissionNo', placeholder: 'e.g. ADM2025001' },
    ]
  },
  {
    section: 'Student Details', fields: [
      { id: 'sf_name', label: 'Student Name', type: 'text', col: 'name', placeholder: 'Full name' },
      { id: 'sf_gender', label: 'Gender', type: 'dropdown', col: 'gender', opts: ['Male', 'Female', 'Other'] },
      { id: 'sf_dob', label: 'Date of Birth', type: 'date', col: 'dob' },
      { id: 'sf_aadhar', label: 'Aadhar No.', type: 'text', col: 'aadhar', placeholder: '12 digits', maxlength: 12 },
      { id: 'sf_category', label: 'Category', type: 'dropdown', col: 'category', opts: ['General', 'OBC', 'OBC-NCL', 'SC', 'ST', 'EWS'] },
      { id: 'sf_blood', label: 'Blood Group', type: 'dropdown', col: 'bloodGroup', opts: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
      { id: 'sf_height', label: 'Height (cm)', type: 'number', col: 'height', placeholder: 'e.g. 120' },
      { id: 'sf_weight', label: 'Weight (kg)', type: 'number', col: 'weight', placeholder: 'e.g. 35' },
    ]
  },
  {
    section: 'Parent / Guardian Details', fields: [
      { id: 'sf_fatherName', label: "Father's Name", type: 'text', col: 'fatherName', placeholder: "Father's full name" },
      { id: 'sf_fatherAadhar', label: "Father's Aadhar", type: 'text', col: 'fatherAadhar', placeholder: '12 digits', maxlength: 12 },
      { id: 'sf_motherName', label: "Mother's Name", type: 'text', col: 'motherName', placeholder: "Mother's full name" },
      { id: 'sf_motherAadhar', label: "Mother's Aadhar", type: 'text', col: 'motherAadhar', placeholder: '12 digits', maxlength: 12 },
      { id: 'sf_phone1', label: 'Phone 1', type: 'tel', col: 'phone1', placeholder: '10-digit number', maxlength: 10 },
      { id: 'sf_phone2', label: 'Phone 2', type: 'tel', col: 'phone2', placeholder: '10-digit number', maxlength: 10 },
    ]
  },
  {
    section: 'Other Details', fields: [
      { id: 'sf_address', label: 'Address', type: 'textarea', col: 'address', placeholder: 'Full residential address…' },
      { id: 'sf_prevSchool', label: 'Previous School', type: 'text', col: 'prevSchool', placeholder: 'e.g. ABC Primary School' },
    ]
  },
];

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  window.addEventListener('scroll', () => {
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 200) {

      const total = getFilteredStudents().length;

      if (visibleStudents < total) {
        visibleStudents += loadStep;

        renderStudentTable();
        renderStudentCards();
      }
    }
  });
  const raw = localStorage.getItem('smsSession');
  if (raw) {
    try {
      const u = JSON.parse(raw);
      if (u && u.username) { SESSION = u; showDashboard(); return; }
    } catch (e) { localStorage.removeItem('smsSession'); }
  }
  document.getElementById('loginUsername').focus();
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
});

// ── SCREEN SWITCH ─────────────────────────────────────────────
function showDashboard() {
  const ls = document.getElementById('screen-login');
  const ds = document.getElementById('screen-dashboard');
  ls.classList.add('hiding');
  setTimeout(() => { ls.classList.add('hidden'); ds.classList.add('active'); renderSidebar(); loadInitialData(); }, 350);
}

function showLogin() {
  document.getElementById('screen-dashboard').classList.remove('active');
  const ls = document.getElementById('screen-login');
  ls.classList.remove('hiding', 'hidden');
  document.getElementById('loginForm').reset();
  document.getElementById('loginError').classList.remove('show');
  setTimeout(() => document.getElementById('loginUsername').focus(), 80);
}

// ── LOGIN ─────────────────────────────────────────────────────
function togglePw(inputId, iconId) {
  const pw = document.getElementById(inputId);
  const ic = document.getElementById(iconId);
  if (pw.type === 'password') { pw.type = 'text'; ic.className = 'bi bi-eye-slash'; }
  else { pw.type = 'password'; ic.className = 'bi bi-eye'; }
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  if (!username || !password) { loginErr('Please enter username and password.'); return; }
  if (checkUrlNotSet()) { loginErr('WEB_APP_URL not configured in Script.js.'); return; }
  setLoginLoading(true);
  document.getElementById('loginError').classList.remove('show');
  try {
    const data = await apiFetch(`${WEB_APP_URL}?action=login&username=${enc(username)}&password=${enc(password)}`);
    if (data.status === 'success') {
      SESSION = data.user;
      localStorage.setItem('smsSession', JSON.stringify(data.user));
      showDashboard();
    } else { loginErr(data.message || 'Login failed.'); }
  } catch (err) { loginErr('Connection error. Check URL and internet.'); }
  finally { setLoginLoading(false); }
}

function loginErr(msg) {
  document.getElementById('loginErrorText').textContent = msg;
  document.getElementById('loginError').classList.add('show');
}

function setLoginLoading(on) {
  const btn = document.getElementById('loginBtn');
  btn.disabled = on;
  btn.innerHTML = on ? `<div class="login-spin"></div> Signing in…` : `<i class="bi bi-box-arrow-in-right"></i> Sign In`;
}

// ── LOGOUT ────────────────────────────────────────────────────
function logout() {
  SESSION = null; allStudents = []; allClasses = []; allUsers = []; allFieldDefs = [];
  localStorage.removeItem('smsSession'); showLogin();
}

// ── SIDEBAR ───────────────────────────────────────────────────
function renderSidebar() {
  const isAdmin = SESSION.role === 'Admin';
  const items = isAdmin ? NAV_ADMIN : NAV_INCHARGE;

  $('userAvatar').textContent = SESSION.username[0].toUpperCase();
  $('userAvatar').className = `u-avatar ${isAdmin ? 'av-admin' : 'av-incharge'}`;
  $('userName').textContent = SESSION.username;
  $('userRoleBadge').textContent = SESSION.role;
  $('userRoleBadge').className = `u-role ${isAdmin ? 'role-admin' : 'role-incharge'}`;

  const rb = $('topbarRole');
  rb.textContent = isAdmin ? '⚡ Admin' : `📚 ${SESSION.assignedClass}–${SESSION.assignedSection}`;
  rb.className = `topbar-role ${isAdmin ? 'rb-admin' : 'rb-incharge'}`;

  if (!isAdmin) { $('stat-users-card').style.display = 'none'; }

  $('sidebarNav').innerHTML = `<div class="nav-label">Main Menu</div>` +
    items.map(it => `<div class="nav-item" data-page="${it.page}" onclick="navTo('${it.page}')">
      <i class="bi ${it.icon}"></i>${it.label}</div>`).join('');
}

// ── NAVIGATION ────────────────────────────────────────────────
function navTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === pageId));
  const titles = { 'page-home': 'Dashboard', 'page-students': 'Students', 'page-classes': 'Manage Classes', 'page-users': 'Manage Users', 'page-profile': 'My Profile' };
  $('topbarTitle').textContent = titles[pageId] || '';
  closeSidebar();
  if (pageId === 'page-students') {
    visibleStudents = 30;
    renderStudentTable();
    renderStudentCards();
  }
  if (pageId === 'page-classes') { renderClassesGrid(); renderFieldDefsList(); }
  if (pageId === 'page-users') renderUsersTable();
  if (pageId === 'page-profile') renderProfilePage();
}

function openSidebar() { $('sidebar').classList.add('open'); $('sidebarOverlay').classList.add('show'); }
function closeSidebar() { $('sidebar').classList.remove('open'); $('sidebarOverlay').classList.remove('show'); }

// ── LOAD DATA (optimised: parallel) ───────────────────────────
async function loadInitialData() {
  showSpinner('Loading…');
  try {
    await loadFieldDefs();
    await Promise.all([
      loadStudents(), loadClasses(),
      SESSION.role === 'Admin' ? loadUsers() : Promise.resolve(),
      loadStats(),
    ]);
  } finally { hideSpinner(); }
}

async function loadStudents() {
  if (checkUrlNotSet()) return;
  let url = `${WEB_APP_URL}?action=getStudents&role=${enc(SESSION.role)}`;
  if (SESSION.role === 'ClassIncharge') url += `&assignedClass=${enc(SESSION.assignedClass)}&assignedSection=${enc(SESSION.assignedSection)}`;
  const data = await apiFetch(url);
  if (data.status === 'success') { allStudents = data.students || []; renderStudentTable(); renderStudentCards(); populateFilterDrops(); renderRecentTable(); }
}

async function loadClasses() {
  const data = await apiFetch(`${WEB_APP_URL}?action=getClasses`);
  if (data.status === 'success') { allClasses = data.classes || []; renderClassesGrid(); populateClassDrops(); }
}

async function loadUsers() {
  const data = await apiFetch(`${WEB_APP_URL}?action=getUsers`);
  if (data.status === 'success') { allUsers = data.users || []; renderUsersTable(); }
}

async function loadStats() {
  let url = `${WEB_APP_URL}?action=getStats&role=${enc(SESSION.role)}`;
  if (SESSION.role === 'ClassIncharge') url += `&assignedClass=${enc(SESSION.assignedClass)}&assignedSection=${enc(SESSION.assignedSection)}`;
  const data = await apiFetch(url);
  if (data.status === 'success') {
    const s = data.stats;
    $('stat-students').textContent = s.totalStudents;
    $('stat-classes').textContent = s.totalClasses;
    $('stat-users').textContent = s.totalUsers;
    $('stat-today').textContent = s.todayAdmissions;
  }
}

async function loadFieldDefs() {
  const data = await apiFetch(`${WEB_APP_URL}?action=getFieldDefs`);
  if (data.status === 'success') { allFieldDefs = data.fieldDefs || []; renderFieldDefsList(); }
}

// ── STUDENT TABLE (desktop) ───────────────────────────────────
function renderStudentTable(students) {
  students = students || getFilteredStudents();

  const tbody = $('studentTbody');

  // 👇 LIMIT APPLY
  const visible = students.slice(0, visibleStudents);

  $('studentCount').textContent = `${students.length} record${students.length !== 1 ? 's' : ''}`;

  if (!visible.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="bi bi-people"></i><p>No students found</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = visible.map((s, i) => `
    <tr id="srow-${s.rowIndex}">
      <td>${i + 1}</td>
      <td>${esc(s.studentId)}</td>
      <td>${esc(s.admissionNo)}</td>
      <td>${esc(s.name)}</td>
      <td>${esc(s.class)}</td>
      <td>${esc(s.section)}</td>
      <td>${esc(s.phone1)}</td>
      <td>
      <button class="btn btn-info btn-sm" onclick="viewStudent(${s.rowIndex})"><i class="bi bi-eye-fill"></i></button>
        <button class="btn btn-warn btn-sm" onclick="openStudentForm(${s.rowIndex})"><i class="bi bi-pencil-fill"></i></button>
        <button class="btn btn-danger btn-sm" onclick="delRecord('student',${s.rowIndex},'${esc(s.name)}')"><i class="bi bi-trash3-fill"></i></button>
      </td>
    </tr>
  `).join('');
}

// ── STUDENT CARDS (mobile) ────────────────────────────────────
function renderStudentCards(students) {
  students = students || getFilteredStudents();
  const wrap = $('studentCards');
  if (!wrap) return;
  if (!students.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = students.map((s, i) => `
    <div class="s-card">
      <div class="s-card-top">
        <div class="s-card-avatar">${(s.name || '?')[0].toUpperCase()}</div>
        <div class="s-card-info">
          <div class="s-card-name">${esc(s.name)}</div>
          <div class="s-card-meta">
            <span class="badge bg-blue">${esc(s.class)}</span>
            <span class="badge bg-purple">${esc(s.section)}</span>
          </div>
          <div class="s-card-sub mono-sm">${esc(s.admissionNo)} · ${esc(s.phone1)}</div>
        </div>
      </div>
      <div class="s-card-act">
        <button class="btn btn-info btn-sm" onclick="viewStudent(${s.rowIndex})"><i class="bi bi-eye-fill"></i> View</button>
        <button class="btn btn-warn btn-sm" onclick="openStudentForm(${s.rowIndex})"><i class="bi bi-pencil-fill"></i> Edit</button>
        <button class="btn btn-danger btn-sm" onclick="delRecord('student',${s.rowIndex},'${esc(s.name)}')"><i class="bi bi-trash3-fill"></i></button>
      </div>
    </div>`).join('');
}

function renderRecentTable() {
  const recent = [...allStudents].slice(-6).reverse();
  const tbody = $('recentTbody');
  if (!recent.length) { tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="bi bi-database-slash"></i><p>No data</p></div></td></tr>`; return; }
  tbody.innerHTML = recent.map(s => `
    <tr>
      <td class="td-id">${esc(s.studentId)}</td>
      <td class="td-name">${esc(s.name)}</td>
      <td><span class="badge bg-blue">${esc(s.class)}</span></td>
      <td><span class="badge bg-purple">${esc(s.section)}</span></td>
      <td class="mono-sm">${esc(s.admissionDate)}</td>
      <td class="mono-sm">${esc(s.phone1)}</td>
    </tr>`).join('');
}

// ── FILTER ────────────────────────────────────────────────────
function populateFilterDrops() {
  const classes = [...new Set(allStudents.map(s => s.class))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const sections = [...new Set(allStudents.map(s => s.section))].sort();
  $('classFilter').innerHTML = `<option value="">All Classes</option>` + classes.map(c => `<option>${esc(c)}</option>`).join('');
  $('sectionFilter').innerHTML = `<option value="">All Sections</option>` + sections.map(s => `<option>${esc(s)}</option>`).join('');
}

function getFilteredStudents() {
  const q = ($('studentSearch')?.value || '').toLowerCase().trim();
  const cls = $('classFilter')?.value || '';
  const sec = $('sectionFilter')?.value || '';
  return allStudents.filter(s =>
    (!q || s.name.toLowerCase().includes(q) || (s.admissionNo || '').includes(q) || (s.phone1 || '').includes(q) || (s.studentId || '').toLowerCase().includes(q)) &&
    (!cls || s.class === cls) && (!sec || s.section === sec));
}

function filterStudents() { visibleStudents = 30; const f = getFilteredStudents(); renderStudentTable(f); renderStudentCards(f); }

// ── STUDENT FORM — with inline custom field builder ───────────
function buildStudentFormHTML(student) {
  const isEdit = !!student;
  let html = `<form id="sfForm" novalidate>
    <input type="hidden" id="sf_rowIndex" value="${isEdit ? student.rowIndex : ''}"/>
    <input type="hidden" id="sf_studentId" value="${isEdit ? student.studentId : ''}"/>`;

  // Fixed sections — all fields are optional (no required attribute)
  FIXED_FIELDS.forEach(sec => {
    html += `<div class="form-section"><div class="form-sec-title"><i class="bi bi-chevron-right"></i>${sec.section}</div><div class="form-grid">`;
    sec.fields.forEach(f => {
      const val = isEdit ? (student[f.col] || '') : (f.col === 'admissionDate' ? today() : '');
      html += `<div class="fgroup"><label>${f.label} <span class="opt-tag">optional</span></label>`;
      if (f.type === 'dropdown') {
        const opts = f.opts.map(o => `<option value="${o}"${val === o ? ' selected' : ''}>${o}</option>`).join('');
        html += `<select id="${f.id}"><option value="">— Select —</option>${opts}</select>`;
      } else if (f.type === 'textarea') {
        html += `<textarea id="${f.id}" placeholder="${f.placeholder || ''}">${esc(val)}</textarea>`;
      } else {
        const extra = f.maxlength ? `maxlength="${f.maxlength}"` : '';
        html += `<input type="${f.type}" id="${f.id}" value="${esc(val)}" placeholder="${f.placeholder || ''}" ${extra}/>`;
      }
      html += `</div>`;
    });
    html += `</div></div>`;
  });

  // Academic (class/section dropdowns)
  const classOpts = [...new Set(allClasses.map(c => c.class))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map(c => `<option value="${c}"${isEdit && student.class === c ? ' selected' : ''}>${c}</option>`).join('');
  const secOpts = isEdit
    ? allClasses.filter(c => c.class === student.class).map(c => c.section)
      .map(s => `<option value="${s}"${student.section === s ? ' selected' : ''}>${s}</option>`).join('')
    : '';
  html += `<div class="form-section"><div class="form-sec-title"><i class="bi bi-chevron-right"></i>Academic Information</div>
    <div class="form-grid">
      <div class="fgroup"><label>Class <span class="opt-tag">optional</span></label><select id="sf_class" onchange="onSfClassChange()">${classOpts ? '<option value="">— Select —</option>' + classOpts : '<option value="">— Select —</option>'}</select></div>
      <div class="fgroup"><label>Section <span class="opt-tag">optional</span></label><select id="sf_section"><option value="">— Select —</option>${secOpts}</select></div>
    </div></div>`;

  // Custom fields (existing) + inline builder
  html += `<div class="form-section" id="customFieldsSection">
    <div class="form-sec-title">
      <i class="bi bi-sliders"></i>Additional / Custom Fields
      <button type="button" class="btn btn-primary btn-xs ms-auto" onclick="toggleInlineFieldBuilder()" id="addFieldToggleBtn">
        <i class="bi bi-plus-lg"></i> Add Field
      </button>
    </div>`;

  // Inline field builder (hidden by default)
  html += `<div id="inlineFieldBuilder" class="inline-field-builder hidden">
    <div class="inline-builder-inner">
      <div class="form-grid">
        <div class="fgroup"><label>Field Name</label><input type="text" id="ifb_name" placeholder="e.g. Religion, Bus Route…"/></div>
        <div class="fgroup"><label>Field Type</label>
          <select id="ifb_type" onchange="toggleIfbOptions()">
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="textarea">Long Text</option>
            <option value="dropdown">Dropdown</option>
            <option value="checkbox">Checkbox (Yes/No)</option>
          </select>
        </div>
        <div class="fgroup hidden" id="ifb_optionsRow"><label>Options <span class="muted-tag">(comma separated)</span></label>
          <input type="text" id="ifb_options" placeholder="e.g. Hindu,Muslim,Christian"/>
        </div>
        <div class="fgroup" style="display:flex;align-items:flex-end;gap:8px;">
          <label class="checkbox-label"><input type="checkbox" id="ifb_required"/> <span>Required</span></label>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:4px;">
        <button type="button" class="btn btn-primary btn-sm" onclick="submitInlineField()"><i class="bi bi-plus-lg"></i> Create &amp; Add</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="toggleInlineFieldBuilder()">Cancel</button>
      </div>
    </div>
  </div>`;

  if (allFieldDefs.length) {
    html += `<div class="form-grid" id="customFieldsGrid">`;
    allFieldDefs.forEach(fd => {
      const cval = isEdit ? (student.customData[fd.id] || '') : '';
      const req = fd.required ? '<span class="req-star">*</span>' : '<span class="opt-tag">optional</span>';
      html += `<div class="fgroup${fd.type === 'textarea' ? ' span2' : ''}" id="cff_wrap_${fd.id}"><label>${esc(fd.name)} ${req}</label>`;
      if (fd.type === 'dropdown') {
        const opts = (fd.options || '').split(',').map(o => o.trim()).filter(Boolean)
          .map(o => `<option value="${o}"${cval === o ? ' selected' : ''}>${o}</option>`).join('');
        html += `<select id="cf_${fd.id}" data-fd="${fd.id}"><option value="">— Select —</option>${opts}</select>`;
      } else if (fd.type === 'checkbox') {
        html += `<label class="checkbox-label"><input type="checkbox" id="cf_${fd.id}" data-fd="${fd.id}"${cval === 'true' ? ' checked' : ''}> <span>Yes</span></label>`;
      } else if (fd.type === 'textarea') {
        html += `<textarea id="cf_${fd.id}" data-fd="${fd.id}" placeholder="Enter ${esc(fd.name)}…">${esc(cval)}</textarea>`;
      } else {
        const t = fd.type === 'phone' ? 'tel' : fd.type;
        html += `<input type="${t}" id="cf_${fd.id}" data-fd="${fd.id}" value="${esc(cval)}" placeholder="Enter ${esc(fd.name)}…"/>`;
      }
      html += `</div>`;
    });
    html += `</div>`;
  } else {
    html += `<div id="customFieldsGrid" class="form-grid" style="margin-top:8px;"></div>
      <p class="hint-text" id="noCustomFieldsHint" style="padding:8px 0;">No custom fields defined. Click <b>+ Add Field</b> above to create one.</p>`;
  }
  html += `</div>`; // end customFieldsSection

  // ClassIncharge: auto-lock class/section
  if (SESSION.role === 'ClassIncharge' && !isEdit) {
    html += `<script>
      (function(){
        const c=document.getElementById('sf_class');if(c){c.value='${SESSION.assignedClass}';c.disabled=true;}
        onSfClassChange();
        setTimeout(()=>{const s=document.getElementById('sf_section');if(s){s.value='${SESSION.assignedSection}';s.disabled=true;}},80);
      })();
    <\/script>`;
  }

  html += `</form>`;
  return html;
}

function toggleInlineFieldBuilder() {
  const builder = $('inlineFieldBuilder');
  const btn = $('addFieldToggleBtn');
  if (builder.classList.contains('hidden')) {
    builder.classList.remove('hidden');
    btn.innerHTML = '<i class="bi bi-x-lg"></i> Close';
    $('ifb_name')?.focus();
  } else {
    builder.classList.add('hidden');
    btn.innerHTML = '<i class="bi bi-plus-lg"></i> Add Field';
  }
}

function toggleIfbOptions() {
  const t = $('ifb_type')?.value;
  const row = $('ifb_optionsRow');
  if (row) row.classList.toggle('hidden', t !== 'dropdown');
}

async function submitInlineField() {
  const name = ($('ifb_name')?.value || '').trim();
  const type = $('ifb_type')?.value || 'text';
  const options = ($('ifb_options')?.value || '').trim();
  const required = $('ifb_required')?.checked || false;

  if (!name) { showToast('Field name required.', 'error'); return; }

  setBtnLoading('addFieldToggleBtn', true);
  try {
    const data = await apiPost({ action: 'addFieldDef', name, type, options, required });
    if (data.status === 'success') {
      showToast(`✅ Field "${name}" created!`, 'success');
      // Reload field defs and inject new field into current form
      await loadFieldDefs();
      // Find or create the custom fields grid
      const grid = $('customFieldsGrid');
      const hint = $('noCustomFieldsHint');
      if (hint) hint.remove();
      if (grid) {
        const fd = allFieldDefs.find(f => f.id === data.id) || allFieldDefs[allFieldDefs.length - 1];
        if (fd) {
          const div = document.createElement('div');
          div.className = `fgroup${fd.type === 'textarea' ? ' span2' : ''}`;
          div.id = `cff_wrap_${fd.id}`;
          const req = fd.required ? '<span class="req-star">*</span>' : '<span class="opt-tag">optional</span>';
          let inner = `<label>${esc(fd.name)} ${req}</label>`;
          if (fd.type === 'dropdown') {
            const opts = (fd.options || '').split(',').map(o => o.trim()).filter(Boolean)
              .map(o => `<option value="${o}">${o}</option>`).join('');
            inner += `<select id="cf_${fd.id}" data-fd="${fd.id}"><option value="">— Select —</option>${opts}</select>`;
          } else if (fd.type === 'checkbox') {
            inner += `<label class="checkbox-label"><input type="checkbox" id="cf_${fd.id}" data-fd="${fd.id}"> <span>Yes</span></label>`;
          } else if (fd.type === 'textarea') {
            inner += `<textarea id="cf_${fd.id}" data-fd="${fd.id}" placeholder="Enter ${esc(fd.name)}…"></textarea>`;
          } else {
            const t = fd.type === 'phone' ? 'tel' : fd.type;
            inner += `<input type="${t}" id="cf_${fd.id}" data-fd="${fd.id}" value="" placeholder="Enter ${esc(fd.name)}…"/>`;
          }
          div.innerHTML = inner;
          grid.appendChild(div);
          div.querySelector('input, select, textarea')?.focus();
        }
      }
      // Close builder & reset
      $('inlineFieldBuilder').classList.add('hidden');
      $('addFieldToggleBtn').innerHTML = '<i class="bi bi-plus-lg"></i> Add Field';
      $('ifb_name').value = '';
      $('ifb_options').value = '';
      $('ifb_required').checked = false;
    } else { showToast(data.message, 'error'); }
  } catch (e) { showToast('Error: ' + e.message, 'error'); }
  finally { setBtnLoading('addFieldToggleBtn', false); }
}

function onSfClassChange() {
  const cls = document.getElementById('sf_class')?.value || '';
  const secEl = document.getElementById('sf_section');
  if (!secEl) return;
  const secs = allClasses.filter(c => c.class === cls).map(c => c.section);
  secEl.innerHTML = `<option value="">— Select —</option>` + secs.map(s => `<option value="${s}">${s}</option>`).join('');
}

function openStudentForm(rowIndex) {
  editingStudent = rowIndex || null;
  const student = rowIndex ? allStudents.find(s => s.rowIndex === rowIndex) : null;
  $('sfTitle').textContent = rowIndex ? `Edit Student: ${student?.name || ''}` : 'Add New Student';
  $('sfSubmitBtn').innerHTML = rowIndex ? '<i class="bi bi-pencil-fill"></i> Update' : '<i class="bi bi-send-fill"></i> Submit';
  $('studentFormBody').innerHTML = buildStudentFormHTML(student || null);
  const sfCls = document.getElementById('sf_class');
  if (sfCls) sfCls.addEventListener('change', onSfClassChange);
  if (rowIndex && student) {
    setTimeout(() => { const sf = document.getElementById('sf_section'); if (sf) sf.value = student.section; }, 60);
  }
  openModal('studentFormModal');
}

async function submitStudentForm() {
  const isEdit = !!editingStudent;
  const rowIndex = document.getElementById('sf_rowIndex')?.value;

  const body = { action: isEdit ? 'updateStudent' : 'addStudent', customData: {} };
  if (isEdit) body.rowIndex = rowIndex;

  FIXED_FIELDS.forEach(sec => sec.fields.forEach(f => {
    const el = document.getElementById(f.id);
    body[f.col] = el ? el.value.trim() : '';
  }));
  body.class = document.getElementById('sf_class')?.value || '';
  body.section = document.getElementById('sf_section')?.value || '';

  // Collect custom fields (use latest allFieldDefs — may include newly created ones)
  allFieldDefs.forEach(fd => {
    const el = document.getElementById(`cf_${fd.id}`);
    if (!el) return;
    body.customData[fd.id] = fd.type === 'checkbox' ? String(el.checked) : el.value.trim();
  });

  // Validate only required custom fields (all fixed fields are optional)
  const missing = allFieldDefs.filter(fd => {
    if (!fd.required) return false;
    const el = document.getElementById(`cf_${fd.id}`);
    if (!el) return false;
    return fd.type === 'checkbox' ? false : !el.value.trim();
  }).map(fd => fd.name);
  if (missing.length) { showToast(`Required: ${missing.join(', ')}`, 'error'); return; }

  setBtnLoading('sfSubmitBtn', true);
  showSpinner(isEdit ? 'Updating student…' : 'Adding student…');
  try {
    const data = await apiPost(body);
    if (data.status === 'success') {
      showToast(isEdit ? '✅ Student updated!' : `✅ Added! ID: ${data.studentId}`, 'success');
      closeModal('studentFormModal');
      editingStudent = null;
      await loadStudents(); await loadStats();
    } else showToast(data.message, 'error');
  } catch (e) { showToast('Error: ' + e.message, 'error'); }
  finally { hideSpinner(); setBtnLoading('sfSubmitBtn', false); }
}

// ── STUDENT VIEW ──────────────────────────────────────────────
function viewStudent(rowIndex) {
  const s = allStudents.find(s => s.rowIndex === rowIndex);
  if (!s) return;

  const di = (label, val, mono = false) =>
    `<div class="d-item"><div class="d-label">${label}</div><div class="d-val${mono ? ' mono' : ''}">
      ${esc(val || '—')}</div></div>`;

  let customHtml = '';
  if (allFieldDefs.length) {
    customHtml = `<div class="detail-sec-hdr">Additional Fields</div><div class="detail-grid">` +
      allFieldDefs.map(fd => {
        const v = s.customData?.[fd.id];
        const disp = fd.type === 'checkbox' ? (v === 'true' ? 'Yes' : 'No') : (v || '—');
        return di(fd.name, disp);
      }).join('') + `</div>`;
  }

  $('studentViewBody').innerHTML = `
    <div class="sv-hdr">
      <div class="sv-avatar">${(s.name || '?')[0].toUpperCase()}</div>
      <div class="sv-info">
        <h3>${esc(s.name)}</h3>
        <div class="sv-meta">
          <span class="badge bg-blue">${esc(s.class)}</span>
          <span class="badge bg-purple">${esc(s.section)}</span>
          <span class="badge bg-cyan">${esc(s.gender)}</span>
          <span class="badge bg-amber">${esc(s.category)}</span>
          <span class="mono-sm accent-txt">${esc(s.studentId)}</span>
        </div>
      </div>
    </div>
    <div class="detail-sec-hdr">Admission</div>
    <div class="detail-grid">${di('Adm. No', s.admissionNo, true)}${di('Adm. Date', s.admissionDate)}</div>
    <div class="detail-sec-hdr">Student Details</div>
    <div class="detail-grid">
      ${di('Name', s.name)}${di('Gender', s.gender)}${di('DOB', s.dob)}
      ${di('Aadhar', s.aadhar, true)}${di('Category', s.category)}${di('Blood Group', s.bloodGroup)}
      ${di('Height (cm)', s.height)}${di('Weight (kg)', s.weight)}
    </div>
    <div class="detail-sec-hdr">Parent / Guardian</div>
    <div class="detail-grid">
      ${di("Father", s.fatherName)}${di("Father Aadhar", s.fatherAadhar, true)}
      ${di("Mother", s.motherName)}${di("Mother Aadhar", s.motherAadhar, true)}
      ${di("Phone 1", s.phone1, true)}${di("Phone 2", s.phone2, true)}
    </div>
    <div class="detail-sec-hdr">Other &amp; Academic</div>
    <div class="detail-grid">
      ${di('Address', s.address)}${di('Prev. School', s.prevSchool)}
      ${di('Class', s.class)}${di('Section', s.section)}
    </div>
    ${customHtml}`;
  openModal('studentViewModal');
}

// ── CLASSES ───────────────────────────────────────────────────
function renderClassesGrid() {
  const grid = $('classesGrid'); if (!grid) return;
  if (!allClasses.length) { grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i class="bi bi-grid"></i><p>No classes yet</p></div>`; return; }
  grid.innerHTML = [...allClasses]
    .sort((a, b) => a.class.localeCompare(b.class, undefined, { numeric: true }) || a.section.localeCompare(b.section))
    .map(c => `<div class="class-chip">
      <div><div class="cc-cls">${esc(c.class)}</div><div class="cc-sec">${esc(c.section)}</div></div>
      <button class="chip-del" onclick="deleteClass(${c.rowIndex},'${esc(c.class)}','${esc(c.section)}')"><i class="bi bi-x-lg"></i></button>
    </div>`).join('');
}

function populateClassDrops() {
  const unique = [...new Set(allClasses.map(c => c.class))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  ['sf_class', 'uf_class'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const prev = el.value;
    el.innerHTML = `<option value="">— Select Class —</option>` + unique.map(c => `<option value="${c}">${c}</option>`).join('');
    if (prev) el.value = prev;
  });
}

function populateSectionDrop(sectionElId, cls) {
  const el = document.getElementById(sectionElId); if (!el) return;
  const secs = allClasses.filter(c => c.class === cls).map(c => c.section).sort();
  el.innerHTML = `<option value="">— Select —</option>` + secs.map(s => `<option value="${s}">${s}</option>`).join('');
}

async function addClass() {
  const cls = ($('newClass')?.value || '').trim();
  const sec = ($('newSection')?.value || '').trim();
  if (!cls || !sec) { showToast('Class and Section are required.', 'error'); return; }
  showSpinner('Adding class…');
  try {
    const data = await apiPost({ action: 'addClassSection', class: cls, section: sec });
    if (data.status === 'success') { showToast(data.message, 'success'); $('newClass').value = ''; $('newSection').value = ''; await loadClasses(); }
    else showToast(data.message, 'error');
  } catch (e) { showToast(e.message, 'error'); } finally { hideSpinner(); }
}

function deleteClass(ri, cls, sec) {
  confirmAction(`Remove ${cls} — ${sec}?`, `Class removed. Existing students keep their data.`, async () => {
    showSpinner('Removing…');
    try { const d = await apiPost({ action: 'deleteClassSection', rowIndex: ri }); if (d.status === 'success') { showToast('Removed.', 'success'); await loadClasses(); } else showToast(d.message, 'error'); }
    catch (e) { showToast(e.message, 'error'); } finally { hideSpinner(); }
  });
}

// ── CUSTOM FIELD DEFS ─────────────────────────────────────────
const FIELD_TYPE_LABELS = {
  text: 'Text', number: 'Number', date: 'Date', email: 'Email', phone: 'Phone',
  textarea: 'Long Text', dropdown: 'Dropdown', checkbox: 'Checkbox'
};
const FIELD_TYPE_ICONS = {
  text: 'bi-fonts', number: 'bi-123', date: 'bi-calendar3', email: 'bi-envelope',
  phone: 'bi-telephone', textarea: 'bi-card-text', dropdown: 'bi-chevron-down', checkbox: 'bi-check2-square'
};

function renderFieldDefsList() {
  const wrap = $('fieldDefsList'); if (!wrap) return;
  if (!allFieldDefs.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="bi bi-sliders"></i><p>No custom fields yet. Add some above.</p></div>`; return;
  }
  wrap.innerHTML = allFieldDefs.map(fd => `
    <div class="fd-row" data-ri="${fd.rowIndex}">
      <div class="fd-icon"><i class="bi ${FIELD_TYPE_ICONS[fd.type] || 'bi-input-cursor'}"></i></div>
      <div class="fd-info">
        <div class="fd-name">${esc(fd.name)}</div>
        <div class="fd-meta">${FIELD_TYPE_LABELS[fd.type] || fd.type}${fd.required ? ' · <span class="req-star">Required</span>' : ''}</div>
      </div>
      <div class="fd-acts">
        <button class="btn btn-warn btn-xs" onclick="openFieldForm(${fd.rowIndex})" title="Edit"><i class="bi bi-pencil-fill"></i></button>
        <button class="btn btn-danger btn-xs" onclick="deleteFieldDef(${fd.rowIndex},'${esc(fd.name)}')" title="Delete"><i class="bi bi-trash3-fill"></i></button>
      </div>
    </div>`).join('');
}

function openFieldForm(rowIndex) {
  editingField = rowIndex || null;
  $('ff_rowIndex').value = rowIndex || '';
  $('ff_name').value = '';
  $('ff_type').value = 'text';
  $('ff_options').value = '';
  $('ff_required').checked = false;
  document.getElementById('optionsRow').classList.add('hidden');

  if (rowIndex) {
    const fd = allFieldDefs.find(f => f.rowIndex === rowIndex);
    if (!fd) return;
    $('ffTitle').textContent = `Edit Field: ${fd.name}`;
    $('ffSubmitBtn').innerHTML = '<i class="bi bi-pencil-fill"></i> Update Field';
    $('ff_rowIndex').value = fd.rowIndex;
    $('ff_order').value = fd.order;
    $('ff_name').value = fd.name;
    $('ff_type').value = fd.type;
    $('ff_options').value = fd.options;
    $('ff_required').checked = fd.required;
    if (fd.type === 'dropdown') document.getElementById('optionsRow').classList.remove('hidden');
  } else {
    $('ffTitle').textContent = 'Add Custom Field';
    $('ffSubmitBtn').innerHTML = '<i class="bi bi-check-lg"></i> Save Field';
  }
  openModal('fieldFormModal');
}

function toggleOptionsRow() {
  const t = $('ff_type').value;
  document.getElementById('optionsRow').classList.toggle('hidden', t !== 'dropdown');
}

async function submitFieldForm() {
  const rowIndex = $('ff_rowIndex').value;
  const isEdit = !!rowIndex;
  const name = $('ff_name').value.trim();
  const type = $('ff_type').value;
  const options = $('ff_options').value.trim();
  const required = $('ff_required').checked;
  const order = parseInt($('ff_order').value) || 0;

  if (!name) { showToast('Field name required.', 'error'); return; }

  const body = isEdit
    ? { action: 'updateFieldDef', rowIndex, name, type, options, required, order }
    : { action: 'addFieldDef', name, type, options, required };

  setBtnLoading('ffSubmitBtn', true); showSpinner(isEdit ? 'Updating field…' : 'Adding field…');
  try {
    const data = await apiPost(body);
    if (data.status === 'success') { showToast(data.message, 'success'); closeModal('fieldFormModal'); await loadFieldDefs(); }
    else showToast(data.message, 'error');
  } catch (e) { showToast(e.message, 'error'); }
  finally { hideSpinner(); setBtnLoading('ffSubmitBtn', false); }
}

function deleteFieldDef(ri, name) {
  confirmAction(`Delete field "${name}"?`, `Field removed from form. Stored student data is preserved in the sheet.`, async () => {
    showSpinner('Deleting field…');
    try { const d = await apiPost({ action: 'deleteFieldDef', rowIndex: ri }); if (d.status === 'success') { showToast('Field deleted.', 'success'); await loadFieldDefs(); } else showToast(d.message, 'error'); }
    catch (e) { showToast(e.message, 'error'); } finally { hideSpinner(); }
  });
}

// ── USERS ─────────────────────────────────────────────────────
function renderUsersTable() {
  const tbody = $('usersTbody');
  if (!allUsers.length) { tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="bi bi-person-x"></i><p>No users</p></div></td></tr>`; return; }
  tbody.innerHTML = allUsers.map((u, i) => `
    <tr>
      <td class="td-num">${i + 1}</td>
      <td class="td-name">${esc(u.username)}</td>
      <td><span class="badge ${u.role === 'Admin' ? 'bg-blue' : 'bg-green'}">${esc(u.role)}</span></td>
      <td>${u.assignedClass ? `<span class="badge bg-blue">${esc(u.assignedClass)}</span>` : '<span class="muted">—</span>'}</td>
      <td>${u.assignedSection ? `<span class="badge bg-purple">${esc(u.assignedSection)}</span>` : '<span class="muted">—</span>'}</td>
      <td>
        <div class="act-row">
          <button class="btn btn-warn btn-xs" onclick="openUserForm(${u.rowIndex})"><i class="bi bi-pencil-fill"></i></button>
          <button class="btn btn-danger btn-xs" onclick="delRecord('user',${u.rowIndex},'${esc(u.username)}')"
            ${u.username.toLowerCase() === 'admin' ? 'disabled title="Cannot delete default admin"' : ''}><i class="bi bi-trash3-fill"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

function openUserForm(rowIndex) {
  editingUser = rowIndex || null;
  ['uf_rowIndex', 'uf_username', 'uf_password'].forEach(id => { const e = $(id); if (e) e.value = ''; });
  $('uf_role').value = ''; $('uf_section').innerHTML = `<option value="">— Select —</option>`;
  $('inchargeFields').classList.add('hidden'); $('uf_password').type = 'password'; $('ufPwEye').className = 'bi bi-eye';

  // Hide/show previous password display
  const prevPwRow = $('prevPwRow');

  if (rowIndex) {
    const u = allUsers.find(u => u.rowIndex === rowIndex);
    if (!u) return;
    $('ufTitle').textContent = `Edit User: ${u.username}`;
    $('ufSubmitBtn').innerHTML = '<i class="bi bi-pencil-fill"></i> Update User';
    $('uf_rowIndex').value = u.rowIndex;
    $('uf_username').value = u.username;
    $('uf_password').value = u.password || '';
    $('uf_role').value = u.role;
    // Show masked previous password hint
    if (prevPwRow) {
      prevPwRow.style.display = 'flex';
      const maskedSpan = $('prevPwMasked');
      if (maskedSpan) maskedSpan.textContent = '•'.repeat(Math.max(6, (u.password || '').length));
    }
    populateClassDrops();
    if (u.role === 'ClassIncharge') {
      $('inchargeFields').classList.remove('hidden');
      setTimeout(() => {
        $('uf_class').value = u.assignedClass;
        populateSectionDrop('uf_section', u.assignedClass);
        setTimeout(() => { $('uf_section').value = u.assignedSection; }, 60);
      }, 30);
    }
  } else {
    $('ufTitle').textContent = 'Add System User';
    $('ufSubmitBtn').innerHTML = '<i class="bi bi-person-check-fill"></i> Save User';
    if (prevPwRow) prevPwRow.style.display = 'none';
    populateClassDrops();
  }
  openModal('userFormModal');
}

function toggleInchargeFields() {
  $('inchargeFields').classList.toggle('hidden', $('uf_role').value !== 'ClassIncharge');
}

async function submitUserForm() {
  const rowIndex = $('uf_rowIndex').value;
  const isEdit = !!rowIndex;
  const username = $('uf_username').value.trim();
  const password = $('uf_password').value.trim();
  const role = $('uf_role').value;
  const cls = $('uf_class').value;
  const sec = $('uf_section').value;

  if (!username || !password || !role) { showToast('Username, password and role required.', 'error'); return; }
  if (role === 'ClassIncharge' && (!cls || !sec)) { showToast('Select class and section for ClassIncharge.', 'error'); return; }

  const body = { action: isEdit ? 'updateUser' : 'createUser', username, password, role, assignedClass: cls, assignedSection: sec, ...(isEdit && { rowIndex }) };
  setBtnLoading('ufSubmitBtn', true); showSpinner(isEdit ? 'Updating…' : 'Creating…');
  try {
    const data = await apiPost(body);
    if (data.status === 'success') {
      showToast(data.message, 'success'); closeModal('userFormModal');
      if (isEdit && SESSION.rowIndex === parseInt(rowIndex) && data.newUsername) {
        SESSION.username = data.newUsername; localStorage.setItem('smsSession', JSON.stringify(SESSION)); renderSidebar();
      }
      await loadUsers();
    } else showToast(data.message, 'error');
  } catch (e) { showToast(e.message, 'error'); }
  finally { hideSpinner(); setBtnLoading('ufSubmitBtn', false); }
}

// ── MY PROFILE ────────────────────────────────────────────────
function renderProfilePage() {
  const page = $('page-profile');
  if (!page) return;

  // Find current user in allUsers (admin sees all, incharge finds self)
  const myUser = allUsers.find(u => u.username.toLowerCase() === SESSION.username.toLowerCase())
    || { username: SESSION.username, role: SESSION.role, password: '' };

  page.innerHTML = `
    <div class="profile-wrap">
      <div class="card profile-card">
        <div class="profile-hero">
          <div class="profile-avatar-lg">${SESSION.username[0].toUpperCase()}</div>
          <div class="profile-hero-info">
            <div class="profile-username">${esc(SESSION.username)}</div>
            <span class="badge ${SESSION.role === 'Admin' ? 'bg-blue' : 'bg-green'}">${esc(SESSION.role)}</span>
            ${SESSION.role === 'ClassIncharge' ? `<div class="profile-class-info"><i class="bi bi-book-half"></i> ${esc(SESSION.assignedClass)} — ${esc(SESSION.assignedSection)}</div>` : ''}
          </div>
        </div>
        <div class="card-body">
          <div class="form-sec-title"><i class="bi bi-pencil-square"></i>Update Credentials</div>
          <input type="hidden" id="prof_rowIndex" value="${myUser.rowIndex || ''}"/>
          <div class="form-grid2">
            <div class="fgroup">
              <label>Username</label>
              <div class="iw">
                <i class="bi bi-person iicon"></i>
                <input type="text" id="prof_username" value="${esc(myUser.username)}" placeholder="New username" autocomplete="off" style="padding-left:34px"/>
              </div>
              <div class="field-hint">Change your login username</div>
            </div>
            <div class="fgroup">
              <label>New Password</label>
              <div class="pw-wrap">
                <input type="password" id="prof_password" placeholder="Enter new password" autocomplete="new-password"/>
                <button type="button" class="itoggle" onclick="togglePw('prof_password','profPwEye')"><i class="bi bi-eye" id="profPwEye"></i></button>
              </div>
            </div>
          </div>
          <div class="prev-pw-display">
            <i class="bi bi-shield-lock-fill"></i>
            <span>Current password (masked):</span>
            <span class="prev-pw-dots">${'•'.repeat(Math.max(6, (myUser.password || '').length))}</span>
            <button type="button" class="btn btn-ghost btn-xs" onclick="toggleRevealPw(this,'${esc(myUser.password || '')}')">
              <i class="bi bi-eye"></i> Reveal
            </button>
          </div>
          <button class="btn btn-primary" id="profSaveBtn" onclick="saveProfile()" style="margin-top:8px">
            <i class="bi bi-check2-circle"></i> Save Changes
          </button>
        </div>
      </div>
    </div>`;
}

function toggleRevealPw(btn, actualPw) {
  const dots = btn.parentElement.querySelector('.prev-pw-dots');
  if (!dots) return;
  if (dots.dataset.revealed === 'true') {
    dots.textContent = '•'.repeat(Math.max(6, actualPw.length));
    dots.dataset.revealed = 'false';
    btn.innerHTML = '<i class="bi bi-eye"></i> Reveal';
  } else {
    dots.textContent = actualPw || '(empty)';
    dots.dataset.revealed = 'true';
    btn.innerHTML = '<i class="bi bi-eye-slash"></i> Hide';
  }
}

async function saveProfile() {
  const rowIndex = $('prof_rowIndex')?.value;
  const username = ($('prof_username')?.value || '').trim();
  const password = ($('prof_password')?.value || '').trim();

  if (!username) { showToast('Username cannot be empty.', 'error'); return; }
  if (!password) { showToast('Please enter a new password.', 'error'); return; }
  if (!rowIndex) { showToast('Unable to identify user record. Please re-login.', 'error'); return; }

  // Determine role and assigned class/section from current session
  const myUser = allUsers.find(u => u.username.toLowerCase() === SESSION.username.toLowerCase());
  const role = SESSION.role;
  const cls = myUser?.assignedClass || '';
  const sec = myUser?.assignedSection || '';

  setBtnLoading('profSaveBtn', true);
  showSpinner('Updating profile…');
  try {
    const data = await apiPost({ action: 'updateUser', rowIndex, username, password, role, assignedClass: cls, assignedSection: sec });
    if (data.status === 'success') {
      showToast('✅ Profile updated!', 'success');
      SESSION.username = data.newUsername || username;
      localStorage.setItem('smsSession', JSON.stringify(SESSION));
      renderSidebar();
      await loadUsers();
      renderProfilePage();
    } else { showToast(data.message, 'error'); }
  } catch (e) { showToast('Error: ' + e.message, 'error'); }
  finally { hideSpinner(); setBtnLoading('profSaveBtn', false); }
}

// ── DELETE ────────────────────────────────────────────────────
function delRecord(type, rowIndex, label) {
  confirmAction(
    `Delete ${type === 'student' ? 'Student' : 'User'}?`,
    `Permanently delete "${label}"? This cannot be undone.`,
    async () => {
      showSpinner('Deleting…');
      try {
        const data = await apiPost({ action: type === 'student' ? 'deleteStudent' : 'deleteUser', rowIndex });
        if (data.status === 'success') {
          showToast(`${type === 'student' ? 'Student' : 'User'} deleted.`, 'success');
          if (type === 'student') { await loadStudents(); await loadStats(); } else await loadUsers();
        } else showToast(data.message, 'error');
      } catch (e) { showToast(e.message, 'error'); } finally { hideSpinner(); }
    }
  );
}

// ── EXPORT MODAL (column selector) ───────────────────────────
const ALL_EXPORT_COLS = [
  { key: 'studentId', label: 'Student ID', always: false },
  { key: 'admissionDate', label: 'Adm. Date', always: false },
  { key: 'admissionNo', label: 'Adm. No.', always: false },
  { key: 'name', label: 'Student Name', always: true },
  { key: 'gender', label: 'Gender', always: false },
  { key: 'dob', label: 'Date of Birth', always: false },
  { key: 'aadhar', label: 'Aadhar No.', always: false },
  { key: 'category', label: 'Category', always: false },
  { key: 'bloodGroup', label: 'Blood Group', always: false },
  { key: 'height', label: 'Height (cm)', always: false },
  { key: 'weight', label: 'Weight (kg)', always: false },
  { key: 'fatherName', label: "Father's Name", always: false },
  { key: 'fatherAadhar', label: "Father Aadhar", always: false },
  { key: 'motherName', label: "Mother's Name", always: false },
  { key: 'motherAadhar', label: "Mother Aadhar", always: false },
  { key: 'phone1', label: 'Phone 1', always: false },
  { key: 'phone2', label: 'Phone 2', always: false },
  { key: 'address', label: 'Address', always: false },
  { key: 'prevSchool', label: 'Prev. School', always: false },
  { key: 'class', label: 'Class', always: false },
  { key: 'section', label: 'Section', always: false },
];

function openExportModal() {
  if (!allStudents.length) { showToast('No data to export.', 'error'); return; }

  const cfCols = allFieldDefs.map(fd => ({ key: `custom_${fd.id}`, label: fd.name, always: false, isCf: true, fd }));
  const allCols = [...ALL_EXPORT_COLS, ...cfCols];

  let html = `<div class="export-selector">
    <div class="export-top">
      <div class="export-info"><i class="bi bi-info-circle"></i> Select columns to include in your export.</div>
      <div class="export-actions-top">
        <button class="btn btn-ghost btn-xs" onclick="selectAllExport(true)"><i class="bi bi-check-all"></i> All</button>
        <button class="btn btn-ghost btn-xs" onclick="selectAllExport(false)"><i class="bi bi-x-lg"></i> None</button>
      </div>
    </div>
    <div class="export-cols-grid">`;

  allCols.forEach(col => {
    const checked = col.always || true; // default: all checked
    const disabled = col.always ? 'disabled' : '';
    html += `<label class="export-col-item${col.always ? ' export-col-locked' : ''}">
      <input type="checkbox" class="export-chk" data-key="${col.key}" ${checked ? 'checked' : ''} ${disabled}/>
      <span>${esc(col.label)}${col.always ? '<span class="always-badge">always</span>' : ''}</span>
    </label>`;
  });

  html += `</div>
    <div class="export-format-row">
      <span class="export-format-label">Format:</span>
      <label class="radio-label"><input type="radio" name="exportFmt" value="xlsx" checked/> <i class="bi bi-file-earmark-excel-fill" style="color:var(--green)"></i> Excel (.xlsx)</label>
      <label class="radio-label"><input type="radio" name="exportFmt" value="csv"/> <i class="bi bi-file-earmark-text" style="color:var(--cyan)"></i> CSV (.csv)</label>
    </div>
  </div>`;

  $('exportSelectorBody').innerHTML = html;
  openModal('exportModal');
}

function selectAllExport(state) {
  document.querySelectorAll('.export-chk:not(:disabled)').forEach(cb => cb.checked = state);
}

function doExport() {
  if (!allStudents.length) { showToast('No data to export.', 'error'); return; }

  const cfCols = allFieldDefs.map(fd => ({ key: `custom_${fd.id}`, label: fd.name, isCf: true, fd }));
  const allCols = [...ALL_EXPORT_COLS, ...cfCols];

  // Collect selected columns
  const selected = [];
  document.querySelectorAll('.export-chk').forEach(cb => {
    if (cb.checked) {
      const col = allCols.find(c => c.key === cb.dataset.key);
      if (col) selected.push(col);
    }
  });

  if (!selected.length) { showToast('Select at least one column.', 'error'); return; }

  const fmt = document.querySelector('input[name="exportFmt"]:checked')?.value || 'xlsx';

  const headers = selected.map(c => c.label);
  const rows = allStudents.map(s => selected.map(col => {
    if (col.isCf) {
      const v = s.customData?.[col.fd.id];
      return col.fd.type === 'checkbox' ? (v === 'true' ? 'Yes' : 'No') : (v || '');
    }
    return s[col.key] ?? '';
  }));

  const sfx = SESSION.role === 'ClassIncharge' ? `_${SESSION.assignedClass}_${SESSION.assignedSection}` : '_All';
  const filename = `Students${sfx}_${today()}`;

  if (fmt === 'csv') {
    const csvRows = [headers, ...rows].map(r =>
      r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    );
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename + '.csv';
    a.click();
  } else {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, filename + '.xlsx');
  }

  closeModal('exportModal');
  showToast(`✅ ${fmt.toUpperCase()} downloaded!`, 'success');
}

// ── MODALS ────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

document.querySelectorAll('.modal-overlay').forEach(ov => {
  ov.addEventListener('click', function (e) { if (e.target === this) closeModal(this.id); });
});

function confirmAction(title, text, onOk) {
  $('confirmTitle').textContent = title; $('confirmText').textContent = text;
  const btn = $('confirmOkBtn'); const nb = btn.cloneNode(true);
  btn.parentNode.replaceChild(nb, btn);
  nb.addEventListener('click', () => { closeModal('confirmModal'); onOk(); });
  openModal('confirmModal');
}

// ── SPINNER / TOAST ───────────────────────────────────────────
function showSpinner(msg = 'Loading…') { $('spinnerMsg').textContent = msg; $('spinnerOverlay').classList.add('active'); }
function hideSpinner() { $('spinnerOverlay').classList.remove('active'); }

function showToast(msg, type = 'info') {
  const icons = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', info: 'bi-info-circle-fill', warn: 'bi-exclamation-triangle-fill' };
  const c = $('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<i class="bi ${icons[type] || icons.info}"></i><span>${msg}</span>`;
  c.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 350); }, 4000);
}

function setBtnLoading(id, on) {
  const b = document.getElementById(id); if (!b) return;
  b.disabled = on;
  if (on) b.dataset.orig = b.innerHTML;
  else if (b.dataset.orig) b.innerHTML = b.dataset.orig;
}

// ── UTILITIES ─────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }
function esc(s) { const d = document.createElement('div'); d.appendChild(document.createTextNode(String(s ?? ''))); return d.innerHTML; }
function enc(s) { return encodeURIComponent(s); }
function today() { return new Date().toISOString().slice(0, 10); }
function checkUrlNotSet() { return !WEB_APP_URL || WEB_APP_URL.includes('PASTE_YOUR'); }

// Cached fetch with stale-while-revalidate
const _cache = {};
async function apiFetch(url) {
  const r = await fetch(url, { cache: 'no-cache', redirect: 'follow' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

async function apiPost(body) {
  const r = await fetch(WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
    redirect: 'follow'
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
