const axios = require('axios');
const { cmd } = require("../command");

const API_KEY = 'popkid';
const BASE_URL = 'https://api.popkidapi.dev/api/downloader';

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

cmd({
  pattern: "popkidplay",
  alias: ["play", "ytplay", "video"],
  react: '🎬',
  desc: "Download and send YouTube video",
  category: "downloader",
  use: ".popkidplay <YouTube URL or search>",
  filename: __filename
}, async (conn, mek, m, { from, reply, text: q }) => {
  try {

    if (!q) return reply("🎬 Usage: .popkidplay <YouTube URL>\nExample: .popkidplay https://youtu.be/dQw4w9WgXcQ");

    // Check if it's a URL or search term
    const isUrl = q.startsWith('http://') || q.startsWith('https://');
    const videoUrl = isUrl ? q : `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

    if (!isUrl) {
      return reply("❌ Please provide a direct YouTube URL.\nExample: .popkidplay https://youtu.be/xxxxx");
    }

    await reply("⏳ Fetching video info...");

    const res = await axios.get(`${BASE_URL}/ytmp4`, {
      params: { url: videoUrl, apikey: API_KEY },
      timeout: 30000
    });

    const data = res.data;

    if (!data.status || !data.result?.download_url) {
      return reply("❌ Failed to fetch video. Make sure the URL is valid.");
    }

    const { title, duration, thumbnail, author, quality, download_url } = data.result;

    // Send info first
    await conn.sendMessage(from, {
      image: { url: thumbnail },
      caption:
        `🎬 *${title}*\n` +
        `👤 *Author:* ${author}\n` +
        `⏱ *Duration:* ${formatDuration(duration)}\n` +
        `📺 *Quality:* ${quality}\n\n` +
        `⏳ Sending video...\n\n` +
        `> *popkid*`
    }, { quoted: mek });

    // Send video
    await conn.sendMessage(from, {
      video: { url: download_url },
      mimetype: 'video/mp4',
      caption:
        `🎬 *${title}*\n` +
        `👤 *Author:* ${author}\n` +
        `⏱ *Duration:* ${formatDuration(duration)}\n` +
        `📺 *Quality:* ${quality}\n\n` +
        `> *popkid*`
    }, { quoted: mek });

  } catch (error) {
    console.error("popkidplay error:", error);
    await reply(`❌ Error: ${error.message || error}`);
  }
});
