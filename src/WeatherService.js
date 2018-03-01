var rp = require("request-promise");
var HK_REQS = require('./Requests.js');
var inherits = require("util").inherits;

var Accessory,
    Service,
    Characteristic,
    CustomUUID = {
        WeatherService: "15473fd1-4e44-4aea-96e2-11af1809d8ad",
        WeatherCharacteristic: "08ea5ea1-372a-4a6d-bec7-1dfd6107d6f0",
    },
    WeatherService,
    WeatherCharacteristic;

class WEATHERSERVICE {

    constructor(log, config, api) {

        Accessory = api.platformAccessory;
        Service = api.hap.Service;
        Characteristic = api.hap.Characteristic;

        WeatherService = function(displayName, subtype) {
            Service.call(this, displayName, CustomUUID.WeatherService, subtype);
        };
        inherits(WeatherService, Service);

        WeatherCharacteristic = function() {
            Characteristic.call(this, "Current Weather", CustomUUID.WeatherCharacteristic);
            this.setProps({
                format: Characteristic.Formats.STRING,
                perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
            });
            this.value = this.getDefaultValue();
        };
        inherits(WeatherCharacteristic, Characteristic);

        var platform = this;

        this.api = api;
        this.log = log;
        this.config = config;
        this.name = config.name;
        this.homeID = config.homeID;
        this.username = config.username;
        this.password = config.password;

        this.get = new HK_REQS(platform.username, platform.password, platform.homeID, {
            "token": process.argv[2]
        });

    }

    getServices() {

        var accessory = this;

        this.informationService = new Service.AccessoryInformation()
            .setCharacteristic(Characteristic.Name, this.name)
            .setCharacteristic(Characteristic.Identify, this.name)
            .setCharacteristic(Characteristic.Manufacturer, 'Tado GmbH')
            .setCharacteristic(Characteristic.Model, 'Weather Service')
            .setCharacteristic(Characteristic.SerialNumber, "WS-1234567890")
            .setCharacteristic(Characteristic.FirmwareRevision, require('../package.json').version);

        this.weatherService = new WeatherService(this.name);

        this.weatherService.addCharacteristic(WeatherCharacteristic);
        this.weatherService.getCharacteristic(WeatherCharacteristic)
            .on("get", this.getCurrentWeatherState.bind(this));

        if (this.polling) {
            (function poll() {
                setTimeout(function() {
                        accessory.weatherService.getCharacteristic(Characteristic.WeatherCharacteristic).getValue();
                        poll()
                    }, 30 * 60 * 1000) //30min
            })();
        }

        return [this.informationService, this.weatherService];

    }

    getCurrentWeatherState(callback) {

        var self = this;

        self.get.WEATHER()
            .then(response => {

                var state = response.weatherState.value;

                callback(null, state)

            })
            .catch(err => {

                if (err.message.match("ETIMEDOUT") || err.message.match("EHOSTUNREACH")) {
                    self.log(self.name + ": No connection...");
                    callback(null, false)
                } else {
                    self.log(self.name + ": Error: " + err);
                    callback(null, false)
                }

            });

    }

}

module.exports = WEATHERSERVICE