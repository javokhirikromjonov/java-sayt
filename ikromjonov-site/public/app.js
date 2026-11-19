/* Ikromjonov.org — ommaviy sayt (hash-routing bilan SPA) */
let me = null;
const app = $('#app');

function courseCard(c, extra = '') {
  return `<a class="card" href="#/course/${c.id}">
    <div class="cover">${esc(c.icon)}</div>
    <div class="body">
      <span class="tag" style="align-self:flex-start">${esc(c.category)}</span>
      <h3>${esc(c.title)}</h3>
      <p>${esc(c.description).slice(0, 110)}${c.description.length > 110 ? '…' : ''}</p>
      <div class="meta"><span>📚 ${c.lessonCount} dars</span><span>⏱ ${esc(c.duration || '—')}</span><span>👥 ${c.students}</span></div>
      ${extra}
      <div class="meta" style="justify-content:space-between"><span class="price">${fmtMoney(c.price)}</span><span>${esc(c.level)}</span></div>
    </div></a>`;
}

function renderNav() {
  const links = [];
  if (me) {
    if (me.role !== 'student') links.push(`<a href="/admin">⚙️ Admin panel</a>`);
    links.push(`<a href="#/my">Mening kurslarim</a>`);
    links.push(`<button class="link-btn" data-act="profile">👤 ${esc(me.name.split(' ')[0])}</button>`);
    links.push(`<button class="link-btn" data-act="logout">Chiqish</button>`);
  } else {
    links.push(`<a href="#/courses">Kurslar</a>`);
    links.push(`<button class="link-btn" data-act="login">Kirish</button>`);
    links.push(`<button class="btn sm" data-act="register">Ro‘yxatdan o‘tish</button>`);
  }
  $('#navLinks').innerHTML = links.join('');
}

/* ---------- Auth oynalari ---------- */
function authModal(mode) {
  const reg = mode === 'register';
  openModal(`
    <h2>${reg ? 'Ro‘yxatdan o‘tish' : 'Tizimga kirish'}</h2>
    <p class="sub">${reg ? 'Bir daqiqada hisob yarating va o‘qishni boshlang.' : 'Qaytganingizdan xursandmiz!'}</p>
    <form id="authForm">
      ${reg ? '<label>Ism-familiya</label><input name="name" required maxlength="80" autocomplete="name">' : ''}
      <label>Login (email yoki nom)</label><input name="login" required maxlength="80" autocomplete="username" autocapitalize="off">
      ${reg ? '<label>Telefon (ixtiyoriy)</label><input name="phone" maxlength="30" autocomplete="tel" placeholder="+998 90 123 45 67">' : ''}
      <label>Parol</label><input type="password" name="password" required minlength="6" autocomplete="${reg ? 'new-password' : 'current-password'}">
      <p class="err" id="authErr"></p>
      <button class="btn" style="width:100%">${reg ? 'Ro‘yxatdan o‘tish' : 'Kirish'}</button>
    </form>
    <p class="sub" style="text-align:center;margin-top:14px">${reg ? 'Hisobingiz bormi?' : 'Hisobingiz yo‘qmi?'}
      <a href="#" data-act="${reg ? 'login' : 'register'}">${reg ? 'Kirish' : 'Ro‘yxatdan o‘tish'}</a></p>`);
  $('#authForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, btn = $('button', f);
    btn.disabled = true;
    try {
      const body = { login: f.login.value, password: f.password.value };
      if (reg) { body.name = f.name.value; body.phone = f.phone.value; }
      const r = await api(reg ? '/api/register' : '/api/login', { method: 'POST', body });
      me = r.user; closeModal(); renderNav(); toast(reg ? 'Xush kelibsiz! 🎉' : 'Xush kelibsiz, ' + me.name + '!');
      route();
    } catch (err) { $('#authErr').textContent = err.message; btn.disabled = false; }
  });
}

function profileModal() {
  openModal(`
    <h2>Profil</h2><p class="sub">Login: <b>${esc(me.login)}</b></p>
    <form id="profForm">
      <label>Ism-familiya</label><input name="name" required maxlength="80" value="${esc(me.name)}">
      <label>Telefon</label><input name="phone" maxlength="30" value="${esc(me.phone)}">
      <p class="err" id="profErr"></p>
      <button class="btn" style="width:100%">Saqlash</button>
    </form>
    <button class="btn ghost" style="width:100%;margin-top:10px" data-act="password">🔑 Parolni o‘zgartirish</button>`);
  $('#profForm').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const r = await api('/api/profile', { method: 'POST', body: { name: e.target.name.value, phone: e.target.phone.value } });
      me = r.user; renderNav(); closeModal(); toast('Saqlandi ✓');
    } catch (err) { $('#profErr').textContent = err.message; }
  });
}

