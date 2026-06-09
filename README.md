# WangKu

WangKu ialah app pengurusan kewangan peribadi berbentuk PWA. Ia boleh di-host sebagai website Firebase Hosting dan boleh dipasang ke Home Screen telefon.

## Ciri Utama

- Dashboard kewangan
- Transaksi masuk/keluar
- Budget kategori
- Goals dengan bukti bayaran
- Resit & bukti transaksi: ambil gambar/upload resit, isi butiran, simpan sebagai transaksi
- Dark/light mode
- Bahasa Malay/English
- PWA Add to Home Screen
- Firebase Firestore untuk database
- Firebase Storage untuk gambar resit/bukti
- Personal Mode dengan Anonymous Auth
- Sync Account dengan Email/Password Auth

## Upload ke GitHub

Upload folder projek ini ke GitHub. Fail/folder berat dan sensitif sudah di-ignore:

- `node_modules`
- `build`
- `.env`
- `.firebase`
- `.npm-cache`
- `.tools`
- `*.zip`

Build terbaru boleh dibuat semula bila deploy, jadi `build` tidak perlu commit.

## Setup Firebase

Dalam Firebase Console:

1. Create project baru.
2. Project Settings -> Your apps -> Web app.
3. Copy Firebase config.
4. Authentication -> Sign-in method -> enable **Anonymous** dan **Email/Password**.
5. Firestore Database -> Create database.
6. Storage -> Get started.

## Environment Variables

Copy `.env.example` kepada `.env` untuk local development:

```bash
cp .env.example .env
```

Isi semua value ini:

```bash
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=...
REACT_APP_FIREBASE_STORAGE_BUCKET=...
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
REACT_APP_FIREBASE_APP_ID=...
```

Jika semua value lengkap, app akan auto aktifkan Firebase. Jika belum lengkap, app fallback ke localStorage supaya website masih boleh digunakan.

## GitHub Secrets untuk Auto Deploy

Di GitHub repo:

Settings -> Secrets and variables -> Actions -> New repository secret

Tambah secrets ini:

```text
REACT_APP_FIREBASE_API_KEY
REACT_APP_FIREBASE_AUTH_DOMAIN
REACT_APP_FIREBASE_PROJECT_ID
REACT_APP_FIREBASE_STORAGE_BUCKET
REACT_APP_FIREBASE_MESSAGING_SENDER_ID
REACT_APP_FIREBASE_APP_ID
FIREBASE_SERVICE_ACCOUNT
```

`FIREBASE_SERVICE_ACCOUNT` ialah JSON service account Firebase untuk deploy Hosting.

## Deploy

Selepas GitHub Action siap, setiap push ke branch `main` akan auto:

```bash
npm ci
npm run build
firebase deploy
```

Manual deploy juga boleh:

```bash
npm install
npm run build
firebase deploy
```

## Nota Fungsi Resit

Versi ini tidak memanggil API AI/OCR dari browser. Ini disengajakan supaya website statik lebih stabil, tidak perlukan API key rahsia di client, dan selamat untuk GitHub/Firebase Hosting.

Aliran resit sekarang:

1. Ambil gambar atau upload resit.
2. Isi merchant, jumlah, tarikh, kategori dan akaun.
3. Simpan sebagai transaksi.
4. Jika Firebase sudah aktif, gambar bukti akan disimpan ke Firebase Storage.

## Firebase Rules

Rules sudah disediakan:

- `firestore.rules`
- `storage.rules`

Setiap user hanya boleh baca/tulis data sendiri berdasarkan Firebase Auth UID.

## Personal Mode vs Sync Account

Semasa buka app, user boleh pilih:

- **Personal Mode**: data ikut device/browser tersebut sahaja.
- **Sync Account**: login/create account email password supaya data boleh dibuka semula di device lain.

## Home Screen

Selepas deploy, buka link Firebase Hosting di telefon.

iPhone:

Safari -> Share -> Add to Home Screen

Android:

Chrome -> Menu -> Add to Home Screen / Install App
