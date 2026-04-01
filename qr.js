import express from "express";
import fs from "fs";
import pino from "pino";
import pkg from "gifted-btns";
import mongoose from "mongoose"; // MongoDB sandaha

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
import QRCode from "qrcode";

const router = express.Router();

// --- MONGODB CONFIGURATION ---
const MONGO_URI = process.env.MONGODB_URI || "OYAGE_MONGODB_URL_METHANA_DANNA";

const SessionSchema = new mongoose.Schema({
    sessionId: String,
    creds: Object,
    date: { type: Date, default: Date.now }
});

const SessionModel = mongoose.models.Session || mongoose.model("Session", SessionSchema);

// MongoDB Connect kirima
mongoose.connect(MONGO_URI)
    .then(() => console.log("Connected to MongoDB ✅"))
    .catch(err => console.error("MongoDB Connection Error:", err));

function removeFile(FilePath) {
    try {
        if (!fs.existsSync(FilePath)) return false;
        fs.rmSync(FilePath, { recursive: true, force: true });
    } catch (e) {
        console.error("Error removing file:", e);
    }
}

router.get("/", async (req, res) => {
    const sessionIdRaw = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const dirs = `./qr_sessions/session_${sessionIdRaw}`;

    if (!fs.existsSync("./qr_sessions")) {
        fs.mkdirSync("./qr_sessions", { recursive: true });
    }

    await removeFile(dirs);

    async function initiateSession() {
        const { state, saveCreds } = await useMultiFileAuthState(dirs);

        try {
            const { version } = await fetchLatestBaileysVersion();
            let responseSent = false;

            const KnightBot = makeWASocket({
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
                const { connection, lastDisconnect, qr } = update;

                // QR Code eka client ta yawima
                if (qr && !responseSent) {
                    try {
                        const qrDataURL = await QRCode.toDataURL(qr);
                        if (!responseSent) {
                            responseSent = true;
                            res.send({
                                qr: qrDataURL,
                                message: "Scan this QR code with WhatsApp",
                            });
                        }
                    } catch (qrError) {
                        console.error("QR Error:", qrError);
                    }
                }

                if (connection === "open") {
                    console.log("✅ Connected successfully!");

                    try {
                        // Unique Session ID ekak hadamu
                        const finalSessionId = "ᴏꜱʜɪʏᴀ~" + Math.random().toString(36).substring(2, 12).toUpperCase();

                        // MongoDB walata save kirima (Mega venuvata)
                        await SessionModel.create({
                            sessionId: finalSessionId,
                            creds: state.creds
                        });

                        console.log("✅ Session saved to MongoDB:", finalSessionId);

                        const userJid = jidNormalizedUser(KnightBot.authState.creds.me?.id || "");
                        
                        if (userJid) {
                            // WhatsApp ekata Copy Button ekath ekka ID eka yawima
                            await sendInteractiveMessage(KnightBot, userJid, {
                                text: `╭━━━〔💐𝐎𝐒𝐇𝐈𝐘𝐀💐〕━━━╮\n┃💐 Session Connected Successfully\n┃\n┃ 📁 ꜱᴇꜱꜱɪᴏɴ ɪᴅ:\n┃ ${finalSessionId}\n┃\n┃ ᴄᴏᴘʏ ᴀɴᴅ ᴘᴀꜱᴛᴇ ꜱᴇꜱꜱɪᴏɴ ɪᴅ 💐\n╰━━━━━━━━━━━━━━━━━━╯`,
                                footer: "ᴏꜱʜɪʏᴀ-ᴍᴅ💐",
                                interactiveButtons: [
                                    {
                                        name: "cta_copy",
                                        buttonParamsJson: JSON.stringify({
                                            display_text: "📋 Copy Session ID",
                                            copy_code: finalSessionId,
                                        }),
                                    },
                                    {
                                        name: "cta_url",
                                        buttonParamsJson: JSON.stringify({
                                            display_text: "🧑‍💻 Support",
                                            url: "https://Wa.me/+94756599952",
                                        }),
                                    },
                                ],
                            });
                        }

                        console.log("🧹 Cleaning up...");
                        await delay(2000);
                        removeFile(dirs);
                        process.exit(0);
                    } catch (error) {
                        console.error("❌ Error during finalization:", error);
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

            KnightBot.ev.on("creds.update", saveCreds);

            // Timeout handle kirima
            setTimeout(() => {
                if (!responseSent) {
                    responseSent = true;
                    res.status(408).send({ code: "QR generation timeout" });
                    removeFile(dirs);
                }
            }, 45000);

        } catch (err) {
            console.error("Init Error:", err);
            if (!res.headersSent) res.status(500).send({ code: "Internal Error" });
            removeFile(dirs);
        }
    }

    await initiateSession();
});

export default router;
