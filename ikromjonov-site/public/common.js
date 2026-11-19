/* Umumiy yordamchi funksiyalar (sayt va admin panel uchun) */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(path, opts = {}) {
  const o = { method: opts.method || 'GET', headers: {}, credentials: 'same-origin' };
  if (opts.body !== undefined) {
    if (opts.raw) { o.body = opts.body; Object.assign(o.headers, opts.headers || {}); }
    else { o.body = JSON.stringify(opts.body); o.headers['Content-Type'] = 'application/json'; }
  }
  let r;
  try { r = await fetch(path, o); } catch { throw new Error('Serverga ulanib bo‘lmadi'); }
  let data = {};
  try { data = await r.json(); } catch { /* json emas */ }
  if (!r.ok) throw new Error(data.error || 'Xatolik yuz berdi');
  return data;
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

function fmtMoney(n) { return n > 0 ? Number(n).toLocaleString('ru-RU') + ' so‘m' : 'Bepul'; }
function fmtSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
function fmtDate(ts) { return new Date(ts).toLocaleDateString('uz-UZ', { year: 'numeric', month: '2-digit', day: '2-digit' }); }

function youtubeId(url) {
  const m = String(url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return m ? m[1] : null;
}

function openModal(html, { wide = false, onMount } = {}) {
  const root = $('#modalRoot');
  root.innerHTML = `<div class="overlay"><div class="modal ${wide ? 'wide' : ''}">${html}</div></div>`;
  const overlay = $('.overlay', root);
  overlay.addEventListener('mousedown', e => { if (e.target === overlay) closeModal(); });
  const first = $('input, textarea, select', root); if (first) first.focus();
  if (onMount) onMount(root);
  return root;
}
function closeModal() { $('#modalRoot').innerHTML = ''; }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function initTheme() {
  const btn = $('#themeBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch { /* ignore */ }
  });
}

/* Parolni o'zgartirish oynasi (ikkala sahifada ham ishlatiladi) */
function passwordModal(onDone) {
  openModal(`
    <h2>Parolni o‘zgartirish</h2><p class="sub">Xavfsizlik uchun kuchli parol tanlang.</p>
    <form id="pwForm">
      <label>Joriy parol</label><input type="password" name="old" required autocomplete="current-password">
      <label>Yangi parol (kamida 6 belgi)</label><input type="password" name="nw" required minlength="6" autocomplete="new-password">
      <p class="err" id="pwErr"></p>
      <button class="btn" style="width:100%">Saqlash</button>
    </form>`);
  $('#pwForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    try {
      const r = await api('/api/change-password', { method: 'POST', body: { oldPassword: f.old.value, newPassword: f.nw.value } });
      closeModal(); toast('Parol o‘zgartirildi ✓'); if (onDone) onDone(r.user);
    } catch (err) { $('#pwErr').textContent = err.message; }
  });
}
