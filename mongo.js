const mongoose = require("mongoose");

async function connectMongo() {

    try {

        await mongoose.connect(process.env.MONGO_URL);

        console.log("MongoDB Connected");

    } catch (err) {

        console.log("MongoDB Error:", err);

    }

}

module.exports = connectMongo;
