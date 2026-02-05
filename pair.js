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
import { sendInteractiveMessage } from "gifted-btns";

const router = express.Router();


// delete folder safely
function removeFile(path) {
    try {
        if (fs.existsSync(path)) {
            fs.rmSync(path, { recursive: true, force: true });
            return true;
        }
    } catch (e) {
        console.error("Error removing file:", e);
    }
    return false;
}


// extract MEGA file ID
function getMegaFileId(url) {
    try {
        const match = url.match(/\/file\/([^#]+#[^/]+)/);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}


router.get("/", async (req, res) => {

    try {

        let num = req.query.number;

        if (!num) {
            return res.status(400).send({
                code: "Phone number required"
            });
        }

        num = num.replace(/[^0-9]/g, "");

        const phone = pn("+" + num);

        if (!phone.isValid()) {
            return res.status(400).send({
                code: "Invalid phone number"
            });
        }

        num = phone.getNumber("e164").replace("+", "");

        const sessionDir = "./session_" + num;

        removeFile(sessionDir);


        async function initiateSession() {

            const { state, saveCreds } =
                await useMultiFileAuthState(sessionDir);

            const { version } =
                await fetchLatestBaileysVersion();


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

                markOnlineOnConnect: false,

                connectTimeoutMs: 60000,

                keepAliveIntervalMs: 30000,

                defaultQueryTimeoutMs: 60000,

            });



            KnightBot.ev.on("connection.update", async (update) => {

                const { connection, lastDisconnect } = update;


                if (connection === "open") {

                    console.log("✅ Connected");

                    try {

                        const credsPath =
                            sessionDir + "/creds.json";

                        const megaUrl =
                            await upload(
                                credsPath,
                                `creds_${num}_${Date.now()}.json`
                            );

                        const megaId =
                            getMegaFileId(megaUrl);


                        if (megaId) {

                            const userJid =
                                jidNormalizedUser(
                                    num + "@s.whatsapp.net"
                                );


                            await sendInteractiveMessage(
                                KnightBot,
                                userJid,
                                {

                                    text:
`╭━━━〔 SESSION GENERATED 〕━━━⬣
┃ 🔑 Your Session ID
┃
┃ ${megaId}
┃
┃ Click copy button below
╰━━━━━━━━━━━━━━━━━━⬣`,

                                    footer:
                                        "OSHIYA-MD",

                                    interactiveButtons: [

                                        {
                                            name: "cta_copy",
                                            buttonParamsJson:
                                                JSON.stringify({

                                                    display_text:
                                                        "📋 Copy Session ID",

                                                    copy_code:
                                                        megaId,

                                                }),
                                        },

                                        {
                                            name: "cta_url",

                                            buttonParamsJson:
                                                JSON.stringify({

                                                    display_text:
                                                        "Contact Owner",

                                                    url:
                                                        "https://wa.me/94756599952",

                                                }),
                                        },

                                    ],

                                }
                            );


                            console.log(
                                "✅ Session ID sent"
                            );

                        }


                        await delay(2000);

                        removeFile(sessionDir);

                        process.exit(0);

                    }
                    catch (err) {

                        console.log(err);

                        removeFile(sessionDir);

                        process.exit(1);

                    }

                }


                if (connection === "close") {

                    const status =
                        lastDisconnect?.error?.output?.statusCode;

                    if (status !== 401) {

                        console.log("Reconnecting...");

                        initiateSession();

                    }

                }

            });



            KnightBot.ev.on(
                "creds.update",
                saveCreds
            );



            if (!state.creds.registered) {

                await delay(2000);

                let code =
                    await KnightBot.requestPairingCode(num);

                code =
                    code?.match(/.{1,4}/g)?.join("-");

                res.send({ code });

            }

        }


        await initiateSession();

    }
    catch (err) {

        console.log(err);

        res.status(500).send({
            code: "Server Error"
        });

    }

});



process.on("uncaughtException", (err) => {

    console.log("Error:", err);

});


export default router;