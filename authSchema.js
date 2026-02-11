const mongoose = require("mongoose");

const AuthSchema = new mongoose.Schema({

    key: {
        type: String,
        unique: true
    },

    value: mongoose.Schema.Types.Mixed

});

module.exports = mongoose.model("Auth", AuthSchema);
