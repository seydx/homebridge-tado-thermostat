# Homebridge Plugin for Tado Smart Thermostats

A platform that expose all Tado Smart Thermostats to HomeKit via [Homebridge](https://github.com/nfarina/homebridge) with additional modes like Heat, Cool, Off, Automatic mode and integrated battery information. Also able to expose weather temperature sensor or occupancy sensors with FakeGato ability.

## Why do we need this plugin?

Because, native Tado expose only thermostats with the possiblity to adjust the temperature value for heating and the power mode (On/Off).

With this plugin, you can set several modes, like:

 - Heat
 - Cool
 - OFF
 - Automatic
 
 and adjust also the "cool" and "heat" temperature. 
 
 
With the states "Heat" and "Cool" you can heat up or cool down to a certain temperature, which is set in the configuration (coolValue, heatValue)

With the "Automatic" state you remove the "manual" control of the thermostat and setting it back to the automatic mode

The thermostats will also show the current battery state.

It can also expose weather temperature sensor, weather service to detect if weather is i.e. clear or cloudy etc. (tested with EVE app) and occupancy sensors.

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
    "weatherServiceEnabled": true,
    "occupancyEnabled": true
    }
  ]
}
```
See [Example Config](https://github.com/SeydX/homebridge-tado-thermostat/edit/master/config-example.json) for more details.


## Options

| Attributes | Required | Usage |
|------------|----------|-------|
| name | no | Name for the Thermostat. Will be used as part of the accessory name.  |
| username | Yes | Tado Login Username |
| password | Yes | Tado Login Password |
| heatValue | No | Value for the "Heat" mode. Example: a value of 4 will heat up the room to **Current Room Temperature + 4 degrees** (Default: 4) |
| coolValue | No | Value for the "Cool" mode. Example: a value of 4 will cool down the room to **Current Room Temperature - 4 degrees** (Default: 4) |
| delaytimer | No | Delay for setting the thermostat back in automatic mode (Default: 0 == not enabled) |
| weatherEnabled | No | Enable Outside Temperature sensor (Default: false) |
| weatherServiceEnabled | No | Enable Service to check for weather state, eg. cloudy, sunny, clear etc. NOT compatible with the Apple Home app! (Default: false) |
| occupancyEnabled | No | Enable Occupancy sensor for registred Tado users (Default: false) |


## Known issues | TODO

- [x] Rewrite
- [x] Better Error handling
- [x] Fakegato
- [x] Weather Sensor
- [x] Occupancy Sensor
- [x] Weather State Service
- [x] long polling
- [ ] Issue: Motion sensor last activity bug
- [ ] Better error handling
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

Thanks to @grover for this beatiful ReadMe template


## MIT License

Copyright (c) 2017 SeydX

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
