const config = require("../config"),
  moment = require("moment"),
  homeassistant = require("homeassistant"),
  cropTimeseriesArray = require("./utils").cropTimeseriesArray;

const hass = new homeassistant(config.homeassistant);
const HASS_ISO_STRING_FORMAT = "YYYY-MM-DDTHH:mm:ssZ";

const fetchData = async () => {
  moment.tz.setDefault(config.timezone);
  moment.locale(config.language);

  const now = moment();
  const chartBeginDate = now.clone().add(-12, "hours");
  const yesterdayDate = now.clone().add(-24, "hours");
  const chartEndDate = now.clone().add(12, "hours");

  let temperature,
    weather = [],
    temperatureHistory = [],
    temperatureHistoryToday = [],
    temperatureHistoryYesterday = [];
  try {
    const [
      temperatureRaw,
      temperatureHistoryRaw,
      weatherHistoryRaw,
    ] = await Promise.all([
      hass.states.get(...config.entities.temperature.split(".")),
      hass.history.state(
        yesterdayDate.format(HASS_ISO_STRING_FORMAT),
        config.entities.temperature,
        now.format(HASS_ISO_STRING_FORMAT)
      ),
      hass.history.state(
        yesterdayDate.format(HASS_ISO_STRING_FORMAT),
        config.entities.weather,
        now.format(HASS_ISO_STRING_FORMAT)
      ),
    ]);
    temperature = temperatureRaw;

    temperatureHistory = temperatureHistoryRaw[0].map(
      ({ last_updated, state }) => {
        return {
          time: moment(last_updated),
          value: parseFloat(state),
        };
      }
    );

    temperatureHistoryToday = cropTimeseriesArray(
      temperatureHistory,
      chartBeginDate,
      now
    );

    temperatureHistoryYesterday = cropTimeseriesArray(
      temperatureHistory,
      yesterdayDate,
      chartBeginDate
    ).map((x) => {
      x.time = x.time.add(24, "hours");
      return x;
    });

    const weatherHistory = weatherHistoryRaw[0].map(
      ({ attributes: { temperature }, last_updated }) => ({
        time: moment(last_updated),
        value: parseFloat(temperature),
      })
    );

    const lastWeatherEvent =
      weatherHistoryRaw[0][weatherHistoryRaw[0].length - 1];

    const weatherForecast = lastWeatherEvent.attributes.forecast.map(
      ({ datetime, temperature }) => {
        return {
          time: moment(datetime),
          value: temperature,
        };
      }
    );

    weather = weatherHistory.concat(weatherForecast);
  } catch (err) {
    console.error(`Failed to retrieve content: ${err}`);
    return false;
  }

  return {
    timestamp: new Date(),
    temperature,
    temperatureHistory: temperatureHistory.filter(
      ({ time }) => time >= yesterdayDate && time < chartEndDate
    ),
    temperatureHistoryToday,
    temperatureHistoryYesterday,
    weather,
    now,
    chartRange: [chartBeginDate, chartEndDate],
  };
};

module.exports = {
  fetchData,
};
