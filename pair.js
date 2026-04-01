import express from "express";
import fs from "fs";
import pino from "pino";
import mongoose from "mongoose"; // MongoDB connect kirima sandaha

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

const router = express.Router();

// --- MONGODB CONFIGURATION ---
// Oyage MongoDB Connection String eka methana danna
const MONGO_URI = process.env.MONGODB_URI || "OYAGE_MONGODB_URL_METHANA_DANNA";

const SessionSchema = new mongoose.Schema({
    sessionId: String,
    creds: Object,
    date: { type: Date, default: Date.now }
});

const SessionModel = mongoose.models.Session || mongoose.model("Session", SessionSchema);

// MongoDB Connect kirima
mongoose.connect(MONGO_URI).then(() => console.log("Connected to MongoDB ✅")).catch(err => console.error("MongoDB Connection Error:", err));

function removeFile(FilePath) {
    try {
        if (!fs.existsSync(FilePath)) return false;
        fs.rmSync(FilePath, { recursive: true, force: true });
    } catch (e) {
        console.error("Error removing file:", e);
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
            return res.status(400).send({ code: "Invalid phone number." });
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
                        // Mega upload eka venuvata MongoDB walata save kirima
                        const sessionID = "ᴏꜱʜɪʏᴀ~" + Math.random().toString(36).substring(2, 12).toUpperCase();
                        
                        await SessionModel.create({
                            sessionId: sessionID,
                            creds: state.creds // creds.json eke data kelinma DB yanawa
                        });

                        console.log("✅ Session saved to MongoDB. ID:", sessionID);

                        const userJid = jidNormalizedUser(num + "@s.whatsapp.net");

                        // WhatsApp ekata session ID eka yavuva
                        await KnightBot.sendMessage(userJid, {
                            text: `*Successfully Connected!* ⚡\n\n*Session ID:* ${sessionID}\n\nDon't share your session ID with anyone!`
                        });

                        console.log("📄 Session ID sent to WhatsApp");

                        console.log("🧹 Cleaning up...");
                        await delay(2000);
                        removeFile(dirs);
                        // Meeka API ekak nisa exit wenna ona na, eth oyaage code eke thibba nisa mama damma
                        // process.exit(0); 
                    } catch (error) {
                        console.error("❌ MongoDB Save Error:", error);
                        removeFile(dirs);
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
