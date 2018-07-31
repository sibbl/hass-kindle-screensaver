var express = require('express'),
    stylus = require('stylus'),
    nib = require('nib'),
    q = require('q'),
    request = require('request'),
    fs = require('fs'),
    path = require('path'),
    gm = require('gm'),
    moment = require('moment-timezone'),
    webshot = require('webshot'),
    xml2js = require('xml2js'),
    xmlParser = new xml2js.Parser(),
    CronJob = require('cron').CronJob;

var config = {
    defaultLanguage: 'de-DE',
    defaultTimezone: 'Europe/Berlin',
    netatmoDeviceId: '70:ee:50:2b:2c:cc',
    netatmoAuthUrl: 'https://api.netatmo.com/oauth2/token',
    netatmoAuthCredentials: require('./oauthData.json'),
    netatmoTemperatureModuleId: '02:00:00:2b:21:64',
    netatmoHistoryUrl: 'https://app.netatmo.net/api/getmeasure',
    weatherProForecastUrl: 'http://windows.weatherpro.meteogroup.de/weatherpro/WeatherFeed.php?lid=18228265',
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

var getForecast = function () {
    var def = q.defer();
    request(config.weatherProForecastUrl, function (error, response, body) {
        if (error || response.statusCode != 200) {
            def.reject('error getting forecast', error, response.body);
        } else {
            xmlParser.parseString(body, function (err, result) {
                if (err) {
                    def.reject("error parsing forecast xml", err);
                } else {
                    var result = result.WeatherServiceResponse.forecast[0].hours[0].hour.map(function (item) {
                        return [
                            moment(item['$'].time).unix(), +item['$'].tt
                        ];
                    });
                    def.resolve(result);
                }
            });
        }
    });
    return def.promise;
}

var getTemperatureHistory = function () {
    var beginDate = moment().startOf('day').add(-1, 'day').add(config.temperatureChartBeginDayTime);
    var endDate = moment().startOf('day').add(-1, 'day').add(config.temperatureChartEndDateTime);
    var def = q.defer();
    getNetatmoAccessToken().then(function (token) {
        var data = {
            form: {
                device_id: config.netatmoDeviceId,
                module_id: config.netatmoTemperatureModuleId,
                type: 'Temperature',
                access_token: token,
                date_begin: beginDate.format('X'),
                date_end: endDate.format('X'),
                scale: 'max'
            }
        };
        request.post(config.netatmoHistoryUrl, data, function (error, response, body) {
            if (error || response.statusCode != 200) {
                console.error("error getting temp history", error, response.body);
                def.reject('error getting temp history', error, response.body);
            } else {
                var json = JSON.parse(body);
                var history = [];
                for (var i in json.body) {
                    var time = moment.unix(json.body[i].beg_time).add(1, 'day');
                    var stepTime = json.body[i].step_time;
                    for (var k in json.body[i].value) {
                        history.push([parseInt(time.format('x')), json.body[i].value[k][0]]);
                        time.add(stepTime, 'seconds');
                    }
                }
                def.resolve(history);
            }
        });
    });
    return def.promise;
}

var getCurrentTemperature = function () {
    var def = q.defer();
    getNetatmoAccessToken().then(function (token) {
        var data = {
            form: {
                device_id: config.netatmoDeviceId,
                module_id: config.netatmoTemperatureModuleId,
                type: 'Temperature',
                access_token: token,
                date_begin: moment().subtract(1, 'hour').format('X'),
                date_end: moment().format('X'),
                scale: 'max'
            }
        };
        request.post(config.netatmoHistoryUrl, data, function (error, response, body) {
            if (error || response.statusCode != 200) {
                console.error("error getting current temp", error, response.body);
                def.reject('error getting current temp', error, response.body);
            } else {
                var json = JSON.parse(body);
                var temperature = json.body[json.body.length - 1].value[json.body[json.body.length - 1].value.length - 1][0];
                def.resolve(temperature);
            }
        });
    });
    return def.promise;
}

var getNetatmoAccessToken = function () {
    if (tokenPromise != undefined) {
        return tokenPromise;
    }
    var def = q.defer();
    var data = {
        form: config.netatmoAuthCredentials
    };
    data.form.grant_type = 'password';
    request.post(config.netatmoAuthUrl, data, function (error, response, body) {
        if (error || response.statusCode != 200) {
            def.reject('error getting netatmo access token', error, response.body);
        } else {
            var json = JSON.parse(body);
            if (json != undefined && json.error != undefined) {
                def.reject('error getting netatmo access token with message', json.error);
            } else {
                def.resolve(json.access_token);
            }
        }
    });

    tokenPromise = def.promise;
    return tokenPromise;
}

var generateVars = function () {
    var def = q.defer();

    q.all([
        getCurrentTemperature(),
        getForecast(),
        getTemperatureHistory()
    ]).spread(function (temp, forecast, tempHistory) {
        var time = moment().format('L LT');
        var chartBeginDate = moment().startOf('day').add(config.temperatureChartBeginDayTime);
        var chartEndDate = moment().startOf('day').add(config.temperatureChartEndDateTime);
        def.resolve({
            time: time,
            temperature: temp,
            temperatureHistory: tempHistory,
            chartBeginDate: chartBeginDate,
            chartEndDate: chartEndDate,
            forecast: forecast,
            config: config
        });
    }).done();

    return def.promise;
}

var app = express();

function compile(str, path) {
    return stylus(str)
        .set('filename', path)
        .use(nib());
}

moment.tz.setDefault(config.defaultTimezone);
moment.locale(config.defaultLanguage);
app.locals.moment = moment;
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(stylus.middleware({
    src: __dirname + '/public',
    compile: compile
}));
app.set('port', config.port);
app.use(express.static(__dirname + '/public'));

app.get('/cover', function (request, response) {
    generateVars().then(function (replaceVars) {
        var battery = (!isNaN(+request.query.battery)) ? Math.max(0, Math.min(+request.query.battery, 100)) : 100;
        replaceVars.battery = battery;
        if (battery < 10) {
            //TODO: notify someone about this!!!
        }
        response.render('cover', replaceVars);
    });
});

let battery = -1;

const createImage = () => {
    var url = config.server + '/cover?battery=' + battery;
    webshot(url, 'converted.png', renderOptions, function (err) {
        if (err == null) {
            gm('converted.png')
                .options({
                    imageMagick: true
                })
                .type('GrayScale')
                .bitdepth(8)
                .write('cover.png', function (err) {
                    if (err) return console.error(err);
                });
        } else {
            console.error("Could not create image", err);
        }
    });
}
createImage();

new CronJob({
    cronTime: "* * * * *",
    onTick: createImage,
    start: true
});

app.get('/', function (request, response) {
    if(!isNaN(request.query.battery)) {
        battery = request.query.battery;
    }
    response.status(200).sendFile(path.join(__dirname, 'cover.png'));
});

app.listen(app.get('port'), function () {
    console.log("Node app is running at localhost:" + app.get('port'));
})