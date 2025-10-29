require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const sharp = require('sharp');
const cron = require('node-cron');

const bot = new Telegraf(process.env.TELEGRAM_TOKEN || '7756314780:AAFA_g2EcjOKCXpOu7WuhzfLCOp-9TN7l-A');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const UPLOAD_LIMIT = 10; // per user per day
const ADMIN_ID = process.env.ADMIN_ID; // Telegram user ID for admin
const userUploads = new Map();
const db = new sqlite3.Database('./uploads.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT,
    path TEXT,
    url TEXT,
    sha TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
  console.error('Missing required environment variables: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO');
  process.exit(1);
}

async function uploadFile(ctx, file, fileName, isPhoto = false) {
  try {
    const userId = ctx.from.id;
    const today = new Date().toDateString();
    const key = `${userId}-${today}`;
    if (!userUploads.has(key)) userUploads.set(key, 0);
    if (userUploads.get(key) >= UPLOAD_LIMIT) {
      return ctx.reply('🚫 Upload limit reached. Max 10 files per day.');
    }
    if (file.file_size && file.file_size > MAX_FILE_SIZE) {
      return ctx.reply('🚫 File too large. Maximum size is 50MB.');
    }
    ctx.reply('⏳ Uploading file... Please wait.');
    console.log(`Uploading ${fileName} (${file.file_size} bytes)`);
    const fileId = file.file_id;
    const fileLink = await ctx.telegram.getFileLink(fileId);
    const response = await axios.get(fileLink, { responseType: 'arraybuffer', timeout: 60000 });
    let fileBuffer = Buffer.from(response.data);
    if (isPhoto) {
      // Compress image
      fileBuffer = await sharp(fileBuffer).jpeg({ quality: 80 }).toBuffer();
    }
    const content = fileBuffer.toString('base64');
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}-${fileName}`;
    const filePath = `files/${date}/${uniqueFileName}`;
    const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`;
    const uploadResponse = await axios.put(apiUrl, {
      message: `Upload ${fileName}`,
      content: content,
      branch: GITHUB_BRANCH
    }, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });
    const sha = uploadResponse.data.content.sha;
    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${filePath}`;
    const githubUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/blob/${GITHUB_BRANCH}/${filePath}`;
    const keyboard = {
      inline_keyboard: [
        [{ text: 'Open Raw URL', url: rawUrl }],
        [{ text: 'View on GitHub', url: githubUrl }]
      ]
    };
    ctx.reply(`✅ File uploaded successfully!\n\n📁 File: ${fileName}\n🔗 Raw URL: ${rawUrl}`, { reply_markup: keyboard });
    // Save to DB
    db.run(`INSERT INTO uploads (filename, path, url, sha) VALUES (?, ?, ?, ?)`, [fileName, filePath, rawUrl, sha]);
    userUploads.set(key, userUploads.get(key) + 1);
    console.log(`Uploaded: ${rawUrl}`);
  } catch (error) {
    console.error('Upload error:', error.message);
    if (error.response && error.response.status === 422) {
      ctx.reply('❌ Upload failed: File might be too large or repository issue. Try a smaller file.');
    } else {
      ctx.reply('❌ Error uploading file. Please try again later.');
    }
  }
}

