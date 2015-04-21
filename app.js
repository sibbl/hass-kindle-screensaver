var express = require('express'),
    q = require('q'),
    request = require('request'),
    svgexport = require('svgexport'),
    fs = require('fs'),
    path = require('path'),
    gm = require('gm'),
    moment = require('moment-timezone');

var defaultPort = 5000;

var filenames = {
    'svgsource': 'input.svg',
    'pngdestination': 'cover.png'
}

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

    q.all([getTemperature()]).spread(function(temp) {
        def.resolve({
            'time': moment.tz('Europe/Berlin').format('D.MM.YYYY HH:mm'),
            'temp': temp
        });
    }).done();
    
    return def.promise;
}

var app = express();

app.set('port', (process.env.PORT || defaultPort));
app.use(express.static(__dirname + '/public'));

app.get('/', function(request, response) {
    fs.readFile(filenames.svgsource, 'utf8', function(err, data) {
        if (err) {
            return console.log(err);
        }
        generateVars().then(function(replaceVars) {
            var result = data;
            for (var i in replaceVars) {
                result = result.replace(new RegExp('%' + i + '%', 'g'), replaceVars[i]);
            }

            fs.writeFile('input_filled.svg', result, 'utf8', function(err) {
                if (err) return console.log(err);

                svgexport.render({
                    "input": "input_filled.svg",
                    "output": "converted.png"
                }, function(a) {
                    if (a == 0) {
                        gm('converted.png')
                            .options({ imageMagick: true })
                            .type('GrayScale')
                            .bitdepth(8)
                            .write(filenames.pngdestination, function(err) {
                                if (err) return console.log(err);
                                response.status(200).sendFile(path.join(__dirname, filenames.pngdestination));
                                fs.unlinkSync('converted.png');
                                fs.unlinkSync('input_filled.svg');
                            });
                    }
                });
            });
        });
    });
});

app.listen(app.get('port'), function () {
    console.log("Node app is running at localhost:" + app.get('port'));
})