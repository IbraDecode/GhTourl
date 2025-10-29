const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const bot = new Telegraf('7756314780:AAFA_g2EcjOKCXpOu7WuhzfLCOp-9TN7l-A');

async function uploadFile(ctx, file, fileName) {
  try {
    const fileId = file.file_id;
    const fileLink = await ctx.telegram.getFileLink(fileId);
    const response = await axios.get(fileLink, { responseType: 'stream' });
    const tempPath = path.join('/tmp', fileName);
    const writer = fs.createWriteStream(tempPath);
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    const uploadUrl = `https://transfer.sh/${encodeURIComponent(fileName)}`;
    const uploadResponse = await axios.put(uploadUrl, fs.createReadStream(tempPath), {
      headers: {
        'Content-Type': 'application/octet-stream'
      }
    });
    const url = uploadResponse.data.trim();
    ctx.reply(`URL: ${url}`);
    fs.unlinkSync(tempPath);
  } catch (error) {
    console.error(error);
    ctx.reply('Error uploading file.');
  }
}

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

bot.launch();