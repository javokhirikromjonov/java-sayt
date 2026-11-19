/* Ikromjonov.org — admin panel */
let me = null;
let tab = 'dashboard';
const root = $('#root');

function loginScreen() {
  root.innerHTML = `<div style="min-height:100vh;display:grid;place-items:center;padding:16px">
    <div class="modal"><div class="logo" style="margin-bottom:14px"><i>I</i> Admin panel</div>
    <h2>Kirish</h2><p class="sub">Faqat adminlar va sayt egasi uchun.</p>
    <form id="lf"><label>Login</label><input name="login" required autocomplete="username" autocapitalize="off">
    <label>Parol</label><input type="password" name="password" required autocomplete="current-password">
    <p class="err" id="le"></p><button class="btn" style="width:100%">Kirish</button></form>
    <p class="sub" style="text-align:center;margin-top:14px"><a href="/">← Saytga qaytish</a></p></div></div>`;
  $('#lf').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const r = await api('/api/login', { method: 'POST', body: { login: e.target.login.value, password: e.target.password.value } });
      me = r.user;
      if (me.role === 'student') { await api('/api/logout', { method: 'POST', body: {} }); me = null; $('#le').textContent = 'Bu hisob admin emas'; return; }
      shell();
    } catch (err) { $('#le').textContent = err.message; }
  });
}

