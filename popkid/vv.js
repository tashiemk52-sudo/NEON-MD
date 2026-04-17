const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { cmd } = require("../command");
const fs = require('fs');
const os = require('os');
const path = require('path');

cmd({
  pattern: "vv",
  alias: ["viewonce", "vo", "reveal"],
  react: '👁',
  desc: "Reveal view once messages",
  category: "utility",
  use: ".vv [reply to view once message]",
  filename: __filename
}, async (conn, mek, m, { from, reply, isOwner }) => {
  try {
    const ctxInfo = mek.message?.extendedTextMessage?.contextInfo;
    const quotedMsg = ctxInfo?.quotedMessage;

    if (!quotedMsg) {
      return reply("❌ Reply to a view once message with .vv");
    }

    // Detect view once type
    const viewOnceMsg =
      quotedMsg?.viewOnceMessage?.message ||
      quotedMsg?.viewOnceMessageV2?.message ||
      quotedMsg?.viewOnceMessageV2Extension?.message ||
      null;

    if (!viewOnceMsg) {
      return reply("❌ That is not a view once message.");
    }

    const mtype = Object.keys(viewOnceMsg)[0];

    const typeMap = {
      imageMessage: { mediaType: 'image', ext: '.jpg', label: 'Image' },
      videoMessage: { mediaType: 'video', ext: '.mp4', label: 'Video' },
      audioMessage: { mediaType: 'audio', ext: '.mp3', label: 'Audio' },
    };

    const matched = typeMap[mtype];
    if (!matched) return reply("❌ Unsupported view once media type.");

    await reply("⏳ Retrieving view once media...");

    // Download
    const stream = await downloadContentFromMessage(viewOnceMsg[mtype], matched.mediaType);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const mediaBuffer = Buffer.concat(chunks);

    const caption = viewOnceMsg[mtype]?.caption || '';

    // Send based on type
    if (mtype === 'imageMessage') {
      await conn.sendMessage(from, {
        image: mediaBuffer,
        caption: caption || '👁 *View Once Image*\n\n> *popkid*'
      }, { quoted: mek });

    } else if (mtype === 'videoMessage') {
      await conn.sendMessage(from, {
        video: mediaBuffer,
        caption: caption || '👁 *View Once Video*\n\n> *popkid*',
        mimetype: 'video/mp4'
      }, { quoted: mek });

    } else if (mtype === 'audioMessage') {
      await conn.sendMessage(from, {
        audio: mediaBuffer,
        mimetype: 'audio/mp4',
        ptt: viewOnceMsg[mtype]?.ptt || false
      }, { quoted: mek });
    }

  } catch (error) {
    console.error("vv error:", error);
    await reply(`❌ Error: ${error.message || error}`);
  }
});
