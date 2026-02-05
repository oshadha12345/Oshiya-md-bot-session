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
import { sendButtons } from "gifted-btns";

const router = express.Router();


// delete session folder safely
function removeFile(path) {
    try {
        if (fs.existsSync(path)) {
            fs.rmSync(path, { recursive: true, force: true });
            return true;
        }
    } catch (e) {
        console.log("Delete error:", e);
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

        // clean number
        num = num.replace(/[^0-9]/g, "");

        const phone = pn("+" + num);

        if (!phone.isValid()) {
            return res.status(400).send({
                code: "Invalid phone number"
            });
        }

        num = phone.getNumber("e164").replace("+", "");

        const sessionDir = "./session_" + num;

        // delete old session
        removeFile(sessionDir);



        async function startSession() {

            const { state, saveCreds } =
                await useMultiFileAuthState(sessionDir);

            const { version } =
                await fetchLatestBaileysVersion();


            const sock = makeWASocket({

                version,

                logger: pino({ level: "fatal" }),

                browser: Browsers.windows("Chrome"),

                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(
                        state.keys,
                        pino({ level: "fatal" })
                    ),
                },

                printQRInTerminal: false,
                markOnlineOnConnect: false,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
                defaultQueryTimeoutMs: 60000,

            });



            // save creds
            sock.ev.on("creds.update", saveCreds);



            sock.ev.on("connection.update", async (update) => {

                const { connection, lastDisconnect } = update;


                if (connection === "open") {

                    console.log("✅ Connected");


                    try {

                        const credsPath =
                            sessionDir + "/creds.json";

                        const megaUrl =
                            await upload(
                                credsPath,
                                `creds_${num}.json`
                            );

                        const megaId =
                            getMegaFileId(megaUrl);


                        if (megaId) {

                            const userJid =
                                jidNormalizedUser(
                                    num + "@s.whatsapp.net"
                                );


                            await sendButtons(
                                sock,
                                userJid,
                                {
                                    title: "OSHIYA SESSION GENERATOR",

                                    text:
`╭━━━〔 SESSION GENERATED 〕━━━⬣
┃ 👤 Number: ${num}
┃ 🔑 Session ID:
┃
┃ ${megaId}
┃
┃ Click copy button below
╰━━━━━━━━━━━━━━━━━━⬣`,

                                    footer: "OSHIYA-MD",

                                    buttons: [

                                        {
                                            id: "copy",
                                            text: "📋 Copy Session ID",
                                            copy_code: megaId
                                        },

                                        {
                                            id: "owner",
                                            text: "Contact Owner",
                                            url: "https://wa.me/94756599952"
                                        }

                                    ]

                                }
                            );

                            console.log("✅ Session sent");

                        }


                        await delay(3000);

                        removeFile(sessionDir);

                    }
                    catch (err) {

                        console.log("Send error:", err);

                        removeFile(sessionDir);

                    }

                }


                if (connection === "close") {

                    const status =
                        lastDisconnect?.error?.output?.statusCode;

                    if (status !== 401) {

                        console.log("Reconnecting...");

                        startSession();

                    }

                }

            });



            // send pairing code
            if (!state.creds.registered) {

                await delay(2000);

                let code =
                    await sock.requestPairingCode(num);

                code =
                    code?.match(/.{1,4}/g)?.join("-");

                return res.send({
                    code: code
                });

            }

        }


        await startSession();

    }
    catch (err) {

        console.log("Server error:", err);

        res.status(500).send({
            code: "Server Error"
        });

    }

});



process.on("uncaughtException", (err) => {

    console.log("Uncaught Error:", err);

});


export default router;