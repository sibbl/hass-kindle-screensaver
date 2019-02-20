module.exports = {
    timezone: process.env.MOMENT_TIMEZONE || "Europe/London",
    language: process.env.MOMENT_LANGUAGE || "en-US",
    homeassistant: {
        host: process.env.HA_HOST,
        port: process.env.HA_PORT,
        token: process.env.HA_TOKEN,
        password: process.env.HA_PASSWORD,
        ignoreCert: process.env.HA_IGNORE_CERT === true
    },
    entities: {
        temperature: process.env.HA_ENTITY_TEMPERATURE,
        weather: process.env.HA_ENTITY_WEATHER
    },
    rendering: {
        screenSize: {
            width: 600,
            height: 800
        },
        defaultWhiteBackground: true
    },
    port: process.env.PORT || 5000,
    server: process.env.SERVER || "http://localhost:5000"
};