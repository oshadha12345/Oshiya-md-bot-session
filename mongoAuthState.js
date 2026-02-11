const Auth = require("./authSchema");

async function useMongoAuthState(sessionId) {

    async function writeData(data, key) {

        await Auth.findOneAndUpdate(

            { key: sessionId + ":" + key },

            { value: data },

            { upsert: true }

        );

    }

    async function readData(key) {

        const data = await Auth.findOne({

            key: sessionId + ":" + key

        });

        return data?.value || null;

    }

    async function removeData(key) {

        await Auth.deleteOne({

            key: sessionId + ":" + key

        });

    }

    const creds = await readData("creds") || {};

    return {

        state: {

            creds,

            keys: {

                get: async (type, ids) => {

                    const data = {};

                    for (const id of ids) {

                        const value =
                            await readData(type + ":" + id);

                        if (value) data[id] = value;

                    }

                    return data;

                },

                set: async (data) => {

                    for (const type in data) {

                        for (const id in data[type]) {

                            await writeData(

                                data[type][id],

                                type + ":" + id

                            );

                        }

                    }

                }

            }

        },

        saveCreds: async () => {

            await writeData(creds, "creds");

        }

    };

}

module.exports = useMongoAuthState;
