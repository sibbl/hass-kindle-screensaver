const React = require("react");
const moment = require("moment");

const {
    ComposedChart,
    XAxis,
    YAxis,
    Area,
    CartesianGrid,
    Line
} = require("recharts");

class Cover extends React.Component {
    render() {
        const {
            config,
            forecast,
            temperatureHistory,
            battery,
            temperature,
            timestamp
        } = this.props;

        const time = moment(timestamp).format("L LT");
        moment.tz.setDefault(config.defaultTimezone);
        moment.locale(config.defaultLanguage);

        const chartBeginDate = moment()
            .startOf("day")
            .add(config.temperatureChartBeginDayTime)
            .toDate();
        const chartEndDate = moment()
            .startOf("day")
            .add(config.temperatureChartEndDateTime)
            .toDate();

        const ticks = [];
        let tickDate = moment(chartBeginDate);
        while (tickDate < chartEndDate) {
            tickDate = tickDate.add(6, "hours");
            ticks.push(tickDate.toDate());
        }

        const minForecastTemperature = Math.min(
            ...forecast.map(x => x.temperature)
        );
        const minHistoricTemperature = Math.min(
            ...temperatureHistory.map(x => x.temperature)
        );
        const minTemperature = Math.floor(
            Math.min(0, minForecastTemperature - 1, minHistoricTemperature - 1)
        );

        return (
            <html>
                <head>
                    <link rel="stylesheet" href="/css/style.css" />
                </head>

                <body>
                    <div className="temperature">
                        <span>{temperature}</span>
                        <span className="unit">°C</span>
                    </div>
                    <div className="time">{time}</div>
                    <ComposedChart
                        className="chart"
                        width={600}
                        height={350}
                        margin={{ top: 10, left: 10, right: 10, bottom: 10 }}
                    >
                        <XAxis
                            type="number"
                            dataKey="time"
                            domain={[+chartBeginDate, +chartEndDate]}
                            ticks={ticks}
                            scale="time"
                            allowDataOverflow={true}
                            tickFormatter={time => moment(time).format("HH:mm")}
                        />
                        <YAxis
                            dataKey="temperature"
                            domain={[minTemperature, "auot"]}
                            tickFormatter={val => `${val} °C`}
                        />
                        <CartesianGrid stroke="#f5f5f5" />
                        <Area
                            type="monotone"
                            dataKey="temperature"
                            data={temperatureHistory.map(x => {
                                x.temperature = [minTemperature, x.temperature];
                                return x;
                            })}
                            domain={[-500, "auto"]}
                            fill="rgba(128,128,128,0.5)"
                            stroke={null}
                        />
                        <Line
                            type="monotone"
                            dataKey="temperature"
                            data={forecast}
                            dot={false}
                            stroke="#000"
                            strokeWidth={3}
                        />
                    </ComposedChart>
                    <div className="battery" style={{ style: battery + "%" }} />
                </body>
            </html>
        );
    }
}

module.exports = Cover;
