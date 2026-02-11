import express from "express";
import fs from "fs";
import pino from "pino";
import pkg from "gifted-btns";

const { sendInteractiveMessage } = pkg;
import {
    makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
    fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import pn from "awesome-phonenumber";
import { upload } from "./mega.js";

const router = express.Router();

function removeFile(FilePath) {
    try {
        if (!fs.existsSync(FilePath)) return false;
        fs.rmSync(FilePath, { recursive: true, force: true });
    } catch (e) {
        console.error("Error removing file:", e);
    }
}

function getMegaFileId(url) {
    try {
        const match = url.match(/\/file\/([^#]+#[^\/]+)/);
        return match ? match[1] : null;
    } catch (error) {
        return null;
    }
}

router.get("/", async (req, res) => {
    let num = req.query.number;
    let dirs = "./" + (num || `session`);

    await removeFile(dirs);

    num = num.replace(/[^0-9]/g, "");

    const phone = pn("+" + num);
    if (!phone.isValid()) {
        if (!res.headersSent) {
            return res.status(400).send({
                code: "Invalid phone number. Please enter your full international number without + or spaces.",
            });
        }
        return;
    }

    num = phone.getNumber("e164").replace("+", "");

    async function initiateSession() {
        const { state, saveCreds } = await useMultiFileAuthState(dirs);

        try {
            const { version } = await fetchLatestBaileysVersion();

            let KnightBot = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(
                        state.keys,
                        pino({ level: "fatal" })
                    ),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }),
                browser: Browsers.windows("Chrome"),
                markOnlineOnConnect: false,
                generateHighQualityLinkPreview: false,
                defaultQueryTimeoutMs: 60000,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
                retryRequestDelayMs: 250,
                maxRetries: 5,
            });

            KnightBot.ev.on("connection.update", async (update) => {

                const { connection, lastDisconnect } = update;

                if (connection === "open") {

                    const credsPath = dirs + "/creds.json";

                    const megaUrl = await upload(
                        credsPath,
                        `creds_${num}_${Date.now()}.json`
                    );

                    const megaFileId = getMegaFileId(megaUrl);

                    if (megaFileId) {

                        const userJid = jidNormalizedUser(
                            num + "@s.whatsapp.net"
                        );

                        await sendInteractiveMessage(KnightBot, userJid, {
                            text:
`╭━━━〔💐𝐎𝐒𝐇𝐈𝐘𝐀💐〕━━━╮
┃💐 Session uploaded successfully
┃
┃ 📁 ꜱᴇꜱꜱɪᴏɴ ɪᴅ:
┃ ${megaFileId}
┃
┃ ᴄᴏᴘʏ ᴀɴᴅ ᴘᴀꜱᴛᴇ ꜱᴇꜱꜱɪᴏɴ ɪᴅ 💐
╰━━━━━━━━━━━━━━━━━━╯`,

                            footer: "ᴏꜱʜɪʏᴀ-ᴍᴅ 🧑‍💻",

                            interactiveButtons: [
                                {
                                    name: "cta_copy",
                                    buttonParamsJson: JSON.stringify({
                                        display_text: "📋 Copy Session ID",
                                        copy_code: megaFileId,
                                    }),
                                },
                                {
                                    name: "cta_url",
                                    buttonParamsJson: JSON.stringify({
                                        display_text: "🧑‍💻 Oshiya",
                                        url: "https://Wa.me/+94756599952?text=_𝐎𝐬𝐡𝐢𝐲𝐚_💐",
                                    }),
                                },
                            ],
                        });

                        await delay(1000);

                        removeFile(dirs);

                        process.exit(0);
                    }
                }

                if (connection === "close") {

                    const statusCode =
                        lastDisconnect?.error?.output?.statusCode;

                    if (statusCode !== 401) {
                        initiateSession();
                    }
                }
            });

            if (!KnightBot.authState.creds.registered) {

                await delay(3000);

                num = num.replace(/[^\d+]/g, "");

                if (num.startsWith("+"))
                    num = num.substring(1);

                try {

                    let code = await KnightBot.requestPairingCode(num);

                    code = code?.match(/.{1,4}/g)?.join("-") || code;

                    // ✅ PREFIX ADDED HERE
                    code = "ᴏꜱʜɪʏᴀ~" + code;

                    if (!res.headersSent) {

                        console.log({ num, code });

                        await res.send({ code });

                    }

                } catch {

                    if (!res.headersSent) {

                        res.status(503).send({
                            code: "Failed to get pairing code",
                        });

                    }

                    process.exit(1);

                }
            }

            KnightBot.ev.on("creds.update", saveCreds);

        } catch {

            if (!res.headersSent) {
                res.status(503).send({
                    code: "Service Unavailable",
                });
            }

            process.exit(1);
        }
    }

    await initiateSession();
});

export default router;
