# Telegram To URL Bot

Bot Telegram yang mengubah file menjadi URL via GitHub raw.

## Setup

1. Buat repo GitHub untuk menyimpan file.
2. Buat Personal Access Token di GitHub dengan scope `repo`.
3. Set environment variables:
   - `GITHUB_TOKEN`: Token GitHub Anda
   - `GITHUB_OWNER`: Username GitHub Anda
   - `GITHUB_REPO`: Nama repo
   - `GITHUB_BRANCH`: Branch (default: main)

## Cara Menjalankan

1. Install dependencies:
   ```
   npm install
   ```

2. Set env vars dan jalankan:
   ```
   GITHUB_TOKEN=your_token GITHUB_OWNER=your_username GITHUB_REPO=your_repo node index.js
   ```

Bot akan mendengarkan pesan dengan file (document, photo, audio, video) dan upload ke repo GitHub, lalu kirim raw URL.

## Fitur

- Mendukung document, photo, audio, video
- Upload ke GitHub dan dapatkan raw URL