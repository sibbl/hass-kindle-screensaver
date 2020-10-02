const webshot = require("node-webshot"),
    gm = require("gm"),
    config = require("../config");

const createImage = (battery) => {
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

module.exports = {
    createImage
};
