# homebridge-tado-thermostat v2.2

[![npm](https://img.shields.io/npm/v/homebridge-tado-thermostat-plugin.svg?style=flat-square)](https://www.npmjs.com/package/homebridge-tado-thermostat-plugin)
[![npm](https://img.shields.io/npm/dt/homebridge-tado-thermostat-plugin.svg?style=flat-square)](https://www.npmjs.com/package/homebridge-tado-thermostat-plugin)
[![GitHub last commit](https://img.shields.io/github/last-commit/SeydX/homebridge-tado-thermostat.svg?style=flat-square)](https://github.com/SeydX/homebridge-tado-thermostat)

# Homebridge plugin for Tado Smart Thermostats

This homebridge plugin exposes Tado thermostats, occupancy sensors, weather sensors and contact (window) sensors to Apple's HomeKit. It provides following features:

**Thermostats:**
- Additional modes: Heat, Cool, Auto and Off
- Secure temperature setting (temperature setting only possible in heat or cool mode)
- Auto heat/cool to a certain value (configurable in config.json)
- Battery state and notification if battery is low
- Built-in humidity sensor
- Delay timer: You can set up a timer as delay for your thermostats to wait a certain time to go back to the automatic mode (Helpful in automations where you shut off the thermostat after window is opened and in automatic mode if window is closed. So this timer let the thermostat wait a certain time in off mode before going back to auto mode. Helpful if you open the window only for a few minutes)
- Elgato EVE history feature (Fakegato)

**Occupancy sensors:**
- If enabled in config.json **AND** under the settings in the tado app (geotracking) this plugin will create occupancy/motion sensors for all registred persons (configurable in the tado app).
- In addition to this, it will create an "Anyone" sensor too, to create automations based on "Anyone at home / not at home"
- Elgato EVE history feature (Fakegato)

**Weather sensors:**
- If enabled in config.json, this plugin will create a weather sensor for your location based on tado.
- Weather Service: If enabled in config.json, this plugin creates a Service to expose the current weather state (Sunny, Cloudy, Rainy etc.) to **Elgato EVE** app
- Elgato EVE history feature (Fakegato)

**Window sensors:**
- If enabled in config.json **AND** under the setting in the tado app (open window detection), this plugin creates windows sensors for each room.

**Central Switch:**
- If enabled in config.json this plugin creates a central switch to turning off/on all thermostats together with just one click!
- Turning on the switch means, turning off ALL Thermostats
- Turnun off the switch means, turning ALL Thermostats into automatic mode!

See [Images](https://github.com/SeydX/homebridge-tado-thermostat/tree/master/images/) for more details.


## Installation instructions

After [Homebridge](https://github.com/nfarina/homebridge) has been installed:

 ```sudo npm install -g homebridge-tado-thermostat-plugin```
 
 
 ## Example config.json:

 ```
{
  "bridge": {
      ...
  },
  "platforms": [
    {
    "platform":"TadoThermostat",
    "name":"Thermostat",
    "username":"TadoUserName",
    "password":"TadoPassword",
    }
  ]
}
```

 ## Advanced config.json:

 ```
{
  "bridge": {
      ...
  },
  "platforms": [
    {
    "platform": "TadoThermostat",
    "name": "Thermostat",
    "username": "TadoUsername",
    "password": "TadoPassword",
    "heatValue": 5,
    "coolValue": 5,
    "delayTimer": 0,
    "weatherEnabled": true,
    "weatherServiceEnabled": false,
    "occupancyEnabled": false,
    "windowDetection": false,
    "centralSwitch": false
    }
  ]
}
```
See [Example Config](https://github.com/SeydX/homebridge-tado-thermostat/edit/master/config-example.json) for more details.


## Options

| Attributes | Required | Usage |
|------------|----------|-------|
| name | no | Name for the Thermostat. Will be used as part of the accessory name.  |
| username | **Yes** | Tado Login Username |
| password | **Yes** | Tado Login Password |
| heatValue | No | Value for the "Heat" mode. Example: a value of 4 will heat up the room to **Current Room Temperature + 4 degrees** (Default: 4) |
| coolValue | No | Value for the "Cool" mode. Example: a value of 4 will cool down the room to **Current Room Temperature - 4 degrees** (Default: 4) |
| delaytimer | No | Delay for setting the thermostat back in automatic mode (Default: 0 == not enabled) |
| weatherEnabled | No | Exposes temperature sensors for your location based on tado (Default: false) | |
| weatherServiceEnabled | No | Enable Service to check for weather state, eg. cloudy, sunny, clear etc. Only with Elgato EVE app! (Default: false) |
| occupancyEnabled | No | Exposes occupancy/motion sensors for all registred persons (only if geotracking is enabled in tado! - Default: false) | |
| windowDetection | No | Exposes window sensors for each room (only if open weather detection is enabled in tado! - Default: false) |
| centralSwitch | No | Exposes a switch to turning on/off all thermostats with just one click! (Default: false) |


## W.I.P features

- [x] Fakegato
- [x] Weather Sensor
- [x] Occupancy Sensor
- [x] Weather State Service
- [x] Central switch to put all thermostats in off/on mode
- [ ] Hot Water
- [ ] Dynamic Platform


## Contributing

You can contribute to this homebridge plugin in following ways:

- [Report issues](https://github.com/SeydX/homebridge-tado-thermostat/issues) and help verify fixes as they are checked in.
- Review the [source code changes](https://github.com/SeydX/homebridge-tado-thermostat/pulls).
- Contribute bug fixes.
- Contribute changes to extend the capabilities

Pull requests are accepted.


## Credits

This plugin was initially forked from and inspired by [homebridge-tado-ac](https://github.com/nitaybz/homebridge-tado-ac) by @nitaybz