const TABS = [
  ['dashboard', '📊 Statistika'], ['users', '👥 Foydalanuvchilar'], ['courses', '📚 Kurslar'], ['admins', '🛡 Adminlar', true]
];
function shell() {
  const tabs = TABS.filter(t => !t[2] || me.role === 'owner');
  root.innerHTML = `<div class="admin-wrap">
    <aside class="side">
      <a class="logo" href="/"><i>I</i> Ikromjonov.org</a>
      ${tabs.map(t => `<button class="tab ${tab === t[0] ? 'active' : ''}" data-tab="${t[0]}">${t[1]}</button>`).join('')}
      <div class="bottom">
        <div class="sub" style="color:var(--muted);font-size:13px;padding:0 6px">${esc(me.name)}<br><b>${me.role === 'owner' ? 'Ega' : 'Admin'}</b></div>
        <button class="btn ghost sm" data-act="password">🔑 Parol</button>
        <button class="btn ghost sm" id="themeBtn">🌓 Mavzu</button>
        <button class="btn ghost sm" data-act="logout">Chiqish</button>
      </div>
    </aside>
    <main class="main" id="main"></main></div>`;
  initTheme();
  show();
}
async function show() {
  $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const main = $('#main');
  main.innerHTML = '<div class="empty">Yuklanmoqda…</div>';
  const banner = me.mustChange ? `<div class="banner">⚠️ Siz boshlang‘ich paroldan foydalanyapsiz. Xavfsizlik uchun uni hoziroq o‘zgartiring (chap pastdagi «🔑 Parol»).</div>` : '';
  try {
    if (tab === 'dashboard') await viewDashboard(main, banner);
    else if (tab === 'users') await viewUsers(main, banner);
    else if (tab === 'courses') await viewCourses(main, banner);
    else if (tab === 'admins') await viewAdmins(main, banner);
  } catch (e) { main.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

/* ---- Statistika ---- */
async function viewDashboard(main, banner) {
  const s = await api('/api/admin/stats');
  const max = Math.max(1, ...s.days.map(d => d.count));
  main.innerHTML = `${banner}<h1>Statistika</h1>
    <div class="kpis">
      <div class="kpi"><span>O‘quvchilar</span><b>${s.users}</b></div>
      <div class="kpi"><span>Adminlar</span><b>${s.admins}</b></div>
      <div class="kpi"><span>Kurslar</span><b>${s.courses}</b></div>
      <div class="kpi"><span>Kursga yozilishlar</span><b>${s.enrollments}</b></div>
      <div class="kpi"><span>Yuklangan fayllar</span><b>${s.files}</b></div>
    </div>
    <div class="two">
      <div class="panel"><h3 style="margin:0">Oxirgi 7 kunda ro‘yxatdan o‘tganlar</h3>
        <div class="bars">${s.days.map(d => `<div><b>${d.count}</b><i style="height:${Math.max(4, d.count / max * 100)}%"></i>${d.date}</div>`).join('')}</div></div>
      <div class="panel"><h3 style="margin:0 0 12px">Eng ommabop kurslar</h3>
        ${s.top.map(t => `<div class="file-row"><span class="grow">${esc(t.title)}</span><b>${t.students}</b></div>`).join('') || '<div class="empty">Ma’lumot yo‘q</div>'}</div>
    </div>`;
}

/* ---- Foydalanuvchilar ---- */
async function viewUsers(main, banner) {
  main.innerHTML = `${banner}<div class="head"><h1 style="margin:0">Foydalanuvchilar</h1>
    <div class="tools"><input id="uq" type="search" placeholder="🔍 Ism, login yoki telefon…"><a class="btn ghost" href="/api/admin/users.csv">⬇ Excel (CSV) eksport</a></div></div>
    <div class="table-wrap"><table><thead><tr><th>№</th><th>Ism</th><th>Login</th><th>Telefon</th><th>Kurslar</th><th>Sana</th><th></th></tr></thead><tbody id="ub"></tbody></table></div>
    <p class="sub" id="ucount" style="color:var(--muted)"></p>`;
  const load = async () => {
    const r = await api('/api/admin/users?q=' + encodeURIComponent($('#uq').value));
    $('#ub').innerHTML = r.users.map((u, i) => `<tr><td>${i + 1}</td><td>${esc(u.name)}</td><td>${esc(u.login)}</td><td>${esc(u.phone) || '—'}</td><td>${u.courses}</td><td>${fmtDate(u.createdAt)}</td>
      <td><div class="row-actions"><button class="btn sm ghost" data-act="resetpw" data-id="${u.id}" data-name="${esc(u.name)}">🔑</button><button class="btn sm danger" data-act="deluser" data-id="${u.id}" data-name="${esc(u.name)}">🗑</button></div></td></tr>`).join('')
      || '<tr><td colspan="7" class="empty">Foydalanuvchilar topilmadi</td></tr>';
    $('#ucount').textContent = `Jami: ${r.users.length} ta o‘quvchi`;
  };
  let t; $('#uq').addEventListener('input', () => { clearTimeout(t); t = setTimeout(load, 250); });
  await load();
}

/* ---- Kurslar ---- */
let courseCache = [];
async function viewCourses(main, banner) {
  const r = await api('/api/admin/courses');
  courseCache = r.courses;
  main.innerHTML = `${banner}<div class="head"><h1 style="margin:0">Kurslar</h1><button class="btn" data-act="newcourse">＋ Yangi kurs</button></div>
    <div class="table-wrap"><table><thead><tr><th>Kurs</th><th>Yo‘nalish</th><th>Darslar</th><th>Fayllar</th><th>O‘quvchilar</th><th>Narx</th><th>Holat</th><th></th></tr></thead><tbody>
    ${r.courses.map(c => `<tr><td>${esc(c.icon)} ${esc(c.title)}</td><td>${esc(c.category)}</td><td>${c.lessonCount}</td><td>${c.fileCount}</td><td>${c.students}</td><td>${fmtMoney(c.price)}</td>
      <td>${c.published ? '<span class="tag">Faol</span>' : '<span class="tag" style="background:var(--line);color:var(--muted)">Qoralama</span>'}</td>
      <td><div class="row-actions"><button class="btn sm ghost" data-act="editcourse" data-id="${c.id}">✏️ Tahrirlash</button><button class="btn sm danger" data-act="delcourse" data-id="${c.id}" data-name="${esc(c.title)}">🗑</button></div></td></tr>`).join('')
      || '<tr><td colspan="8" class="empty">Kurslar yo‘q. «Yangi kurs» tugmasini bosing.</td></tr>'}</tbody></table></div>`;
}

let editing = null; // { id|null, lessons:[], files:[] }
async function courseModal(id) {
  let c = { title: '', description: '', category: '', level: 'Boshlang‘ich', duration: '', price: 0, icon: '📘', published: true, lessons: [], files: [] };
  if (id) c = (await api('/api/admin/courses/' + id)).course;
  editing = { id: id || null, lessons: c.lessons.map(l => ({ ...l })), files: c.files.slice() };
  openModal(`<h2>${id ? 'Kursni tahrirlash' : 'Yangi kurs'}</h2>
    <form id="cf">
      <div class="cols"><div><label>Kurs nomi</label><input name="title" required maxlength="120" value="${esc(c.title)}"></div>
        <div><label>Yo‘nalish</label><input name="category" maxlength="40" placeholder="Masalan: Dasturlash" value="${esc(c.category)}"></div></div>
      <label>Tavsif</label><textarea name="description" maxlength="2000">${esc(c.description)}</textarea>
      <div class="cols3"><div><label>Daraja</label><input name="level" maxlength="30" value="${esc(c.level)}"></div>
        <div><label>Davomiyligi</label><input name="duration" maxlength="30" placeholder="6 hafta" value="${esc(c.duration)}"></div>
        <div><label>Narx (so‘m, 0 = bepul)</label><input name="price" type="number" min="0" value="${c.price}"></div></div>
      <div class="cols"><div><label>Belgi (emoji)</label><input name="icon" maxlength="4" value="${esc(c.icon)}"></div>
        <div class="check"><input type="checkbox" name="published" id="pub" ${c.published ? 'checked' : ''}><label for="pub" style="margin:0;color:var(--text)">Saytda ko‘rinsin (faol)</label></div></div>
      <label>Darslar</label><div id="lessons"></div>
      <button type="button" class="btn ghost sm" data-act="addlesson">＋ Dars qo‘shish</button>
      <div id="filesBox"></div>
      <p class="err" id="cerr"></p>
      <div style="display:flex;gap:10px;margin-top:8px"><button class="btn">Saqlash</button><button type="button" class="btn ghost" data-act="closemodal">Bekor qilish</button></div>
    </form>`, { wide: true });
  drawLessons(); drawFiles();
  $('#cf').addEventListener('submit', async e => {
    e.preventDefault(); readLessons();
    const f = e.target;
    const body = { title: f.title.value, category: f.category.value, description: f.description.value, level: f.level.value,
      duration: f.duration.value, price: f.price.value, icon: f.icon.value, published: f.published.checked, lessons: editing.lessons };
    try {
      const r = await api(editing.id ? '/api/admin/courses/' + editing.id : '/api/admin/courses', { method: editing.id ? 'PUT' : 'POST', body });
      toast('Saqlandi ✓');
      if (!editing.id) { editing.id = r.course.id; editing.files = []; courseModal(r.course.id); show(); return; }
      closeModal(); show();
    } catch (err) { $('#cerr').textContent = err.message; }
  });
}
function readLessons() {
  $$('.lesson-edit').forEach((el, i) => {
    editing.lessons[i].title = $('.lt', el).value;
    editing.lessons[i].videoUrl = $('.lv', el).value;
    editing.lessons[i].content = $('.lc', el).value;
  });
}
function drawLessons() {
  $('#lessons').innerHTML = editing.lessons.map((l, i) => `<div class="lesson-edit">
    <div class="top"><b>${i + 1}.</b><input class="lt" placeholder="Dars nomi" maxlength="150" value="${esc(l.title)}">
      <button type="button" class="btn sm ghost" data-act="lup" data-i="${i}">↑</button><button type="button" class="btn sm ghost" data-act="ldown" data-i="${i}">↓</button>
      <button type="button" class="btn sm danger" data-act="ldel" data-i="${i}">✕</button></div>
    <input class="lv" style="margin-top:8px" placeholder="YouTube video havolasi (ixtiyoriy)" maxlength="300" value="${esc(l.videoUrl)}">
    <textarea class="lc" style="margin-top:8px" placeholder="Dars matni…" maxlength="20000">${esc(l.content)}</textarea></div>`).join('')
    || '<p class="sub" style="color:var(--muted)">Hali dars yo‘q.</p>';
}
function drawFiles() {
  const box = $('#filesBox');
  if (!editing.id) { box.innerHTML = '<p class="sub" style="color:var(--muted);margin-top:16px">📎 Word/Excel fayl yuklash uchun avval kursni saqlang.</p>'; return; }
  box.innerHTML = `<label>📎 Materiallar (Word, Excel, PDF, PowerPoint — 8 MB gacha)</label>
    ${editing.files.map(f => `<div class="file-row"><span class="grow">${esc(f.name)}</span><span class="sub" style="color:var(--muted)">${fmtSize(f.size)}</span>
      <button type="button" class="btn sm danger" data-act="delfile" data-id="${f.id}">🗑</button></div>`).join('')}
    <input type="file" id="fileIn" accept=".doc,.docx,.xls,.xlsx,.csv,.pdf,.ppt,.pptx,.txt,.zip" multiple>`;
  $('#fileIn').addEventListener('change', async ev => {
    for (const file of ev.target.files) {
      if (file.size > 8 * 1024 * 1024) { toast(file.name + ': 8 MB dan katta'); continue; }
      try {
        toast('Yuklanmoqda: ' + file.name);
        const r = await api(`/api/admin/courses/${editing.id}/files`, { method: 'POST', raw: true, body: file, headers: { 'x-filename': encodeURIComponent(file.name) } });
        editing.files.push(r.file); readLessons(); drawFiles(); toast('Yuklandi ✓');
      } catch (err) { toast(err.message); }
    }
  });
}

/* ---- Adminlar (faqat ega) ---- */
async function viewAdmins(main, banner) {
  const r = await api('/api/owner/admins');
  main.innerHTML = `${banner}<div class="head"><h1 style="margin:0">Adminlar</h1><button class="btn" data-act="newadmin">＋ Admin qo‘shish</button></div>
    <div class="table-wrap"><table><thead><tr><th>Ism</th><th>Login</th><th>Rol</th><th>Qo‘shilgan</th><th></th></tr></thead><tbody>
    ${r.admins.map(a => `<tr><td>${esc(a.name)}</td><td>${esc(a.login)}</td><td><span class="tag">${a.role === 'owner' ? 'Ega' : 'Admin'}</span></td><td>${fmtDate(a.createdAt)}</td>
      <td>${a.role === 'admin' ? `<button class="btn sm danger" data-act="deladmin" data-id="${a.id}" data-name="${esc(a.name)}">Huquqini olish</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
    <p class="sub" style="color:var(--muted)">Adminlar foydalanuvchilar, kurslar va fayllarni boshqara oladi. Yangi adminlarni faqat ega qo‘sha oladi.</p>`;
}
function adminModal() {
  openModal(`<h2>Yangi admin</h2><p class="sub">Mavjud o‘quvchi loginini kiritsangiz, u adminga ko‘tariladi.</p>
    <form id="af"><label>Ism-familiya</label><input name="name" required maxlength="80">
    <label>Login</label><input name="login" required maxlength="80" autocapitalize="off">
    <label>Parol (kamida 6 belgi)</label><input type="password" name="password" required minlength="6" autocomplete="new-password">
    <p class="err" id="ae"></p><button class="btn" style="width:100%">Qo‘shish</button></form>`);
  $('#af').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await api('/api/owner/admins', { method: 'POST', body: { name: e.target.name.value, login: e.target.login.value, password: e.target.password.value } });
      closeModal(); toast('Admin qo‘shildi ✓'); show();
    } catch (err) { $('#ae').textContent = err.message; }
  });
}

