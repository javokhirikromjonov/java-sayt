'use strict';
/*
 * Ikromjonov.org — online kurslar platformasi
 * Backend: Node.js (faqat o'rnatilgan modullar, hech qanday npm paket kerak emas)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UP_DIR = path.join(DATA_DIR, 'uploads');
const PUB = path.join(__dirname, 'public');
const MAX_UPLOAD = 8 * 1024 * 1024; // 8 MB (MongoDB hujjat chegarasi 16 MB)
const MONGODB_URI = process.env.MONGODB_URI || '';
const SESSION_DAYS = 30;
const ALLOWED_EXT = ['doc', 'docx', 'xls', 'xlsx', 'csv', 'pdf', 'ppt', 'pptx', 'txt', 'zip'];

// Egasi (owner) hisobi. Muhit o'zgaruvchilari bilan o'zgartirish mumkin.
const OWNER_LOGIN = (process.env.OWNER_LOGIN || 'ikromjonov').toLowerCase();
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'jxb3qrXaGkYLLf';

/* ---------------- Ma'lumotlarni saqlash ----------------
 * MONGODB_URI berilsa — MongoDB Atlas (doimiy, bepul tarif bor).
 * Berilmasa — kompyuteringizdagi data/ papkasi (lokal sinov uchun).
 */
function fileStore() {
  fs.mkdirSync(UP_DIR, { recursive: true });
  const DB_FILE = path.join(DATA_DIR, 'db.json');
  return {
    name: 'lokal fayl (data/ papkasi)',
    async init() {},
    async load() { return fs.existsSync(DB_FILE) ? fs.readFileSync(DB_FILE, 'utf8') : null; },
    async saveDb(json) { const t = DB_FILE + '.tmp'; fs.writeFileSync(t, json); fs.renameSync(t, DB_FILE); },
    async putFile(id, buf) { fs.writeFileSync(path.join(UP_DIR, id), buf); },
    async getFile(id) { try { return fs.readFileSync(path.join(UP_DIR, id)); } catch { return null; } },
    async delFile(id) { fs.unlink(path.join(UP_DIR, id), () => {}); }
  };
}
function mongoStore() {
  let mongo;
  try { mongo = require('mongodb'); }
  catch { console.error('"mongodb" paketi o‘rnatilmagan. Render’da Build Command: npm install bo‘lishi kerak.'); process.exit(1); }
  let client, meta, files;
  return {
    name: 'MongoDB Atlas',
    async init() {
      client = new mongo.MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
      await client.connect();
      const d = client.db(process.env.MONGODB_DB || 'ikromjonov');
      meta = d.collection('meta'); files = d.collection('files');
    },
    async load() { const r = await meta.findOne({ _id: 'main' }); return r ? r.json : null; },
    async saveDb(json) { await meta.replaceOne({ _id: 'main' }, { _id: 'main', json }, { upsert: true }); },
    async putFile(id, buf) { await files.replaceOne({ _id: id }, { _id: id, data: new mongo.Binary(buf) }, { upsert: true }); },
    async getFile(id) { const r = await files.findOne({ _id: id }); return r ? Buffer.from(r.data.buffer) : null; },
    async delFile(id) { await files.deleteOne({ _id: id }); }
  };
}
const store = MONGODB_URI ? mongoStore() : fileStore();

let db = { users: [], sessions: {}, courses: [], enrollments: [] };
let saveTimer = null, saving = Promise.resolve();
function flushNow() {
  const snapshot = JSON.stringify(db);
  saving = saving.then(() => store.saveDb(snapshot)).catch(e => console.error('Saqlashda xato:', e.message));
  return saving;
}
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; flushNow(); }, 150);
}
async function shutdown() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; flushNow(); }
  await saving; process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

const uid = () => crypto.randomBytes(8).toString('hex');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function hashPassword(pw) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(pw, salt, 64, (err, key) => err ? reject(err) : resolve(salt + ':' + key.toString('hex')));
  });
}
function verifyPassword(pw, stored) {
  return new Promise((resolve) => {
    const [salt, hash] = String(stored).split(':');
    if (!salt || !hash) return resolve(false);
    crypto.scrypt(pw, salt, 64, (err, key) => {
      if (err) return resolve(false);
      const a = Buffer.from(hash, 'hex');
      resolve(a.length === key.length && crypto.timingSafeEqual(a, key));
    });
  });
}

