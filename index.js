import makeWASocket, { 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion 
} from "@whiskeysockets/baileys";
import mongoose from 'mongoose';
import pino from "pino";

// MongoDB Connection String
const mongoURI = "mongodb+srv://oshadhaoshadha12345_db_user:SH0m8ksHl8A0ZfBF@oshiya.bc9b5e4.mongodb.net/?appName=Oshiya";

// Session Schema (අනාගතයේදී DB එකටම session දාන්න අවශ්‍ය නම් භාවිතා කළ හැක)
const SessionSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    data: { type: String, required: true }
});
const Session = mongoose.model('Session', SessionSchema);

async function startBot() {
    try {
        await mongoose.connect(mongoURI);
        console.log("✅ Connected to MongoDB!");

        // දැනට session එක file system එකේ save වේ (local folder)
        const { state, saveCreds } = await useMultiFileAuthState('./session');
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            auth: state,
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: true,
            browser: ["Oshiya-MD", "Safari", "3.0.0"]
        });

        // Credentials save කිරීම
        sock.ev.on('creds.update', saveCreds);

        // Connection update handle කිරීම
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('--- QR Code එක Scan කරන්න ---');
            }

            if (connection === 'close') {
                const error = lastDisconnect?.error?.output?.statusCode;
                console.log('❌ Connection closed. Reconnecting...');
                startBot(); 
            } else if (connection === 'open') {
                console.log('✅ WhatsApp Connected successfully!');
            }
        });

        // Messages ලැබෙන විට
        sock.ev.on('messages.upsert', async m => {
            // console.log(JSON.stringify(m, undefined, 2));
        });

    } catch (err) {
        console.error("Critical Error: ", err);
    }
}

startBot();
