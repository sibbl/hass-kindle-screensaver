module.exports = {
    timezone: "Europe/Berlin",
    language: "de-DE",
    homeassistant: {
        host: process.env.HA_HOST,
        port: process.env.HA_PORT,
        token: process.env.HA_TOKEN,
        password: process.env.HA_PASSWORD,
        ignoreCert: process.env.HA_IGNORE_CERT === true
    },
    entities: {
        temperature: "sensor.netatmo_outdoor_temperature",
        weather: "weather.openweathermap"
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