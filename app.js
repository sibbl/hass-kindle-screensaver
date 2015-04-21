var express = require('express'),
    stylus = require('stylus'),
    nib = require('nib'),
    q = require('q'),
    request = require('request'),
    fs = require('fs'),
    path = require('path'),
    gm = require('gm'),
    moment = require('moment-timezone'),
    webshot = require('webshot');

var config = {
    defaultLanguage: 'de-DE',
    defaultTimezone: 'Europe/Berlin',
    netatmoAccessToken: '52d42bfc1777599b298b456c|bce486435e378f26eb0a935cd8a557e4',
    netatmoDeviceId: '70:ee:50:03:93:60',
    netatmoTemperatureModuleId: '02:00:00:03:cf:dc',
    netatmoForecastUrl: 'https://www.netatmo.com/api/simplifiedfuturemeasure',
    netatmoHistoryUrl: 'https://www.netatmo.com/api/getmeasure',
    temperatureChartBeginDayTime: { hours: 2 },
    temperatureChartEndDateTime: { days: 1, hours: 5 },
    defaultPort: 5000
};

var renderOptions = {
    screenSize: {
        width: 600,
        height: 800
    },
    defaultWhiteBackground: true
};

var getForecast = function() {
    var def = q.defer();
    var data = {
        form: {
            device_id: config.netatmoDeviceId,
            module_id: config.netatmoTemperatureModuleId,
            access_token: config.netatmoAccessToken,
            locale: config.defaultLanguage
        }
    };
    request.post(config.netatmoForecastUrl, data, function (error, response, body) {
        if (error || response.statusCode != 200) {
            def.reject('?');
        } else {
            var json = JSON.parse(body);
            def.resolve(json.body);
        }
    });
    return def.promise;
}

var getTemperatureHistory = function() {
    var beginDate = moment().startOf('day').add(-1, 'day').add(config.temperatureChartBeginDayTime);
    var endDate = moment().startOf('day').add(-1, 'day').add(config.temperatureChartEndDateTime); 
    var def = q.defer();
    var data = {
        form: {
            device_id: config.netatmoDeviceId,
            module_id: config.netatmoTemperatureModuleId,
            type: 'Temperature',
            access_token: config.netatmoAccessToken,
            date_begin: beginDate.format('X'),
            date_end: endDate.format('X'),
            scale: 'max'
        }
    };
    request.post(config.netatmoHistoryUrl, data, function (error, response, body) {
        if (error || response.statusCode != 200) {
            def.reject('?');
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
    return def.promise;
}

var getCurrentTemperature = function() {
    var def = q.defer();
    var data = {
        form: {
            device_id: config.netatmoDeviceId,
            module_id: config.netatmoTemperatureModuleId,
            type: 'Temperature',
            access_token: config.netatmoAccessToken,
            date_begin: moment().subtract(1, 'hour').format('X'),
            date_end: moment().format('X'),
            scale: 'max'
        }
    };
    request.post(config.netatmoHistoryUrl, data, function (error, response, body) {
        if (error || response.statusCode != 200) {
            def.reject('?');
        } else {
            var json = JSON.parse(body);
            var temperature = json.body[json.body.length-1].value[json.body[json.body.length - 1].value.length-1][0];
            def.resolve(temperature);
        }
    });
    return def.promise;
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
app.use(stylus.middleware(
    {
        src: __dirname + '/public',
        compile: compile
    }
));
app.set('port', (process.env.PORT || config.defaultPort));
app.use(express.static(__dirname + '/public'));

app.get('/cover', function(request, response) {
    generateVars().then(function(replaceVars) {
        response.render('cover', replaceVars);
    });
});

app.get('/', function (request, response) {
    var url = 'http://' + request.get('host') + '/cover';
    webshot(url, 'converted.png', renderOptions, function(err) {
        if (err == null) {
            gm('converted.png')
                .options({ imageMagick: true })
                .type('GrayScale')
                .bitdepth(8)
                .write('cover.png', function(err) {
                    if (err) return console.log(err);
                    response.status(200).sendFile(path.join(__dirname, 'cover.png'));
                    fs.unlinkSync('converted.png');
                });
        } else {
            response.status(500).write('an error occured...');
        }
    });
});

app.listen(app.get('port'), function () {
    console.log("Node app is running at localhost:" + app.get('port'));
})