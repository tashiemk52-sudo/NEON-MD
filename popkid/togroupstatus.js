const { commands } = require('../command')
const { downloadMediaMessage } = require('../lib')
const ffmpeg = require('fluent-ffmpeg')
const fs = require('fs')
const path = require('path')
const os = require('os')

commands.push({
  pattern: "togroupstatus",
  alias: ["groupstatus", "statusgroup", "togcstatus"],
  react: "📢",
  category: "group",
  description: "Send text or quoted media to group status. Owner only.",
  function: async (conn, mek, m, { from, isGroup, isOwner, text: q, reply }) => {

    if (!isGroup) return reply("❌ Group only command!")
    if (!isOwner) return reply("❌ Owner Only Command!")

    const contextInfo = mek.message?.extendedTextMessage?.contextInfo
    const quoted = contextInfo?.quotedMessage
    const quotedParticipant = contextInfo?.participant
    const quotedStanzaId = contextInfo?.stanzaId

    const hasQuoted = !!quoted

    if (!q && !hasQuoted) {
      return reply(
        `📌 *Usage:*\n` +
        `• .togroupstatus <text>\n` +
        `• Reply to image/video/audio with .togroupstatus <caption>\n` +
        `• Or just .togroupstatus to forward quoted media`
      )
    }

    // Helper: format video buffer to mp4 using ffmpeg
    const formatVideo = (buffer) => new Promise((resolve, reject) => {
      const tmpIn = path.join(os.tmpdir(), `vin_${Date.now()}.mp4`)
      const tmpOut = path.join(os.tmpdir(), `vout_${Date.now()}.mp4`)
      fs.writeFileSync(tmpIn, buffer)
      ffmpeg(tmpIn)
        .outputOptions(['-c:v libx264', '-c:a aac', '-movflags +faststart'])
        .save(tmpOut)
        .on('end', () => {
          const result = fs.readFileSync(tmpOut)
          try { fs.unlinkSync(tmpIn) } catch (_) {}
          try { fs.unlinkSync(tmpOut) } catch (_) {}
          resolve(result)
        })
        .on('error', (err) => {
          try { fs.unlinkSync(tmpIn) } catch (_) {}
          try { fs.unlinkSync(tmpOut) } catch (_) {}
          reject(err)
        })
    })

    // Helper: format audio buffer to mp4/aac using ffmpeg
    const formatAudio = (buffer) => new Promise((resolve, reject) => {
      const tmpIn = path.join(os.tmpdir(), `ain_${Date.now()}.ogg`)
      const tmpOut = path.join(os.tmpdir(), `aout_${Date.now()}.mp4`)
      fs.writeFileSync(tmpIn, buffer)
      ffmpeg(tmpIn)
        .outputOptions(['-c:a aac'])
        .save(tmpOut)
        .on('end', () => {
          const result = fs.readFileSync(tmpOut)
          try { fs.unlinkSync(tmpIn) } catch (_) {}
          try { fs.unlinkSync(tmpOut) } catch (_) {}
          resolve(result)
        })
        .on('error', (err) => {
          try { fs.unlinkSync(tmpIn) } catch (_) {}
          try { fs.unlinkSync(tmpOut) } catch (_) {}
          reject(err)
        })
    })

    try {
      let statusPayload = {}

      if (hasQuoted) {
        // Build proper Baileys message object for downloadMediaMessage
        const quotedMsg = {
          key: {
            remoteJid: from,
            fromMe: quotedParticipant === conn.user?.id,
            id: quotedStanzaId,
            participant: quotedParticipant
          },
          message: quoted
        }

        if (quoted?.imageMessage) {
          const caption = q || quoted.imageMessage.caption || ""
          const buffer = await downloadMediaMessage(quotedMsg, "buffer", {})
          statusPayload = { image: buffer, mimetype: "image/jpeg" }
          if (caption) statusPayload.caption = caption

        } else if (quoted?.videoMessage) {
          const caption = q || quoted.videoMessage.caption || ""
          let buffer = await downloadMediaMessage(quotedMsg, "buffer", {})
          buffer = await formatVideo(buffer)
          statusPayload = { video: buffer, mimetype: "video/mp4" }
          if (caption) statusPayload.caption = caption

        } else if (quoted?.audioMessage) {
          let buffer = await downloadMediaMessage(quotedMsg, "buffer", {})
          buffer = await formatAudio(buffer)
          statusPayload = { audio: buffer, mimetype: "audio/mp4", ptt: false }

        } else if (quoted?.conversation || quoted?.extendedTextMessage?.text) {
          statusPayload.text = q || quoted.conversation || quoted.extendedTextMessage?.text

        } else {
          return reply("❌ Unsupported media type for group status.")
        }

        // Attach caption override if provided and not already set
        if (q && statusPayload.image || q && statusPayload.video) {
          statusPayload.caption = q
        }

      } else {
        statusPayload.text = q
      }

      // Collect all group member JIDs to send status to
      let statusJidList = [from]
      try {
        const groupMeta = await conn.groupMetadata(from)
        if (groupMeta?.participants?.length) {
          statusJidList = groupMeta.participants.map(p => p.id)
        }
      } catch (_) {
        // fallback to just 'from' if metadata fetch fails
      }

      // Send as broadcast status
      await conn.sendMessage('status@broadcast', statusPayload, {
        statusJidList
      })

      await m.react("✅")
      return reply("✅ Status sent to group members!")

    } catch (error) {
      console.error("togroupstatus error:", error)
      await m.react("❌")
      return reply(`❌ Error sending group status: ${error.message}`)
    }
  }
})
