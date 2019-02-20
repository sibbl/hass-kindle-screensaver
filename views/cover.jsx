import React from "react";
import moment from "moment";
import BatteryIndicator from "./components/battery-indicator";
import HistoricGraph from "./components/historic-graph";
import Temperature from "./components/temperature";

class Cover extends React.Component {
    render() {
        const {
            config,
            battery,
            temperature,
            timestamp,
            weather,
            temperatureHistory,
            temperatureHistoryToday,
            temperatureHistoryYesterday,
            chartRange,
            now
        } = this.props;

        moment.tz.setDefault(config.timezone);
        moment.locale(config.language);

        const time = moment(timestamp).format("L LT");

        return (
            <html>
                <head>
                    <link rel="stylesheet" href="/css/style.css" />
                </head>

                <body>
                    <Temperature value={parseFloat(temperature.state)} unit={temperature.attributes.unit_of_measurement} />
                    <div className="time">{time}</div>
                    <HistoricGraph weather={weather} temperatureHistory={temperatureHistory} temperatureHistoryToday={temperatureHistoryToday} temperatureHistoryYesterday={temperatureHistoryYesterday} chartRange={chartRange} now={now} />
                    <BatteryIndicator batteryLevel={battery} />
                </body>
            </html>
        );
    }
}

module.exports = Cover;
