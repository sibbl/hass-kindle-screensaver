const express = require("express"),
    stylus = require("stylus"),
    nib = require("nib"),
    fetch = require("node-fetch"),
    path = require("path"),
    gm = require("gm"),
    moment = require("moment-timezone"),
    webshot = require("webshot"),
    XML = require("pixl-xml"),
    CronJob = require("cron").CronJob,
    { URLSearchParams } = require("url");

const config = {
    defaultLanguage: "de-DE",
    defaultTimezone: "Europe/Berlin",
    netatmoDeviceId: "70:ee:50:2b:2c:cc",
    netatmoAuthUrl: "https://api.netatmo.com/oauth2/token",
    netatmoAuthCredentials: require("./oauthData.json"),
    netatmoTemperatureModuleId: "02:00:00:2b:21:64",
    netatmoHistoryUrl: "https://app.netatmo.net/api/getmeasure",
    weatherProForecastUrl:
        "http://windows.weatherpro.meteogroup.de/weatherpro/WeatherFeed.php?lid=18228265",
    temperatureChartBeginDayTime: {
        hours: 2
    },
    temperatureChartEndDateTime: {
        days: 1,
        hours: 5
    },
    port: process.env.PORT || 5000,
    server: process.env.SERVER || "http://localhost:5000"
};

var tokenPromise;

var renderOptions = {
    screenSize: {
        width: 600,
        height: 800
    },
    defaultWhiteBackground: true
};

const getFormData = jsonObject => {
    return Object.entries(jsonObject).reduce((params, [key, value]) => {
        params.append(key, value);
        return params;
    }, new URLSearchParams());
};

const getForecast = async () => {
    const response = await fetch(config.weatherProForecastUrl);
    if (response.status != 200) {
        const body = await response.text();
        throw new Error(
            `Error getting forecast: ${response.status} ${
                response.statusText
            }: ${body}`
        );
    }
    const body = await response.text();

    const xmlDoc = XML.parse(body);

    return xmlDoc.forecast.hours.hour.map(item => {
        return [moment(item.time).unix(), +item.tt];
    });
};

const getTemperatureHistory = async () => {
    var beginDate = moment()
        .startOf("day")
        .add(-1, "day")
        .add(config.temperatureChartBeginDayTime);
    var endDate = moment()
        .startOf("day")
        .add(-1, "day")
        .add(config.temperatureChartEndDateTime);

    const token = await getNetatmoAccessToken();
    const formData = getFormData({
        device_id: config.netatmoDeviceId,
        module_id: config.netatmoTemperatureModuleId,
        type: "Temperature",
        access_token: token,
        date_begin: beginDate.format("X"),
        date_end: endDate.format("X"),
        scale: "max"
    });

    const response = await fetch(config.netatmoHistoryUrl, {
        method: "POST",
        body: formData
    });
    if (response.status != 200) {
        const body = await response.text();
        throw new Error(
            `Error getting temperature history: ${response.status} ${
                response.statusText
            }: ${body}`
        );
    }
    const json = await response.json();

    const history = [];

    json.body.forEach(item => {
        var time = moment.unix(item.beg_time).add(1, "day");
        var stepTime = item.step_time;
        item.value.forEach(value => {
            history.push([parseInt(time.format("x")), value[0]]);
            time.add(stepTime, "seconds");
        });
    });

    return history;
};

const getCurrentTemperature = async () => {
    const token = await getNetatmoAccessToken();

    const formData = getFormData({
        device_id: config.netatmoDeviceId,
        module_id: config.netatmoTemperatureModuleId,
        type: "Temperature",
        access_token: token,
        date_begin: moment()
            .subtract(1, "hour")
            .format("X"),
        date_end: moment().format("X"),
        scale: "max"
    });

    const response = await fetch(config.netatmoHistoryUrl, {
        method: "POST",
        body: formData
    });
    if (response.status != 200) {
        const body = await response.text();
        throw new Error(
            `Error getting current temperature: ${response.status} ${
                response.statusText
            }: ${body}`
        );
    }

    const json = await response.json();
    return json.body[json.body.length - 1].value[
        json.body[json.body.length - 1].value.length - 1
    ][0];
};

const getNetatmoAccessToken = async () => {
    if (tokenPromise !== undefined) {
        return tokenPromise;
    }

    const formData = getFormData({
        ...config.netatmoAuthCredentials,
        grant_type: "password"
    });

    const response = await fetch(config.netatmoAuthUrl, {
        method: "POST",
        body: formData
    });

    if (response.status != 200) {
        const body = await response.text();
        throw new Error(
            `Error getting netatmo access token: ${response.status} ${
                response.statusText
            }: ${body}`
        );
    }

    const json = await response.json();

    if (json != undefined && json.error != undefined) {
        throw new Error(
            "Error getting netatmo access token with message: " + json.error
        );
    }

    // reset every hour
    setTimeout(() => {
        tokenPromise = undefined;
    }, 1000 * 60 * 60);
    return json.access_token;
};

const generateVars = async () => {
    let temp, forecast, tempHistory;
    try {
        [temp, forecast, tempHistory] = await Promise.all([
            getCurrentTemperature(),
            getForecast(),
            getTemperatureHistory()
        ]);
    }catch(err) {
        console.error(`Failed to retrieve content: ${err}`);
        return false;
    }
    const time = moment().format("L LT");
    const chartBeginDate = moment()
        .startOf("day")
        .add(config.temperatureChartBeginDayTime);
    const chartEndDate = moment()
        .startOf("day")
        .add(config.temperatureChartEndDateTime);
    return {
        time: time,
        temperature: temp,
        temperatureHistory: tempHistory,
        chartBeginDate: chartBeginDate,
        chartEndDate: chartEndDate,
        forecast: forecast,
        config: config
    };
};

const app = express();

const compile = (str, filename) => {
    return stylus(str)
        .set("filename", filename)
        .use(nib());
}

moment.tz.setDefault(config.defaultTimezone);
moment.locale(config.defaultLanguage);
app.locals.moment = moment;
app.set("views", __dirname + "/views");
app.set("view engine", "jade");
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
    renderParams.battery = battery;

    if (battery < 10) {
        //TODO: notify someone about this!
    }

    response.render("cover", renderParams);
});

let battery = -1;

const createImage = () => {
    const url = `${config.server}/cover?battery=${battery}`;
    webshot(url, "converted.png", renderOptions, (err) => {
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
