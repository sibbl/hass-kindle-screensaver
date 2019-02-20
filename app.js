const express = require("express"),
    stylus = require("stylus"),
    nib = require("nib"),
    path = require("path"),
    CronJob = require("cron").CronJob,
    config = require("./config"),
    render = require("./src/render").render,
    createImage = require("./src/image").createImage;

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

app.get("/cover", render);

let battery = -1;
createImage(battery);

new CronJob({
    cronTime: "* * * * *",
    onTick: () => createImage(battery),
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
