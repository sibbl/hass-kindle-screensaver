# Home Assistant Kindle Screensaver
 
This tool can be used to display an overview of your Home Assistant instance on e.g. a [jailbroken](https://www.mobileread.com/forums/showthread.php?t=236104) Kindle device.
 
It currently shows the current temperature and renders the history of the last 24hrs and the forecast of a weather component in a graph.
 
Every minute, an image is generated from a website which is rendered by react. This image is converted into a format, which the Kindle e-ink screens can display. The device can then download the device and display it.
 
 ## Demo
 
 ![Demo Screenshot](../assets/screenshot.png?raw=true)
 
 ## Usage
 
 You may simple set up the [sibbl/hass-kindle-screensaver](https://hub.docker.com/r/sibbl/hass-kindle-screensaver) docker container. It runs the server on port 5000 and can be configured using the following environment variables:
 
 * `HA_HOST=https://your-hass-instance.com`
 * `HA_PORT=443`
 * `HA_TOKEN=eyJ0...` (you need to create this token in Home Assistant first)
 * `HA_ENTITY_TEMPERATURE=sensor.outdoor_temperature` (state of this entity is displayed as current temperature)
 * `HA_ENTITY_WEATHER=weather.openweathermap` (temperature and forecast attributes of this entity are used in the graph)
 * `MOMENT_TIMEZONE=Europe/London` (used for date/time calculations)
 * `MOMENT_LANGUAGE=en-US` (used for date/time formatting)
 
