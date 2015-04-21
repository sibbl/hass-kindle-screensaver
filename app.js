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

var defaultPort = 5000;

var filenames = {
    'svgsource': 'input.svg',
    'pngdestination': 'cover.png'
}

var renderOptions = {
    screenSize: {
        width: 600,
        height: 800
    },
    defaultWhiteBackground: true
};

var getTemperature = function() {
    var def = q.defer();
    var data = {
        form: {
            device_id: '70:ee:50:06:94:30',
            module_id: '02:00:00:05:df:ec',
            type: 'Temperature',
            access_token: '52d42bfc1777599b298b456c|bce486435e378f26eb0a935cd8a557e4',
            date_begin: moment().subtract(1, 'hour').format('X'),
            date_end: moment().format('X'),
            scale: 'max'
        }
    };
    request.post("https://www.netatmo.com/api/getmeasure", data, function (error, response, body) {
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
        getTemperature()
    ]).spread(function (temp) {
        def.resolve({
            'time': moment.tz('Europe/Berlin').format('D.MM.YYYY HH:mm'),
            'temperature': temp
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

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(stylus.middleware(
    {
        src: __dirname + '/public',
        compile: compile
    }
));
app.set('port', (process.env.PORT || defaultPort));
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
                .write(filenames.pngdestination, function(err) {
                    if (err) return console.log(err);
                    response.status(200).sendFile(path.join(__dirname, filenames.pngdestination));
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