/* ---------- Sahifalar ---------- */
async function pageHome() {
  app.innerHTML = `
  <section class="hero"><div class="container">
    <span class="tag">🚀 Yangi avlod ta’lim platformasi</span>
    <h1 style="margin-top:14px">Kelajak kasbini <span>bugun</span> o‘rganing</h1>
    <p>Dasturlash, xorijiy tillar va ofis dasturlari bo‘yicha amaliy online kurslar. O‘zingizga qulay vaqtda, o‘z sur’atingizda o‘qing.</p>
    <div class="row">
      <a class="btn" href="#/courses">Kurslarni ko‘rish →</a>
      ${me ? '' : '<button class="btn ghost" data-act="register">Bepul ro‘yxatdan o‘tish</button>'}
    </div>
    <div class="stats" id="homeStats"></div>
  </div></section>
  <section class="block"><div class="container">
    <div class="head"><h2>Ommabop kurslar</h2><a href="#/courses">Barchasi →</a></div>
    <div class="grid" id="homeCourses"><div class="empty">Yuklanmoqda…</div></div>
  </div></section>
  <section class="block"><div class="container">
    <div class="head"><h2>Nima uchun biz?</h2></div>
    <div class="features">
      <div class="feature"><div class="ic">🎯</div><h3>Amaliyotga yo‘naltirilgan</h3><p>Har bir darsda real loyihalar va topshiriqlar.</p></div>
      <div class="feature"><div class="ic">📈</div><h3>Progressni kuzating</h3><p>Tugatgan darslaringiz saqlanadi, foizlarda ko‘rasiz.</p></div>
      <div class="feature"><div class="ic">📎</div><h3>Materiallar yuklab olish</h3><p>Word, Excel va PDF fayllarni kursdan yuklab oling.</p></div>
      <div class="feature"><div class="ic">📱</div><h3>Istalgan qurilmada</h3><p>Telefon, planshet va kompyuterda qulay ishlaydi.</p></div>
    </div>
  </div></section>`;
  try {
    const r = await api('/api/courses');
    const total = r.courses.reduce((n, c) => n + c.students, 0);
    $('#homeStats').innerHTML = `<div><b>${r.courses.length}</b><span>kurs</span></div><div><b>${r.courses.reduce((n, c) => n + c.lessonCount, 0)}</b><span>dars</span></div><div><b>${total}</b><span>o‘quvchi yozilishi</span></div>`;
    $('#homeCourses').innerHTML = r.courses.slice(0, 3).map(c => courseCard(c)).join('') || '<div class="empty">Hozircha kurslar yo‘q</div>';
  } catch (e) { $('#homeCourses').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

async function pageCourses() {
  app.innerHTML = `<section class="block"><div class="container">
    <div class="head"><h2>Barcha kurslar</h2>
      <div class="tools"><input id="q" type="search" placeholder="🔍 Kurs qidirish…"><select id="cat"><option value="">Barcha yo‘nalishlar</option></select></div>
    </div><div class="grid" id="list"></div></div></section>`;
  let timer;
  const load = async () => {
    try {
      const r = await api(`/api/courses?q=${encodeURIComponent($('#q').value)}&category=${encodeURIComponent($('#cat').value)}`);
      const sel = $('#cat');
      if (sel.options.length === 1) r.categories.forEach(c => sel.add(new Option(c, c)));
      $('#list').innerHTML = r.courses.map(c => courseCard(c)).join('') || '<div class="empty" style="grid-column:1/-1">Hech narsa topilmadi 😕</div>';
    } catch (e) { $('#list').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  };
  $('#q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 250); });
  $('#cat').addEventListener('change', load);
  load();
}

async function pageMy() {
  if (!me) { app.innerHTML = '<div class="container empty">Avval tizimga kiring.</div>'; return authModal('login'); }
  app.innerHTML = `<section class="block"><div class="container"><div class="head"><h2>Mening kurslarim</h2></div><div class="grid" id="list"></div></div></section>`;
  try {
    const r = await api('/api/my');
    $('#list').innerHTML = r.courses.map(c => courseCard(c, `<div class="progress"><div style="width:${c.percent}%"></div></div><div class="meta"><span>${c.done}/${c.lessonCount} dars · ${c.percent}%</span></div>`)).join('')
      || '<div class="empty" style="grid-column:1/-1">Siz hali kursga yozilmagansiz. <a href="#/courses">Kurslarni ko‘ring →</a></div>';
  } catch (e) { $('#list').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

let currentLesson = 0;
async function pageCourse(id) {
  app.innerHTML = '<div class="container empty">Yuklanmoqda…</div>';
  let data;
  try { data = await api('/api/courses/' + id); }
  catch (e) { app.innerHTML = `<div class="container empty">${esc(e.message)} <a href="#/courses">← Kurslarga qaytish</a></div>`; return; }
  const c = data.course, enrolled = data.enrolled;
  const canSee = !c.locked;
  const done = new Set(c.completed || []);
  if (currentLesson >= c.lessons.length) currentLesson = 0;
  const L = c.lessons[currentLesson];
  const pct = c.lessons.length ? Math.round(done.size * 100 / c.lessons.length) : 0;

  let lessonView = '';
  if (canSee && L) {
    const yt = youtubeId(L.videoUrl);
    lessonView = `<div class="panel">
      <h2 style="margin-top:0">${currentLesson + 1}. ${esc(L.title)}</h2>
      ${yt ? `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${yt}" allowfullscreen loading="lazy" title="Video"></iframe></div>`
        : (L.videoUrl && /^https?:\/\//.test(L.videoUrl) ? `<p><a href="${esc(L.videoUrl)}" target="_blank" rel="noopener noreferrer">▶ Videoni ochish</a></p>` : '')}
      <div class="prose">${esc(L.content)}</div>
      ${enrolled ? `<p><button class="btn ${done.has(L.id) ? 'ghost' : ''}" data-act="toggle" data-cid="${c.id}" data-lid="${L.id}">${done.has(L.id) ? '✓ Tugatilgan (bekor qilish)' : 'Darsni tugatdim ✓'}</button></p>` : '<p class="sub" style="color:var(--muted)">👀 Admin ko‘rinishi (siz kursga yozilmagansiz).</p>'}
    </div>`;
  } else {
    lessonView = `<div class="panel"><h2 style="margin-top:0">Kurs haqida</h2><p class="prose">${esc(c.description)}</p>
      <p style="color:var(--muted)">🔒 Dars videolari va materiallar kursga yozilgandan so‘ng ochiladi.</p></div>`;
  }

  const filesView = canSee && c.files.length ? `<div class="panel" style="margin-top:20px"><h3 style="margin-top:0">📎 Materiallar</h3>
    ${c.files.map(f => `<div class="file-row"><span class="grow">${esc(f.name)}</span><span class="sub" style="color:var(--muted)">${fmtSize(f.size)}</span><a class="btn sm ghost" href="/api/files/${f.id}">⬇ Yuklab olish</a></div>`).join('')}</div>` : '';

  app.innerHTML = `<div class="container">
    <div class="course-head"><a href="#/courses">← Kurslar</a>
      <div><span class="tag">${esc(c.category)}</span> <span class="tag">${esc(c.level)}</span></div>
      <h1>${esc(c.icon)} ${esc(c.title)}</h1>
      <div class="meta"><span>📚 ${c.lessonCount} dars</span><span>⏱ ${esc(c.duration || '—')}</span><span>👥 ${c.students} o‘quvchi</span><span class="price">${fmtMoney(c.price)}</span></div>
    </div>
    <div class="layout">
      <div>${lessonView}${filesView}</div>
      <aside class="panel">
        ${enrolled ? `<div class="progress"><div style="width:${pct}%"></div></div><p class="sub" style="color:var(--muted);margin:8px 0 16px">${done.size}/${c.lessons.length} dars tugatildi (${pct}%)</p>`
          : `<button class="btn" style="width:100%;margin-bottom:16px" data-act="enroll" data-cid="${c.id}">${c.price > 0 ? 'Kursga yozilish' : 'Bepul yozilish'}</button>`}
        <h3 style="margin:0 0 12px">Darslar</h3>
        ${c.lessons.map((l, i) => `<div class="lesson ${i === currentLesson ? 'active' : ''} ${done.has(l.id) ? 'done' : ''}" data-act="lesson" data-i="${i}" data-cid="${c.id}"><span class="n">${done.has(l.id) ? '✓' : i + 1}</span><span>${esc(l.title)}</span></div>`).join('') || '<div class="empty">Darslar hali qo‘shilmagan</div>'}
      </aside>
    </div></div>`;
}

/* ---------- Routing ---------- */
function route() {
  const h = location.hash.replace(/^#/, '') || '/';
  window.scrollTo(0, 0);
  let m;
  if (h === '/' ) return pageHome();
  if (h === '/courses') return pageCourses();
  if (h === '/my') return pageMy();
  if ((m = h.match(/^\/course\/([a-f0-9]+)$/))) return pageCourse(m[1]);
  app.innerHTML = '<div class="container empty">Sahifa topilmadi. <a href="#/">Bosh sahifa</a></div>';
}

/* ---------- Hodisalar (event delegation) ---------- */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (el.tagName === 'A') e.preventDefault();
  try {
    if (act === 'login') authModal('login');
    else if (act === 'register') authModal('register');
    else if (act === 'profile') profileModal();
    else if (act === 'password') passwordModal(u => { me = u; });
    else if (act === 'logout') { await api('/api/logout', { method: 'POST', body: {} }); me = null; renderNav(); location.hash = '#/'; route(); toast('Tizimdan chiqdingiz'); }
    else if (act === 'enroll') {
      if (!me) return authModal('register');
      await api(`/api/courses/${el.dataset.cid}/enroll`, { method: 'POST', body: {} });
      toast('Kursga yozildingiz 🎉'); currentLesson = 0; pageCourse(el.dataset.cid);
    }
    else if (act === 'lesson') { currentLesson = +el.dataset.i; pageCourse(el.dataset.cid); }
    else if (act === 'toggle') {
      await api(`/api/courses/${el.dataset.cid}/lessons/${el.dataset.lid}/toggle`, { method: 'POST', body: {} });
      pageCourse(el.dataset.cid);
    }
  } catch (err) { toast(err.message); }
});

window.addEventListener('hashchange', () => { currentLesson = 0; route(); });

(async function init() {
  $('#year').textContent = new Date().getFullYear();
  initTheme();
  try { me = (await api('/api/me')).user; } catch { me = null; }
  renderNav();
  route();
})();
