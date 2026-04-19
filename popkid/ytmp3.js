const { cmd } = require('../command');
const config = require('../config');
const axios = require('axios');

const ZYLA_API_KEY = '13486|uZL6LT5BP5sMSgePOKnsZbJA9giNB8XHm6ygO8nU';
const DOWNLOAD_URL = 'https://zylalabs.com/api/11016/youtube+download+and+info+api/20761/download';
const SEARCH_URL = 'https://zylalabs.com/api/11016/youtube+download+and+info+api/20760/search';

// ─── Helper: Search YouTube by song name ──────────────────────────────────────
async function searchYouTube(query) {
    const res = await axios.get(SEARCH_URL, {
        params: { q: query },
        headers: { Authorization: `Bearer ${ZYLA_API_KEY}` }
    });
    const results = res.data?.results || res.data?.items || res.data;
    if (!results || results.length === 0) throw new Error('No results found');
    const first = results[0];
    const videoId = first.id || first.videoId || first.video_id;
    return {
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: first.title || query,
        thumbnail: first.thumbnail || first.image || ''
    };
}

// ─── Helper: Is input a YouTube URL? ─────────────────────────────────────────
function isYouTubeUrl(input) {
    return input.includes('youtube.com') || input.includes('youtu.be');
}

// ─── Helper: Poll progress URL until download is ready ───────────────────────
async function waitForDownload(progressUrl, maxWait = 90000) {
    const interval = 3000;
    const maxTries = maxWait / interval;
    for (let i = 0; i < maxTries; i++) {
        await new Promise(r => setTimeout(r, interval));
        const res = await axios.get(progressUrl);
        const data = res.data;
        if (data.text === 'finished' && data.download_url) {
            return data.download_url;
        }
    }
    throw new Error('Download timed out');
}

// ─── iOS style context (same as your ping command) ───────────────────────────
const iosContext = (sender) => ({
    mentionedJid: [sender],
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: config.NEWSLETTER_JID || '120363423997837331@newsletter',
        newsletterName: "ᴘᴏᴘᴋɪᴅ-xᴍᴅ ɴᴇᴛᴡᴏʀᴋ",
        serverMessageId: 1
    },
    externalAdReply: {
        title: "ᴘᴏᴘᴋɪᴅ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ",
        body: "YouTube MP3 & MP4 Downloader",
        mediaType: 1,
        renderLargerThumbnail: false,
        thumbnailUrl: "https://files.catbox.moe/aapw1p.png",
        sourceUrl: "https://whatsapp.com/channel/0029Vb70ySJHbFV91PNKuL3T"
    }
});

