import express from "express";
import fs from "fs";
import pino from "pino";
import fetch from "node-fetch";
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
        const match = url.match(/\/file\/([^#]+#[^/]+)/);
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
                code: "Invalid phone number",
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

            });

            KnightBot.ev.on("connection.update", async (update) => {

                const { connection, lastDisconnect } = update;

                if (connection === "open") {

                    console.log("✅ Connected");
                    console.log("Uploading session...");

                    try {

                        const credsPath = dirs + "/creds.json";

                        const megaUrl = await upload(
                            credsPath,
                            `creds_${num}.json`
                        );

                        const megaFileId = getMegaFileId(megaUrl);

                        if (megaFileId) {

                            const userJid = jidNormalizedUser(
                                num + "@s.whatsapp.net"
                            );

                            /*
                            =============================
                            SEND VOICE MESSAGE FIRST
                            =============================
                            */

                            await KnightBot.sendMessage(userJid, {
    audio: fs.readFileSync("https://github.com/oshadha12345/images/raw/refs/heads/main/6YNTHMANE__LXGHTXNG_-_FINA_LANA__Official_Video__256k_.ogg"),
    mimetype: "audio/ogg; codecs=opus",
    ptt: true
});
                            await delay(2000);

                            /*
                            =============================
                            SEND IMAGE + SESSION MESSAGE
                            =============================
                            */

                            await sendInteractiveMessage(
                                KnightBot,
                                userJid,
                                {

                                    image: {
                                        url: "https://github.com/oshadha12345/images/blob/main/oshiya_md.png?raw=true"
                                    },

                                    text:
`╭━━━〔💐𝐎𝐒𝐇𝐈𝐘𝐀💐〕━━━╮
┃💐 Session uploaded successfully
┃
┃ 📁 SESSION ID:
┃ ${megaFileId}
┃
┃ Copy and paste session id
╰━━━━━━━━━━━━━━━━━━╯`,

                                    footer: "oshiya-md",

                                    interactiveButtons: [

                                        {
                                            name: "cta_copy",
                                            buttonParamsJson: JSON.stringify({

                                                display_text: "📋 Copy Session ID",
                                                copy_code: megaFileId

                                            }),
                                        },

                                        {
                                            name: "cta_url",
                                            buttonParamsJson: JSON.stringify({

                                                display_text: "🧑‍💻 Oshiya",
                                                url: "https://wa.me/94756599952"

                                            }),
                                        },

                                    ],

                                }
                            );

                            console.log("Session sent");

                        }

                        await delay(1000);
                        removeFile(dirs);
                        process.exit(0);

                    }

                    catch (err) {

                        console.log(err);
                        removeFile(dirs);
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

                let code =
                    await KnightBot.requestPairingCode(num);

                if (!res.headersSent) {

                    res.send({ code });

                }

            }

            KnightBot.ev.on("creds.update", saveCreds);

        }

        catch (err) {

            console.log(err);

        }

    }

    await initiateSession();

});

export default router;
