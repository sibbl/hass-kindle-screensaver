const express = require("express"),
    stylus = require("stylus"),
    nib = require("nib"),
    path = require("path"),
    gm = require("gm"),
    moment = require("moment"),
    webshot = require("webshot"),
    CronJob = require("cron").CronJob,
    config = require("./config.js"),
    homeassistant = require("homeassistant"),
    hass = new homeassistant(config.homeassistant),
    { cropTimeseriesArray } = require("./utils");

const HASS_ISO_STRING_FORMAT = "YYYY-MM-DDTHH:mm:ssZ";

const generateVars = async () => {
    moment.tz.setDefault(config.timezone);
    moment.locale(config.language);

    const now = moment();
    const chartBeginDate = now.clone().add(-12, "hours");
    const yesterdayDate = now.clone().add(-24, "hours");
    const chartEndDate = now.clone().add(12, "hours");

    let temperature,
        weather = [],
        temperatureHistory = [],
        temperatureHistoryToday = [],
        temperatureHistoryYesterday = [];
    try {
        const [
            temperatureRaw,
            temperatureHistoryRaw,
            weatherHistoryRaw
        ] = await Promise.all([
            hass.states.get(...config.entities.temperature.split(".")),
            hass.history.state(
                yesterdayDate.format(HASS_ISO_STRING_FORMAT),
                config.entities.temperature,
                now.format(HASS_ISO_STRING_FORMAT)
            ),
            hass.history.state(
                yesterdayDate.format(HASS_ISO_STRING_FORMAT),
                config.entities.weather,
                now.format(HASS_ISO_STRING_FORMAT)
            )
        ]);
        temperature = temperatureRaw;

        temperatureHistory = temperatureHistoryRaw[0].map(event => {
            return {
                time: moment(event.last_updated),
                value: parseFloat(event.state)
            };
        });

        temperatureHistoryToday = cropTimeseriesArray(
            temperatureHistory,
            chartBeginDate,
            now
        );

        temperatureHistoryYesterday = cropTimeseriesArray(
            temperatureHistory,
            yesterdayDate,
            chartBeginDate
        ).map(x => {
            x.time = x.time.add(24, "hours");
            return x;
        });

        const lastWeatherEvent =
            weatherHistoryRaw[0][weatherHistoryRaw[0].length - 1];
        // interestingly, the weather forecast attribute also includes the history...
        weather = lastWeatherEvent.attributes.forecast.map(
            ({ datetime, temperature }) => {
                return {
                    time: moment(datetime),
                    value: temperature
                };
            }
        );
    } catch (err) {
        console.error(`Failed to retrieve content: ${err}`);
        return false;
    }

    return {
        timestamp: new Date(),
        temperature,
        temperatureHistory: temperatureHistory.filter(
            ({ time }) => time >= yesterdayDate && time < chartEndDate
        ),
        temperatureHistoryToday,
        temperatureHistoryYesterday,
        weather,
        now,
        chartRange: [chartBeginDate, chartEndDate]
    };
};

const app = express();

const compile = (str, filename) => {
    return stylus(str)
        .set("filename", filename)
        .use(nib());
};

app.set("views", __dirname + "/views");
app.set("view engine", "jsx");
app.engine("jsx", require("express-react-views").createEngine());
app.use(
    stylus.middleware({
        src: __dirname + "/public",
        compile: compile
    })
);
app.set("port", config.port);
app.use(express.static(__dirname + "/public"));

let lastRenderParams;
app.get("/cover", async (request, response) => {
    let renderParams = await generateVars();

    if (renderParams === false) {
        renderParams = {
            ...lastRenderParams,
            downloadFailed: true
        };
    } else {
        lastRenderParams = renderParams;
    }

    const battery = !isNaN(+request.query.battery)
        ? Math.max(0, Math.min(+request.query.battery, 100))
        : 100;

    if (battery < 10) {
        //TODO: notify someone about this!
    }

    response.render("cover", {
        ...renderParams,
        battery,
        config
    });
});

let battery = -1;

const createImage = () => {
    const url = `${config.server}/cover?battery=${battery}`;
    webshot(url, "converted.png", config.rendering, err => {
        if (err == null) {
            gm("converted.png")
                .options({
                    imageMagick: true
                })
                .type("GrayScale")
                .bitdepth(8)
                .write("cover.png", function(err) {
                    if (err) return console.error(err);
                });
        } else {
            console.error("Could not create image", err);
        }
    });
};
createImage();

new CronJob({
    cronTime: "* * * * *",
    onTick: createImage,
    start: true
});

app.get("/", (request, response) => {
    if (!isNaN(request.query.battery)) {
        battery = request.query.battery;
    }
    response.status(200).sendFile(path.join(__dirname, "cover.png"));
});

app.listen(app.get("port"), () => {
    console.log("Node app is running at localhost:" + app.get("port"));
});
