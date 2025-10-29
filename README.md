# Telegram To URL Bot

Bot Telegram yang mengubah file menjadi URL via GitHub raw.

## Setup

1. Buat repo GitHub untuk menyimpan file.
2. Buat Personal Access Token di GitHub dengan scope `repo`.
3. Copy `.env.example` ke `.env` dan isi dengan data Anda:
   - `TELEGRAM_TOKEN`: Token bot Telegram
   - `GITHUB_TOKEN`: Token GitHub
   - `GITHUB_OWNER`: Username GitHub
   - `GITHUB_REPO`: Nama repo
   - `GITHUB_BRANCH`: Branch (default: main)

## Cara Menjalankan

1. Install dependencies:
   ```
   npm install
   ```

2. Jalankan:
   ```
   node index.js
   ```

Bot akan mendengarkan pesan dengan file dan upload ke repo GitHub, lalu kirim raw URL.

## Fitur

- Mendukung document, photo, audio, video, voice, sticker
- Nama file unik dengan timestamp untuk hindari overwrite
- Organize file dalam folder berdasarkan tanggal (files/YYYY-MM-DD/)
- Batas ukuran file 50MB (karena limit GitHub)
- Database SQLite untuk track uploads
- Pesan status saat upload dengan emoji
- Error handling dan logging yang detail
- Timeout 60 detik untuk download/upload
- Command /start, /help, /status, /list, /delete, /stats
- Inline keyboard dengan button "Open Raw URL" dan "View on GitHub"
- Pesan interaktif dan user-friendly