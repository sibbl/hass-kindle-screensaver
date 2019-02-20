const config = require("../config"),
    fetchData = require("./connection").fetchData;

let lastRenderParams;

const render = async (request, response) => {
    let renderParams = await fetchData();

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
};

module.exports = {
    render
};