bot.start((ctx) => ctx.reply('👋 Halo! Kirim file (document, photo, audio, video, voice, sticker) untuk dapatkan URL GitHub raw. Max 50MB.'));
bot.help((ctx) => ctx.reply('📤 Kirim file untuk upload.\n\nCommands:\n/start - Start bot\n/help - Show help\n/status - Check bot status\n/list - List recent uploads\n/delete <filename> - Delete file\n/stats - Show upload stats\n\nMax file size: 50MB'));
bot.command('status', (ctx) => ctx.reply('🤖 Bot online dan siap upload file!'));
bot.command('stats', (ctx) => {
  db.get(`SELECT COUNT(*) as total FROM uploads`, [], (err, row) => {
    if (err) return ctx.reply('❌ Error fetching stats.');
    ctx.reply(`📊 Total uploads: ${row.total}`);
  });
});
bot.command('admin', (ctx) => {
  if (ctx.from.id != ADMIN_ID) return ctx.reply('❌ Access denied.');
  db.get(`SELECT COUNT(*) as total, COUNT(DISTINCT substr(timestamp, 0, 11)) as days FROM uploads`, [], (err, row) => {
    if (err) return ctx.reply('❌ Error.');
    ctx.reply(`📊 Admin Stats:\nTotal uploads: ${row.total}\nActive days: ${row.days}`);
  });
});
bot.command('list', (ctx) => {
  db.all(`SELECT filename, url, timestamp FROM uploads ORDER BY timestamp DESC LIMIT 10`, [], (err, rows) => {
    if (err) return ctx.reply('❌ Error fetching list.');
    if (rows.length === 0) return ctx.reply('📂 No uploads yet.');
    let message = '📋 Recent uploads:\n\n';
    rows.forEach(row => {
      message += `📁 ${row.filename}\n🔗 ${row.url}\n🕒 ${row.timestamp}\n\n`;
    });
    ctx.reply(message);
  });
});
bot.command('delete', (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length === 0) return ctx.reply('❓ Usage: /delete <filename>');
  const filename = args.join(' ');
  db.get(`SELECT path, sha FROM uploads WHERE filename = ? ORDER BY timestamp DESC LIMIT 1`, [filename], async (err, row) => {
    if (err || !row) return ctx.reply('❌ File not found.');
    try {
      const deleteUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${row.path}`;
      await axios.delete(deleteUrl, {
        data: {
          message: `Delete ${filename}`,
          sha: row.sha,
          branch: GITHUB_BRANCH
        },
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      db.run(`DELETE FROM uploads WHERE path = ?`, [row.path]);
      ctx.reply(`✅ File ${filename} deleted.`);
    } catch (error) {
      ctx.reply('❌ Error deleting file.');
    }
  });
});

bot.on('document', async (ctx) => {
  const file = ctx.message.document;
  const fileName = file.file_name;
  await uploadFile(ctx, file, fileName);
});

bot.on('photo', async (ctx) => {
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  const fileName = 'photo.jpg';
  await uploadFile(ctx, photo, fileName, true);
});

bot.on('audio', async (ctx) => {
  const audio = ctx.message.audio;
  const fileName = audio.file_name || 'audio.mp3';
  await uploadFile(ctx, audio, fileName);
});

bot.on('video', async (ctx) => {
  const video = ctx.message.video;
  const fileName = video.file_name || 'video.mp4';
  await uploadFile(ctx, video, fileName);
});

bot.on('voice', async (ctx) => {
  const voice = ctx.message.voice;
  const fileName = 'voice.ogg';
  await uploadFile(ctx, voice, fileName);
});

bot.on('sticker', async (ctx) => {
  const sticker = ctx.message.sticker;
  const fileName = 'sticker.webp';
  await uploadFile(ctx, sticker, fileName);
});

// Batch upload for media groups
const batchUploads = new Map();
bot.on('message', async (ctx) => {
  if (ctx.message.media_group_id) {
    const groupId = ctx.message.media_group_id;
    if (!batchUploads.has(groupId)) {
      batchUploads.set(groupId, []);
    }
    batchUploads.get(groupId).push(ctx.message);
    // Wait 5 seconds for all messages in group
    setTimeout(async () => {
      const messages = batchUploads.get(groupId);
      if (messages) {
        batchUploads.delete(groupId);
        ctx.reply(`⏳ Uploading ${messages.length} files...`);
        for (const msg of messages) {
          // Extract file from message
          let file, fileName, isPhoto = false;
          if (msg.document) {
            file = msg.document;
            fileName = file.file_name;
          } else if (msg.photo) {
            file = msg.photo[msg.photo.length - 1];
            fileName = 'photo.jpg';
            isPhoto = true;
          } else if (msg.audio) {
            file = msg.audio;
            fileName = file.file_name || 'audio.mp3';
          } else if (msg.video) {
            file = msg.video;
            fileName = file.file_name || 'video.mp4';
          } else continue;
          await uploadFile(ctx, file, fileName, isPhoto);
        }
        ctx.reply('✅ Batch upload completed.');
      }
    }, 5000);
  }
});

// Scheduled cleanup: delete files older than 30 days
cron.schedule('0 0 * * *', () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  db.all(`SELECT path, sha FROM uploads WHERE timestamp < ?`, [thirtyDaysAgo], async (err, rows) => {
    if (err) return console.error('Cleanup error:', err);
    for (const row of rows) {
      try {
        const deleteUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${row.path}`;
        await axios.delete(deleteUrl, {
          data: {
            message: 'Auto delete old file',
            sha: row.sha,
            branch: GITHUB_BRANCH
          },
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        db.run(`DELETE FROM uploads WHERE path = ?`, [row.path]);
        console.log(`Deleted old file: ${row.path}`);
      } catch (error) {
        console.error('Error deleting old file:', error.message);
      }
    }
  });
});

bot.launch();
console.log('Bot started...');

process.once('SIGINT', () => {
  bot.stop('SIGINT');
  db.close();
});
process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  db.close();
});