function confirmModal(text, onYes) {
  openModal(`<h2>Ishonchingiz komilmi?</h2><p class="sub">${text}</p>
    <div style="display:flex;gap:10px;margin-top:16px"><button class="btn danger" id="yes">Ha, davom etish</button><button class="btn ghost" data-act="closemodal">Bekor qilish</button></div>`);
  $('#yes').addEventListener('click', async () => { try { await onYes(); closeModal(); show(); } catch (e) { toast(e.message); } });
}

/* ---- Hodisalar ---- */
document.addEventListener('click', async e => {
  const tb = e.target.closest('[data-tab]');
  if (tb) { tab = tb.dataset.tab; show(); return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act, id = el.dataset.id, i = +el.dataset.i;
  try {
    if (a === 'logout') { await api('/api/logout', { method: 'POST', body: {} }); me = null; loginScreen(); }
    else if (a === 'password') passwordModal(u => { me = u; shell(); });
    else if (a === 'closemodal') closeModal();
    else if (a === 'newcourse') courseModal(null);
    else if (a === 'editcourse') courseModal(id);
    else if (a === 'delcourse') confirmModal(`«${esc(el.dataset.name)}» kursi, uning darslari va fayllari o‘chiriladi.`, () => api('/api/admin/courses/' + id, { method: 'DELETE' }));
    else if (a === 'addlesson') { readLessons(); editing.lessons.push({ title: '', videoUrl: '', content: '' }); drawLessons(); }
    else if (a === 'ldel') { readLessons(); editing.lessons.splice(i, 1); drawLessons(); }
    else if (a === 'lup' && i > 0) { readLessons(); [editing.lessons[i - 1], editing.lessons[i]] = [editing.lessons[i], editing.lessons[i - 1]]; drawLessons(); }
    else if (a === 'ldown' && i < editing.lessons.length - 1) { readLessons(); [editing.lessons[i + 1], editing.lessons[i]] = [editing.lessons[i], editing.lessons[i + 1]]; drawLessons(); }
    else if (a === 'delfile') { await api(`/api/admin/courses/${editing.id}/files/${id}`, { method: 'DELETE' }); editing.files = editing.files.filter(f => f.id !== id); readLessons(); drawFiles(); toast('Fayl o‘chirildi'); }
    else if (a === 'deluser') confirmModal(`«${esc(el.dataset.name)}» foydalanuvchisi o‘chiriladi.`, () => api('/api/admin/users/' + id, { method: 'DELETE' }));
    else if (a === 'resetpw') {
      openModal(`<h2>Parolni tiklash</h2><p class="sub">${esc(el.dataset.name)} uchun yangi parol belgilang.</p>
        <form id="rf"><input name="p" required minlength="6" placeholder="Yangi parol (kamida 6 belgi)"><p class="err" id="re"></p><button class="btn" style="width:100%">Saqlash</button></form>`);
      $('#rf').addEventListener('submit', async ev => {
        ev.preventDefault();
        try { await api(`/api/admin/users/${id}/reset-password`, { method: 'POST', body: { password: ev.target.p.value } }); closeModal(); toast('Parol yangilandi ✓'); }
        catch (err) { $('#re').textContent = err.message; }
      });
    }
    else if (a === 'newadmin') adminModal();
    else if (a === 'deladmin') confirmModal(`«${esc(el.dataset.name)}» admin huquqidan mahrum qilinadi (oddiy foydalanuvchi bo‘lib qoladi).`, () => api('/api/owner/admins/' + id, { method: 'DELETE' }));
  } catch (err) { toast(err.message); }
});

(async function init() {
  try { me = (await api('/api/me')).user; } catch { me = null; }
  if (me && me.role !== 'student') shell(); else loginScreen();
})();
