var express = require('express'),
    svgexport = require('svgexport'),
    fs = require('fs'),
    gm = require('gm');

var defaultPort = 5000;

var filenames = {
    'svgsource': 'input.svg',
    'pngdestination': 'cover.png'
}

var generateVars = function() {
    return {
        'testvar': parseInt(Math.random() * 1000000)
    };
}

var app = express();

app.set('port', (process.env.PORT || defaultPort));
app.use(express.static(__dirname + '/public'));

app.get('/', function(request, response) {

    fs.readFile(filenames.svgsource, 'utf8', function(err, data) {
        if (err) {
            return console.log(err);
        }
        var result = data;
        var replaceVars = generateVars();
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
                            response.status(200).sendfile(filenames.pngdestination);
                            console.log('done');
                            fs.unlinkSync('converted.png');
                            fs.unlinkSync('input_filled.svg');
                        });
                }
            });
        });
    });
});

app.listen(app.get('port'), function () {
    console.log("Node app is running at localhost:" + app.get('port'));
})