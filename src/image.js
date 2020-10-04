const puppeteer = require("puppeteer"),
  gm = require("gm"),
  config = require("../config");

const makeWebshotAsync = async (url) => {
  let browser = await puppeteer.launch({
    args: ["--disable-dev-shm-usage", "--no-sandbox"],
  });
  let page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle0", timeout: 10000 });
  await page.setViewport(config.rendering.screenSize);
  await page.screenshot({
    path: "converted.png",
    type: "png",
    clip: {
      x: 0,
      y: 0,
      ...config.rendering.screenSize,
    },
  });
  await page.close();
  await browser.close();
};

const createImageAsync = async (battery) => {
  const url = `${config.server}/cover?battery=${battery}`;
  try {
    await makeWebshotAsync(url);
  } catch (err) {
    console.error("Could not take screenshot", err);
  }
  gm("converted.png")
    .options({
      imageMagick: true,
    })
    .type("GrayScale")
    .bitdepth(8)
    .write("cover.png", function (err) {
      if (err) return console.error(err);
    });
};

module.exports = {
  createImageAsync,
};