/* ---------------- Dastlabki ma'lumotlar ---------------- */
async function seed() {
  await store.init();
  const raw = await store.load();
  if (raw) { try { db = Object.assign(db, JSON.parse(raw)); } catch (e) { console.error('Baza o‘qilmadi:', e.message); process.exit(1); } }
  console.log('Saqlash joyi:', store.name);
  if (!db.users.some(u => u.role === 'owner')) {
    db.users.push({
      id: uid(), name: 'Ikromjonov (Ega)', login: OWNER_LOGIN, phone: '',
      pass: await hashPassword(OWNER_PASSWORD), role: 'owner',
      mustChange: !process.env.OWNER_PASSWORD, createdAt: Date.now()
    });
    console.log('Ega hisobi yaratildi. Login:', OWNER_LOGIN);
  }
  if (db.courses.length === 0) {
    const mk = (title, category, level, duration, price, icon, description, lessons) => ({
      id: uid(), title, category, level, duration, price, icon, description, published: true,
      createdAt: Date.now(), files: [],
      lessons: lessons.map(l => ({ id: uid(), title: l[0], videoUrl: l[1] || '', content: l[2] || '' }))
    });
    db.courses.push(
      mk('Veb dasturlash asoslari', 'Dasturlash', 'Boshlang‘ich', '6 hafta', 0, '💻',
        'HTML, CSS va JavaScript bilan noldan o‘z saytingizni yarating. Amaliy loyihalar bilan.',
        [['HTML bilan tanishuv', '', 'HTML — veb sahifalarning skeleti. Teglar, atributlar va hujjat tuzilmasi.'],
         ['CSS bilan bezash', '', 'Ranglar, shriftlar, flexbox va grid yordamida chiroyli dizayn yaratamiz.'],
         ['JavaScript asoslari', '', 'O‘zgaruvchilar, funksiyalar, hodisalar va DOM bilan ishlash.']]),
      mk('Ingliz tili: A1 dan B1 gacha', 'Tillar', 'Boshlang‘ich', '12 hafta', 150000, '🌍',
        'Kundalik muloqot, grammatika va lug‘at boyligini bosqichma-bosqich oshiring.',
        [['Salomlashish va tanishuv', '', 'Asosiy iboralar va o‘zingizni tanishtirish.'],
         ['Present Simple', '', 'Hozirgi oddiy zamon: qoidalar va mashqlar.']]),
      mk('Excel: nol dan professionalgacha', 'Ofis dasturlari', 'O‘rta', '4 hafta', 90000, '📊',
        'Formulalar, jadvallar, diagrammalar va pivot jadvallar bilan ishlashni o‘rganing.',
        [['Interfeys va asosiy funksiyalar', '', 'SUM, AVERAGE, IF kabi funksiyalar.'],
         ['Pivot jadvallar', '', 'Katta ma’lumotlarni tez tahlil qilish.']])
    );
  }
  save();
}

