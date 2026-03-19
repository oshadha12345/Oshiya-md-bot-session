const { default: makeWASocket } = require("@whiskeysockets/baileys");
const { connectMongo, getSession, saveSession } = require("./lib/mongo");

(async () => {
    // Connect to MongoDB
    await connectMongo();

    // Load session from MongoDB
    const authState = await getSession();

    // Create WhatsApp socket
    const sock = makeWASocket({
        auth: authState,
        printQRInTerminal: true
    });

    // Auto-save creds to MongoDB on update
    sock.ev.on("creds.update", () => saveSession(authState));

    // Listen for messages
    sock.ev.on("messages.upsert", m => {
        console.log("New message:", m.messages[0].message?.conversation || m);
    });

    console.log("✅ Bot running with MongoDB auth!");
})();
