# Homebridge Plugin for Tado Smart Thermostats

A platform that exposes all Tado Smart Thermostats to HomeKit via [Homebridge](https://github.com/nfarina/homebridge) with additional modes like Heat, Cool, Off and Automatic mode.

## Why do we need this plugin?

Because, native Tado exposes a thermostat with the possiblity to adjust ONLY the temperature value for heating and the power mode (On/Off).

With this plugin, you can set several modes, like:

 - Heat
 - Cool
 - OFF
 - Automatic
 
 and adjust also the "cool" and "heat" temperature. 
 
 
With the states "Heat" and "Cool" you can heat up or cool down to a certain temperature, which is set in the configuration (coolValue, heatValue)

With the "Automatic" state you remove the "manual" control of the thermostat and setting it back to the automatic mode

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
    "heatValue": 5,
    "coolValue": 3
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
| heatValue | No | Value for the "Heat" mode. Example: a value of 4 will heat up the room to (Current Room Temperature) + 4 degrees|
| coolValue | No | Value for the "Cool" mode. Example: a value of 4 will cool down the room to (Current Room Temperature) - 4 degrees |


## Known issues | TODO

- At the moment, only "Celsius" is supported
- Better polling handling


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
