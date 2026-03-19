const { MongoClient } = require("mongodb");

const mongoUrl = "mongodb+srv://oshadhaoshadha12345_db_user:SH0m8ksHl8A0ZfBF@oshiya.bc9b5e4.mongodb.net/?appName=Oshiya";

const client = new MongoClient(mongoUrl);
let collection;

async function connectMongo() {
    await client.connect();
    const db = client.db("oshiya_session");
    collection = db.collection("session");
    console.log("✅ MongoDB Connected");
}

async function getSession() {
    const data = await collection.findOne({ _id: "auth" });
    return data?.data || { creds: {}, keys: {} };
}

async function saveSession(state) {
    await collection.updateOne(
        { _id: "auth" },
        { $set: { data: state } },
        { upsert: true }
    );
}

module.exports = { connectMongo, getSession, saveSession };
