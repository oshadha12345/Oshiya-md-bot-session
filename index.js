const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const mongoose = require('mongoose');

// MongoDB Connection String eka methana danna
const mongoURI = "OYAGE_MONGODB_URL_EKA_METHANA_DANNA";

// Session eka save karanna hadana Schema eka
const SessionSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    data: { type: String, required: true }
});
const Session = mongoose.model('Session', SessionSchema);

async function startBot() {
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB!");

    // --- Custom MongoDB Auth Strategy ---
    // Meeka hadanne kelinma database ekata save wenna
    const { state, saveCreds } = await useMultiFileAuthState('./session'); 
    // Note: MultiFileAuthState use karala folder ekata save wenna hadala, 
    // eka database ekata sync karanna puluwan. 

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: ["Oshiya-MD", "Safari", "3.0.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            startBot(); // Reconnect
        } else if (connection === 'open') {
            console.log('WhatsApp Connected successfully!');
        }
    });
}

startBot();
