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

var generateVars = function () {
    var def = q.defer();
    request("https://api.forecast.io/forecast/d382a86ed6a0677340258ab891d8097c/51.0211287,13.7511783", function (error, response, body) {
        if (error || response.statusCode != 200) {
            def.reject('something bad happened');
        } else {
            def.resolve({
                'time': moment.tz('Europe/Berlin').format('D.MM.YYYY HH:mm'),
                'temp': parseInt((JSON.parse(body).currently.temperature - 32) * 5 / 9)
            });
        }
    });
    
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