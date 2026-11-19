# Ikromjonov.org — Online kurslar platformasi

Kurslar, YouTube videoli darslar, kursga yozilish, progress, qorong'i/yorug' mavzu va to'liq admin panel
(foydalanuvchilar ro'yxati, kurslar, Word/Excel/PDF yuklash, adminlar, Excel eksport).
Ma'lumotlar **MongoDB Atlas** (bepul) da saqlanadi — server qayta ishga tushsa ham yo'qolmaydi.

## EGA (OWNER) HISOBI
- Admin panel: `https://SAYT_MANZILI/admin`
- Login: `ikromjonov`
- Parol: Render'da `OWNER_PASSWORD` ga yozgan parolingiz. Yozmagan bo'lsangiz: `jxb3qrXaGkYLLf`
- Kirgach birinchi ishingiz: chap pastdagi «🔑 Parol» bilan parolni o'zgartiring.

## FAYLLAR TUZILMASI (muhim!)
```
ikromjonov-site/
  server.js
  package.json
  README.md
  .gitignore
  public/
    index.html  admin.html  app.js  admin.js  common.js  theme.js  style.css
```

---

## 1-BOSQICH. MongoDB Atlas (ma'lumotlar bazasi)
1. https://www.mongodb.com/atlas ga kiring → **Try Free** → ro'yxatdan o'ting (Google bilan ham bo'ladi).
2. Klaster yaratishda **M0 (Free)** ni tanlang. Provayder: AWS, joylashuv: Frankfurt (yoki sizga yaqin). **Create**.
3. **Database Access** → **Add New Database User**: nom `sayt`, parol — **faqat harf va raqamdan** iborat (maxsus belgilarsiz), uni yozib qo'ying. **Read and write to any database** ruxsatini bering.
4. **Network Access** → **Add IP Address** → **Allow Access From Anywhere** (`0.0.0.0/0`) → **Confirm**.
5. **Database** (Clusters) → **Connect** → **Drivers** → ulanish manzilini nusxalang. U shunday ko'rinadi:
   `mongodb+srv://sayt:<db_password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority`
   `<db_password>` o'rniga 3-qadamdagi parolni yozing. Manzilni **hech kimga yubormang**, u faqat Render'ga kiritiladi.

## 2-BOSQICH. GitHub'ga yuklash
1. https://github.com da ro'yxatdan o'ting → o'ng yuqorida **+ → New repository**.
2. Nomi: `ikromjonov-site`, **Private** → **Create repository**.
3. **uploading an existing file** → `server.js`, `package.json`, `README.md` fayllari va **`public` papkasini** sudrab tashlang.
4. **Commit changes**. Repozitoriyda `public` ichida 7 ta fayl borligini tekshiring.

## 3-BOSQICH. Render'da ishga tushirish
1. https://render.com ga **GitHub bilan** kiring → **New + → Web Service** → `ikromjonov-site` ni tanlang.
2. Sozlamalar:
   - **Runtime:** Node
   - **Build Command:** `npm install`   ← (muhim, MongoDB paketi shu bilan o'rnatiladi)
   - **Start Command:** `node server.js`
   - **Instance Type:** Free
3. **Environment Variables** → quyidagilarni qo'shing:
   | Nomi | Qiymati |
   |---|---|
   | `MONGODB_URI` | 1-bosqichdagi to'liq manzil |
   | `OWNER_PASSWORD` | o'zingiz o'ylab topgan kuchli parol |
4. **Create Web Service** → 3–5 daqiqa kuting → **Live** yozuvi chiqsa, `https://nom.onrender.com` ochiladi.
5. **Logs** bo'limida `Saqlash joyi: MongoDB Atlas` yozuvi chiqishi kerak. Chiqmasa, `MONGODB_URI` ni tekshiring.

## 4-BOSQICH. Tekshirish
1. `https://nom.onrender.com/admin` → login `ikromjonov`, parolingiz bilan kiring.
2. Saytda ro'yxatdan o'tib ko'ring, so'ng Render'da **Manual Deploy → Deploy latest commit** qiling. Foydalanuvchi o'chmagan bo'lsa — hammasi to'g'ri.

## 5-BOSQICH. Domen (Ikromjonov.org)
`.org` domen bepul emas (yiliga taxminan 10–15 dollar). Sotib olgach:
1. Registratorda (Namecheap, Cloudflare va h.k.) `ikromjonov.org` ni oling.
2. Render → Web Service → **Settings → Custom Domains → Add** → `ikromjonov.org` va `www.ikromjonov.org`.
3. Render ko'rsatgan DNS yozuvlarini registrator panelida kiriting (`www` uchun CNAME → `nom.onrender.com`, asosiy domen uchun Render ko'rsatgan A yoki ALIAS yozuvi).
4. 10 daqiqadan bir necha soatgacha kuting. HTTPS sertifikatini Render o'zi beradi.

---

## Bilish kerak bo'lgan cheklovlar
- **Fayllar:** Word/Excel/PDF fayllar ham MongoDB'da saqlanadi, har biri **8 MB gacha**. Bepul bazada jami joy **512 MB**, shuning uchun og'ir fayllar o'rniga darsda havola ishlating.
- **Bepul Render uxlaydi:** 15 daqiqa hech kim kirmasa to'xtaydi, keyingi ochilish 30–60 soniya oladi. Ma'lumotlar baribir saqlanib qoladi.
- **Zaxira nusxa yo'q:** bepul Atlas avtomatik zaxira qilmaydi. Admin paneldagi «Excel (CSV) eksport» bilan foydalanuvchilarni vaqti-vaqti bilan yuklab oling.

## Kompyuterda sinash (ixtiyoriy, Node.js kerak)
`MONGODB_URI` bo'lmasa, sayt ma'lumotlarni `data/` papkasida saqlaydi:
```
node server.js
```
Keyin http://localhost:3000 va http://localhost:3000/admin ni oching.