/* ---------------- Yordamchi funksiyalar ---------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8'
};
const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-src https://www.youtube-nocookie.com https://www.youtube.com; base-uri 'self'; form-action 'self'"
};

function send(res, code, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, SEC_HEADERS, headers));
  res.end(isObj ? JSON.stringify(body) : body);
}
const fail = (res, code, msg) => send(res, code, { error: msg });

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('Hajm juda katta'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req) {
  const buf = await readBody(req, 200 * 1024);
  if (!buf.length) return {};
  try { return JSON.parse(buf.toString('utf8')); }
  catch { throw Object.assign(new Error('Noto‘g‘ri JSON'), { status: 400 }); }
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function currentUser(req) {
  const tok = parseCookies(req).sid;
  if (!tok) return null;
  const s = db.sessions[sha(tok)];
  if (!s || s.exp < Date.now()) return null;
  return db.users.find(u => u.id === s.userId) || null;
}
function isHttps(req) { return req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted; }
function setSession(req, res, userId) {
  const tok = crypto.randomBytes(32).toString('hex');
  db.sessions[sha(tok)] = { userId, exp: Date.now() + SESSION_DAYS * 864e5 };
  save();
  return `sid=${tok}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${isHttps(req) ? '; Secure' : ''}`;
}
function publicUser(u) {
  return { id: u.id, name: u.name, login: u.login, phone: u.phone, role: u.role, mustChange: !!u.mustChange, createdAt: u.createdAt };
}
const isStaff = (u) => u && (u.role === 'admin' || u.role === 'owner');
const clip = (s, n) => String(s == null ? '' : s).trim().slice(0, n);

// Login urinishlarini cheklash
const attempts = new Map();
function clientIp(req) { return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(); }
function tooMany(ip) {
  const now = Date.now();
  const a = (attempts.get(ip) || []).filter(t => now - t < 15 * 60 * 1000);
  attempts.set(ip, a);
  return a.length >= 10;
}
function noteAttempt(ip) { const a = attempts.get(ip) || []; a.push(Date.now()); attempts.set(ip, a); }
setInterval(() => {
  const now = Date.now();
  for (const [ip, a] of attempts) { const f = a.filter(t => now - t < 15 * 60 * 1000); f.length ? attempts.set(ip, f) : attempts.delete(ip); }
  for (const k of Object.keys(db.sessions)) if (db.sessions[k].exp < now) delete db.sessions[k];
}, 10 * 60 * 1000).unref();

function validPassword(p) { return typeof p === 'string' && p.length >= 6 && p.length <= 100; }

function courseSummary(c) {
  return { id: c.id, title: c.title, description: c.description, category: c.category, level: c.level,
    duration: c.duration, price: c.price, icon: c.icon, published: c.published, lessonCount: c.lessons.length,
    students: db.enrollments.filter(e => e.courseId === c.id).length };
}
function courseFull(c, canSee, progress) {
  const out = courseSummary(c);
  out.lessons = c.lessons.map(l => canSee
    ? { id: l.id, title: l.title, videoUrl: l.videoUrl, content: l.content }
    : { id: l.id, title: l.title });
  out.files = canSee ? c.files.map(f => ({ id: f.id, name: f.name, size: f.size })) : [];
  out.locked = !canSee;
  if (progress) out.completed = progress.completed;
  return out;
}
function csvCell(v) {
  let s = String(v == null ? '' : v);
  if (/^[=@\t\r]/.test(s) || /^[+\-](?![\d\s()+-]*$)/.test(s)) s = "'" + s; // Excel formula injection himoyasi
  return '"' + s.replace(/"/g, '""') + '"';
}

/* ---------------- API ---------------- */
async function api(req, res, url) {
  const m = req.method;
  const p = url.pathname;
  let mt;

  /* ---- Ommaviy ---- */
  if (m === 'GET' && p === '/api/me') {
    const u = currentUser(req);
    return send(res, 200, { user: u ? publicUser(u) : null });
  }

  if (m === 'POST' && p === '/api/register') {
    const ip = clientIp(req);
    if (tooMany(ip)) return fail(res, 429, 'Juda ko‘p urinish. 15 daqiqadan so‘ng qayta urining.');
    noteAttempt(ip);
    const b = await readJson(req);
    const name = clip(b.name, 80), login = clip(b.login, 80).toLowerCase(), phone = clip(b.phone, 30);
    if (name.length < 2) return fail(res, 400, 'Ismingizni kiriting');
    if (!/^[a-z0-9._@+-]{3,80}$/.test(login)) return fail(res, 400, 'Login 3–80 belgi: lotin harflari, raqamlar va . _ @ - +');
    if (!validPassword(b.password)) return fail(res, 400, 'Parol kamida 6 belgidan iborat bo‘lsin');
    if (db.users.some(u => u.login === login)) return fail(res, 409, 'Bu login band');
    const user = { id: uid(), name, login, phone, pass: await hashPassword(b.password), role: 'student', mustChange: false, createdAt: Date.now() };
    db.users.push(user);
    const cookie = setSession(req, res, user.id);
    save();
    return send(res, 201, { user: publicUser(user) }, { 'Set-Cookie': cookie });
  }

  if (m === 'POST' && p === '/api/login') {
    const ip = clientIp(req);
    if (tooMany(ip)) return fail(res, 429, 'Juda ko‘p urinish. 15 daqiqadan so‘ng qayta urining.');
    const b = await readJson(req);
    const login = clip(b.login, 80).toLowerCase();
    const user = db.users.find(u => u.login === login);
    const ok = user && await verifyPassword(String(b.password || ''), user.pass);
    if (!ok) { noteAttempt(ip); return fail(res, 401, 'Login yoki parol noto‘g‘ri'); }
    const cookie = setSession(req, res, user.id);
    return send(res, 200, { user: publicUser(user) }, { 'Set-Cookie': cookie });
  }

  if (m === 'POST' && p === '/api/logout') {
    const tok = parseCookies(req).sid;
    if (tok) { delete db.sessions[sha(tok)]; save(); }
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' });
  }

  if (m === 'GET' && p === '/api/courses') {
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const cat = url.searchParams.get('category') || '';
    let list = db.courses.filter(c => c.published);
    if (q) list = list.filter(c => (c.title + ' ' + c.description + ' ' + c.category).toLowerCase().includes(q));
    if (cat) list = list.filter(c => c.category === cat);
    const cats = [...new Set(db.courses.filter(c => c.published).map(c => c.category).filter(Boolean))];
    return send(res, 200, { courses: list.map(courseSummary), categories: cats });
  }

  if (m === 'GET' && (mt = p.match(/^\/api\/courses\/([a-f0-9]+)$/))) {
    const c = db.courses.find(x => x.id === mt[1]);
    const u = currentUser(req);
    if (!c || (!c.published && !isStaff(u))) return fail(res, 404, 'Kurs topilmadi');
    const enr = u && db.enrollments.find(e => e.userId === u.id && e.courseId === c.id);
    return send(res, 200, { course: courseFull(c, !!enr || isStaff(u), enr), enrolled: !!enr });
  }

  /* ---- Tizimga kirganlar ---- */
  const user = currentUser(req);
  if (!user) return fail(res, 401, 'Avval tizimga kiring');

  if (m === 'POST' && p === '/api/change-password') {
    const b = await readJson(req);
    if (!(await verifyPassword(String(b.oldPassword || ''), user.pass))) return fail(res, 400, 'Joriy parol noto‘g‘ri');
    if (!validPassword(b.newPassword)) return fail(res, 400, 'Yangi parol kamida 6 belgidan iborat bo‘lsin');
    user.pass = await hashPassword(b.newPassword);
    user.mustChange = false;
    save();
    return send(res, 200, { ok: true, user: publicUser(user) });
  }

  if (m === 'POST' && p === '/api/profile') {
    const b = await readJson(req);
    const name = clip(b.name, 80);
    if (name.length < 2) return fail(res, 400, 'Ismingizni kiriting');
    user.name = name; user.phone = clip(b.phone, 30);
    save();
    return send(res, 200, { user: publicUser(user) });
  }

  if (m === 'GET' && p === '/api/my') {
    const list = db.enrollments.filter(e => e.userId === user.id).map(e => {
      const c = db.courses.find(x => x.id === e.courseId);
      if (!c) return null;
      const done = e.completed.filter(id => c.lessons.some(l => l.id === id)).length;
      return Object.assign(courseSummary(c), { done, percent: c.lessons.length ? Math.round(done * 100 / c.lessons.length) : 0 });
    }).filter(Boolean);
    return send(res, 200, { courses: list });
  }

  if (m === 'POST' && (mt = p.match(/^\/api\/courses\/([a-f0-9]+)\/enroll$/))) {
    const c = db.courses.find(x => x.id === mt[1] && x.published);
    if (!c) return fail(res, 404, 'Kurs topilmadi');
    if (!db.enrollments.some(e => e.userId === user.id && e.courseId === c.id)) {
      db.enrollments.push({ userId: user.id, courseId: c.id, completed: [], at: Date.now() });
      save();
    }
    return send(res, 200, { ok: true });
  }

  if (m === 'POST' && (mt = p.match(/^\/api\/courses\/([a-f0-9]+)\/lessons\/([a-f0-9]+)\/toggle$/))) {
    const e = db.enrollments.find(x => x.userId === user.id && x.courseId === mt[1]);
    if (!e) return fail(res, 403, 'Avval kursga yoziling');
    const c = db.courses.find(x => x.id === mt[1]);
    if (!c || !c.lessons.some(l => l.id === mt[2])) return fail(res, 404, 'Dars topilmadi');
    const i = e.completed.indexOf(mt[2]);
    if (i >= 0) e.completed.splice(i, 1); else e.completed.push(mt[2]);
    save();
    return send(res, 200, { completed: e.completed });
  }

  if (m === 'GET' && (mt = p.match(/^\/api\/files\/([a-f0-9]+)$/))) {
    let file = null, course = null;
    for (const c of db.courses) { const f = c.files.find(x => x.id === mt[1]); if (f) { file = f; course = c; break; } }
    if (!file) return fail(res, 404, 'Fayl topilmadi');
    if (!isStaff(user) && !db.enrollments.some(e => e.userId === user.id && e.courseId === course.id)) return fail(res, 403, 'Avval kursga yoziling');
    const data = await store.getFile(file.stored);
    if (!data) return fail(res, 404, 'Fayl serverda yo‘q');
    res.writeHead(200, Object.assign({
      'Content-Type': 'application/octet-stream', 'Content-Length': data.length,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`
    }, SEC_HEADERS));
    return res.end(data);
  }

  /* ---- Admin (admin va ega) ---- */
  if (p.startsWith('/api/admin/') || p.startsWith('/api/owner/')) {
    if (!isStaff(user)) return fail(res, 403, 'Ruxsat yo‘q');
    const ownerOnly = p.startsWith('/api/owner/');
    if (ownerOnly && user.role !== 'owner') return fail(res, 403, 'Faqat ega uchun');

    if (m === 'GET' && p === '/api/admin/stats') {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
        const from = d.getTime(), to = from + 864e5;
        days.push({ date: String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), count: db.users.filter(u => u.createdAt >= from && u.createdAt < to).length });
      }
      const top = db.courses.map(c => ({ title: c.title, students: db.enrollments.filter(e => e.courseId === c.id).length }))
        .sort((a, b) => b.students - a.students).slice(0, 5);
      return send(res, 200, {
        users: db.users.filter(u => u.role === 'student').length,
        admins: db.users.filter(u => u.role !== 'student').length,
        courses: db.courses.length, enrollments: db.enrollments.length,
        files: db.courses.reduce((n, c) => n + c.files.length, 0), days, top
      });
    }

    if (m === 'GET' && p === '/api/admin/users') {
      const q = (url.searchParams.get('q') || '').toLowerCase();
      let list = db.users.filter(u => u.role === 'student');
      if (q) list = list.filter(u => (u.name + ' ' + u.login + ' ' + u.phone).toLowerCase().includes(q));
      list = list.sort((a, b) => b.createdAt - a.createdAt).map(u =>
        Object.assign(publicUser(u), { courses: db.enrollments.filter(e => e.userId === u.id).length }));
      return send(res, 200, { users: list });
    }

    if (m === 'GET' && p === '/api/admin/users.csv') {
      const rows = [['№', 'Ism', 'Login', 'Telefon', 'Rol', 'Kurslar soni', 'Ro‘yxatdan o‘tgan sana']];
      db.users.slice().sort((a, b) => a.createdAt - b.createdAt).forEach((u, i) => rows.push([
        i + 1, u.name, u.login, u.phone, u.role, db.enrollments.filter(e => e.userId === u.id).length,
        new Date(u.createdAt).toISOString().slice(0, 16).replace('T', ' ')]));
      const csv = '﻿' + rows.map(r => r.map(csvCell).join(';')).join('\r\n');
      return send(res, 200, csv, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="foydalanuvchilar.csv"' });
    }

    if (m === 'DELETE' && (mt = p.match(/^\/api\/admin\/users\/([a-f0-9]+)$/))) {
      const t = db.users.find(u => u.id === mt[1]);
      if (!t || t.role !== 'student') return fail(res, 404, 'Foydalanuvchi topilmadi');
      db.users = db.users.filter(u => u.id !== t.id);
      db.enrollments = db.enrollments.filter(e => e.userId !== t.id);
      for (const k of Object.keys(db.sessions)) if (db.sessions[k].userId === t.id) delete db.sessions[k];
      save();
      return send(res, 200, { ok: true });
    }

    if (m === 'POST' && (mt = p.match(/^\/api\/admin\/users\/([a-f0-9]+)\/reset-password$/))) {
      const t = db.users.find(u => u.id === mt[1]);
      if (!t || t.role !== 'student') return fail(res, 404, 'Foydalanuvchi topilmadi');
      const b = await readJson(req);
      if (!validPassword(b.password)) return fail(res, 400, 'Parol kamida 6 belgidan iborat bo‘lsin');
      t.pass = await hashPassword(b.password);
      for (const k of Object.keys(db.sessions)) if (db.sessions[k].userId === t.id) delete db.sessions[k];
      save();
      return send(res, 200, { ok: true });
    }

    /* Kurslar */
    if (m === 'GET' && p === '/api/admin/courses') {
      return send(res, 200, { courses: db.courses.map(c => Object.assign(courseSummary(c), { fileCount: c.files.length })) });
    }
    if (m === 'GET' && (mt = p.match(/^\/api\/admin\/courses\/([a-f0-9]+)$/))) {
      const c = db.courses.find(x => x.id === mt[1]);
      if (!c) return fail(res, 404, 'Kurs topilmadi');
      return send(res, 200, { course: courseFull(c, true) });
    }
    if ((m === 'POST' && p === '/api/admin/courses') || (m === 'PUT' && (mt = p.match(/^\/api\/admin\/courses\/([a-f0-9]+)$/)))) {
      const b = await readJson(req);
      const title = clip(b.title, 120);
      if (title.length < 3) return fail(res, 400, 'Kurs nomi kamida 3 belgi bo‘lsin');
      const price = Math.max(0, Math.min(1e9, parseInt(b.price, 10) || 0));
      const lessons = (Array.isArray(b.lessons) ? b.lessons : []).slice(0, 200).map(l => ({
        id: /^[a-f0-9]{16}$/.test(l.id || '') ? l.id : uid(),
        title: clip(l.title, 150) || 'Nomsiz dars', videoUrl: clip(l.videoUrl, 300), content: clip(l.content, 20000)
      }));
      const fields = {
        title, description: clip(b.description, 2000), category: clip(b.category, 40) || 'Boshqa',
        level: clip(b.level, 30), duration: clip(b.duration, 30), price, icon: clip(b.icon, 4) || '📘',
        published: !!b.published, lessons
      };
      if (m === 'POST') {
        const c = Object.assign({ id: uid(), createdAt: Date.now(), files: [] }, fields);
        db.courses.push(c); save();
        return send(res, 201, { course: courseFull(c, true) });
      }
      const c = db.courses.find(x => x.id === mt[1]);
      if (!c) return fail(res, 404, 'Kurs topilmadi');
      Object.assign(c, fields); save();
      return send(res, 200, { course: courseFull(c, true) });
    }
    if (m === 'DELETE' && (mt = p.match(/^\/api\/admin\/courses\/([a-f0-9]+)$/))) {
      const c = db.courses.find(x => x.id === mt[1]);
      if (!c) return fail(res, 404, 'Kurs topilmadi');
      c.files.forEach(f => store.delFile(f.stored));
      db.courses = db.courses.filter(x => x.id !== c.id);
      db.enrollments = db.enrollments.filter(e => e.courseId !== c.id);
      save();
      return send(res, 200, { ok: true });
    }

    /* Word/Excel/PDF fayl yuklash (xom oqim, x-filename sarlavhasi bilan) */
    if (m === 'POST' && (mt = p.match(/^\/api\/admin\/courses\/([a-f0-9]+)\/files$/))) {
      const c = db.courses.find(x => x.id === mt[1]);
      if (!c) return fail(res, 404, 'Kurs topilmadi');
      let name = '';
      try { name = decodeURIComponent(req.headers['x-filename'] || ''); } catch { name = ''; }
      name = path.basename(name).replace(/[^\w.\-() Ѐ-ӿ]/g, '_').slice(0, 120);
      const ext = (name.split('.').pop() || '').toLowerCase();
      if (!name || !ALLOWED_EXT.includes(ext)) return fail(res, 400, 'Ruxsat etilgan formatlar: ' + ALLOWED_EXT.join(', '));
      const len = parseInt(req.headers['content-length'] || '0', 10);
      if (len > MAX_UPLOAD) return fail(res, 413, 'Fayl 8 MB dan oshmasin');
      const buf = await readBody(req, MAX_UPLOAD);
      if (!buf.length) return fail(res, 400, 'Fayl bo‘sh');
      const stored = uid() + '.' + ext;
      await store.putFile(stored, buf);
      const f = { id: uid(), name, stored, size: buf.length, at: Date.now() };
      c.files.push(f); save();
      return send(res, 201, { file: { id: f.id, name: f.name, size: f.size } });
    }
    if (m === 'DELETE' && (mt = p.match(/^\/api\/admin\/courses\/([a-f0-9]+)\/files\/([a-f0-9]+)$/))) {
      const c = db.courses.find(x => x.id === mt[1]);
      const f = c && c.files.find(x => x.id === mt[2]);
      if (!f) return fail(res, 404, 'Fayl topilmadi');
      store.delFile(f.stored);
      c.files = c.files.filter(x => x.id !== f.id); save();
      return send(res, 200, { ok: true });
    }

    /* Adminlarni boshqarish (faqat ega) */
    if (m === 'GET' && p === '/api/owner/admins') {
      return send(res, 200, { admins: db.users.filter(u => u.role !== 'student').map(publicUser) });
    }
    if (m === 'POST' && p === '/api/owner/admins') {
      const b = await readJson(req);
      const name = clip(b.name, 80), login = clip(b.login, 80).toLowerCase();
      if (name.length < 2) return fail(res, 400, 'Ismni kiriting');
      if (!/^[a-z0-9._@+-]{3,80}$/.test(login)) return fail(res, 400, 'Login noto‘g‘ri');
      if (!validPassword(b.password)) return fail(res, 400, 'Parol kamida 6 belgidan iborat bo‘lsin');
      const existing = db.users.find(u => u.login === login);
      if (existing) {
        if (existing.role !== 'student') return fail(res, 409, 'Bu login allaqachon admin');
        existing.role = 'admin'; save();
        return send(res, 200, { admin: publicUser(existing), promoted: true });
      }
      const a = { id: uid(), name, login, phone: clip(b.phone, 30), pass: await hashPassword(b.password), role: 'admin', mustChange: false, createdAt: Date.now() };
      db.users.push(a); save();
      return send(res, 201, { admin: publicUser(a) });
    }
    if (m === 'DELETE' && (mt = p.match(/^\/api\/owner\/admins\/([a-f0-9]+)$/))) {
      const t = db.users.find(u => u.id === mt[1]);
      if (!t || t.role !== 'admin') return fail(res, 404, 'Admin topilmadi (egani o‘chirib bo‘lmaydi)');
      t.role = 'student'; // foydalanuvchi sifatida qoladi, admin huquqi olinadi
      save();
      return send(res, 200, { ok: true });
    }
  }

  return fail(res, 404, 'Topilmadi');
}

/* ---------------- Statik fayllar ---------------- */
function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  if (p === '/admin') p = '/admin.html';
  const fp = path.normalize(path.join(PUB, p));
  if (!fp.startsWith(PUB + path.sep) && fp !== PUB) return send(res, 403, 'Taqiqlangan', { 'Content-Type': 'text/plain' });
  fs.stat(fp, (err, st) => {
    if (err || !st.isFile()) {
      return fs.readFile(path.join(PUB, 'index.html'), (e, data) =>
        e ? send(res, 404, 'Topilmadi', { 'Content-Type': 'text/plain' }) : send(res, 404, data, { 'Content-Type': MIME['.html'] }));
    }
    const ext = path.extname(fp).toLowerCase();
    res.writeHead(200, Object.assign({
      'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    }, SEC_HEADERS));
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(fp).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      // CSRF himoyasi: o'zgartiruvchi so'rovlar faqat shu saytdan
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host) return fail(res, 403, 'Boshqa manbadan so‘rov rad etildi');
      }
      return await api(req, res, url);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'Ruxsat etilmagan metod');
    serveStatic(req, res, url);
  } catch (e) {
    if (!res.headersSent) fail(res, e.status || 500, e.status ? e.message : 'Server xatosi');
    if (!e.status) console.error(e);
  }
});

seed().then(() => server.listen(PORT, () => console.log(`Server ishga tushdi: http://localhost:${PORT}`)))
  .catch(e => { console.error('Ishga tushmadi:', e.message); process.exit(1); });
