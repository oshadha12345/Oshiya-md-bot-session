require("dotenv").config();

const express = require("express");

const {
default: makeWASocket
} = require("@whiskeysockets/baileys");

const connectMongo = require("./mongo");

const useMongoAuthState =
require("./mongoAuthState");

const app = express();

let sock;

async function startBot(sessionId) {

    const { state, saveCreds } =
    await useMongoAuthState(sessionId);

    sock = makeWASocket({

        auth: state,

        printQRInTerminal: false

    });

    sock.ev.on(
        "creds.update",
        saveCreds
    );

    sock.ev.on(
        "connection.update",
        ({ connection }) => {

            if (connection === "open") {

                console.log(
                    "Bot Connected"
                );

            }

        }
    );

}

app.get("/pair", async (req, res) => {

    const number =
    req.query.number;

    if (!number)
        return res.send(
            "Enter number"
        );

    const sessionId =
    number;

    const { state } =
    await useMongoAuthState(
        sessionId
    );

    sock = makeWASocket({

        auth: state

    });

    const code =
    await sock.requestPairingCode(
        number
    );

    res.json({
        code
    });

});

app.listen(3000,
async () => {

    await connectMongo();

    console.log(
        "Server started"
    );

});