const iosvCard = {
    key: { fromMe: false, participant: "0@s.whatsapp.net", remoteJid: "status@broadcast" },
    message: {
        contactMessage: {
            displayName: " POPKID-XMD",
            vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:POPKID\nTEL;type=CELL;type=VOICE;waid=254111385747:+254111385747\nEND:VCARD`
        }
    }
};

// ─── Core download function ───────────────────────────────────────────────────
async function downloadAndSend(conn, from, sender, mek, input, format) {
    let videoUrl, videoTitle;

    await conn.sendMessage(from, { react: { text: "🔍", key: mek.key } });

    // If song name (not a URL), search YouTube first
    if (!isYouTubeUrl(input)) {
        await conn.sendMessage(from, {
            text: `*ᴘᴏᴘᴋɪᴅ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ* 🔍\n\n*ꜱᴇᴀʀᴄʜɪɴɢ:* ${input}\n*ꜱᴛᴀᴛᴜꜱ:* Looking up...`,
            contextInfo: iosContext(sender)
        }, { quoted: iosvCard });

        const result = await searchYouTube(input);
        videoUrl = result.url;
        videoTitle = result.title;
    } else {
        videoUrl = input;
        videoTitle = 'YouTube Video';
    }

    const emoji = format === 'mp3' ? '🎵' : '🎬';
    await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

    await conn.sendMessage(from, {
        text: `*ᴘᴏᴘᴋɪᴅ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ* ${emoji}\n\n*ᴛɪᴛʟᴇ:* ${videoTitle}\n*ꜰᴏʀᴍᴀᴛ:* ${format.toUpperCase()}\n*ꜱᴛᴀᴛᴜꜱ:* Downloading...`,
        contextInfo: iosContext(sender)
    }, { quoted: iosvCard });

    // Trigger download
    const initRes = await axios.get(DOWNLOAD_URL, {
        params: { url: videoUrl, format },
        headers: { Authorization: `Bearer ${ZYLA_API_KEY}` }
    });

    const { progress_url } = initRes.data;
    if (!progress_url) throw new Error('No progress URL returned');

    // Poll until ready
    const dlUrl = await waitForDownload(progress_url);

    // Fetch buffer
    const fileRes = await axios.get(dlUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(fileRes.data);

    await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    // Send file
    if (format === 'mp3') {
        await conn.sendMessage(from, {
            audio: buffer,
            mimetype: 'audio/mpeg',
            ptt: false,
            contextInfo: iosContext(sender)
        }, { quoted: iosvCard });
    } else {
        await conn.sendMessage(from, {
            video: buffer,
            mimetype: 'video/mp4',
            caption: `*ᴘᴏᴘᴋɪᴅ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ* ✅\n*${videoTitle}*`,
            contextInfo: iosContext(sender)
        }, { quoted: iosvCard });
    }
}

// ─── .ytmp3 — Song name OR URL ────────────────────────────────────────────────
cmd({
    pattern: "ytmp3",
    alias: ["mp3", "audiodl", "song"],
    desc: "Download YouTube audio by song name or URL",
    category: "downloader",
    filename: __filename
}, async (conn, m, mek, { from, sender, args, reply }) => {
    try {
        const input = args.join(' ').trim();
        if (!input) return reply(
            `❌ *Usage:*\n\n` +
            `*.ytmp3 cardigan* — by song name\n` +
            `*.ytmp3 taylor swift cardigan* — with artist\n` +
            `*.ytmp3 https://youtu.be/xxx* — by URL`
        );
        await downloadAndSend(conn, from, sender, mek, input, 'mp3');
    } catch (err) {
        console.error("YTMP3 ERROR:", err);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("❌ *Download failed. Try another song name or URL.*");
    }
});

// ─── .ytmp4 — Song name OR URL ────────────────────────────────────────────────
cmd({
    pattern: "ytmp4",
    alias: ["mp4", "videodl"],
    desc: "Download YouTube video by song name or URL",
    category: "downloader",
    filename: __filename
}, async (conn, m, mek, { from, sender, args, reply }) => {
    try {
        const input = args.join(' ').trim();
        if (!input) return reply(
            `❌ *Usage:*\n\n` +
            `*.ytmp4 cardigan* — by song name\n` +
            `*.ytmp4 taylor swift cardigan* — with artist\n` +
            `*.ytmp4 https://youtu.be/xxx* — by URL`
        );
        await downloadAndSend(conn, from, sender, mek, input, 'mp4');
    } catch (err) {
        console.error("YTMP4 ERROR:", err);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("❌ *Download failed. Try another song name or URL.*");
    }
});

// ─── .yt — Choose format ──────────────────────────────────────────────────────
cmd({
    pattern: "yt",
    alias: ["ytdl", "youtube"],
    desc: "Download YouTube by name or URL, choose mp3/mp4",
    category: "downloader",
    filename: __filename
}, async (conn, m, mek, { from, sender, args, reply }) => {
    try {
        const lastArg = args[args.length - 1]?.toLowerCase();
        let format, input;

        if (lastArg === 'mp3' || lastArg === 'mp4') {
            format = lastArg;
            input = args.slice(0, -1).join(' ').trim();
        } else {
            return reply(
                `❌ *Usage:*\n\n` +
                `*.yt cardigan mp3* — song name + format\n` +
                `*.yt taylor swift cardigan mp3* — artist + song\n` +
                `*.yt https://youtu.be/xxx mp4* — URL + format`
            );
        }

        if (!input) return reply("❌ *Please provide a song name or URL.*");
        await downloadAndSend(conn, from, sender, mek, input, format);
    } catch (err) {
        console.error("YT ERROR:", err);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("❌ *Download failed. Try another song name or URL.*");
    }
});
