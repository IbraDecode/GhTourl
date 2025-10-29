require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf(process.env.TELEGRAM_TOKEN || '7756314780:AAFA_g2EcjOKCXpOu7WuhzfLCOp-9TN7l-A');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
  console.error('Missing required environment variables: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO');
  process.exit(1);
}

async function uploadFile(ctx, file, fileName) {
  try {
    ctx.reply('Uploading file...');
    const fileId = file.file_id;
    const fileLink = await ctx.telegram.getFileLink(fileId);
    const response = await axios.get(fileLink, { responseType: 'arraybuffer', timeout: 60000 });
    const fileBuffer = Buffer.from(response.data);
    const content = fileBuffer.toString('base64');
    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}-${fileName}`;
    const filePath = `files/${uniqueFileName}`;
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
    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${filePath}`;
    ctx.reply(`URL: ${rawUrl}`);
  } catch (error) {
    console.error('Upload error:', error.message);
    ctx.reply('Error uploading file. Please try again.');
  }
}

bot.start((ctx) => ctx.reply('Kirim file (document, photo, audio, video, voice, sticker) untuk dapatkan URL GitHub raw.'));

bot.on('document', async (ctx) => {
  const file = ctx.message.document;
  const fileName = file.file_name;
  await uploadFile(ctx, file, fileName);
});

bot.on('photo', async (ctx) => {
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  const fileName = 'photo.jpg';
  await uploadFile(ctx, photo, fileName);
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

bot.launch();
console.log('Bot started...');