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
    } catch {
        return null;
    }
}

router.get("/", async (req, res) => {

    let num = req.query.number;

    if (!num) {
        return res.status(400).send({
            code: "Number is required. Example: /?number=947XXXXXXXX"
        });
    }

    let dirs = "./session";

    await removeFile(dirs);

    num = num.replace(/[^0-9]/g, "");

    const phone = pn("+" + num);

    if (!phone.isValid()) {
        return res.status(400).send({
            code: "Invalid phone number"
        });
    }

    num = phone.getNumber("e164").replace("+", "");

    async function initiateSession() {

        const { state, saveCreds } = await useMultiFileAuthState(dirs);

        try {

            const { version } = await fetchLatestBaileysVersion();

            const KnightBot = makeWASocket({

                version,

                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(
                        state.keys,
                        pino({ level: "fatal" })
                    ),
                },

                logger: pino({ level: "fatal" }),

                browser: Browsers.windows("Chrome"),

                printQRInTerminal: false,

                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,

            });

            KnightBot.ev.on("connection.update", async (update) => {

                const { connection, lastDisconnect } = update;

                if (connection === "open") {

                    console.log("Connected");

                    try {

                        const credsPath = dirs + "/creds.json";

                        const megaUrl = await upload(
                            credsPath,
                            `creds_${num}.json`
                        );

                        const megaFileId = getMegaFileId(megaUrl);

                        if (!megaFileId) {
                            console.log("Mega upload failed");
                            return;
                        }

                        // ✅ PREFIX ADD HERE
                        const sessionId = "OSHIYA-" + megaFileId;

                        const userJid = jidNormalizedUser(
                            num + "@s.whatsapp.net"
                        );

                        await sendInteractiveMessage(KnightBot, userJid, {

                            text:
`╭━━━〔💐𝐎𝐒𝐇𝐈𝐘𝐀💐〕━━━╮
┃ Session uploaded successfully
┃
┃ Session ID:
┃ ${sessionId}
┃
┃ Copy and save it
╰━━━━━━━━━━━━━━━━━━╯`,

                            footer: "OSHIYA-MD",

                            interactiveButtons: [

                                {
                                    name: "cta_copy",

                                    buttonParamsJson: JSON.stringify({

                                        display_text: "📋 Copy Session ID",

                                        copy_code: sessionId,

                                    }),

                                },

                                {
                                    name: "cta_url",

                                    buttonParamsJson: JSON.stringify({

                                        display_text: "🧑‍💻 Developer",

                                        url: "https://wa.me/94756599952",

                                    }),

                                },

                            ],

                        });

                        console.log("Session sent");

                        await delay(2000);

                        removeFile(dirs);

                        process.exit(0);

                    } catch (err) {

                        console.log("Upload error:", err);

                        process.exit(1);

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

                await delay(2000);

                let code = await KnightBot.requestPairingCode(num);

                code = code.match(/.{1,4}/g).join("-");

                return res.send({
                    code: code
                });

            }

            KnightBot.ev.on("creds.update", saveCreds);

        } catch (err) {

            console.log(err);

            res.status(500).send({
                code: "Server Error"
            });

        }

    }

    initiateSession();

});

process.on("uncaughtException", function (err) {

    console.log("Error:", err);

});

export default router;
