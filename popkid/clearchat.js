const { cmd } = require("../command");

cmd({
  pattern: "clearchat",
  alias: ["deletechat"],
  react: '🗑️',
  desc: "Clear/delete the current chat",
  category: "owner",
  use: ".clearchat",
  filename: __filename
}, async (conn, mek, m, { from, reply, isGroup, isOwner, isAdmins }) => {
  try {

    // Group: must be admin or owner
    if (isGroup && !isOwner && !isAdmins) {
      return reply("❌ Only group admins or bot owner can clear this chat.");
    }

    // DM: must be owner or bot itself
    if (!isGroup && !isOwner && !mek.key.fromMe) {
      return reply("❌ Only the bot owner can clear DM chats.");
    }

    await reply("⏳ Clearing chat...");

    // Load last 50 messages from store
    const messages = Object.values(
      conn.store?.messages?.[from]?.array || []
    ).slice(-50);

    if (!messages.length) {
      return reply("⚠️ No messages found to clear. Chat may already be empty.");
    }

    let deleted = 0;

    for (const msg of messages) {
      try {
        await conn.sendMessage(from, {
          delete: msg.key
        });
        deleted++;
        await new Promise(r => setTimeout(r, 300)); // small delay to avoid rate limit
      } catch (e) {
        // skip messages that can't be deleted
      }
    }

    await reply(`🗑️ *Done! Deleted ${deleted} messages.*`);

  } catch (e) {
    console.error('[CLEARCHAT] Error:', e.message);
    await reply(`❌ Failed to clear chat: ${e.message}`);
  }
});
