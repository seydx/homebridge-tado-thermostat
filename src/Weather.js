const moment = require('moment');
var rp = require("request-promise");
var HK_REQS = require('./Requests.js');

var Accessory, Service, Characteristic, FakeGatoHistoryService;

class WEATHER {

    constructor(log, config, api) {

        FakeGatoHistoryService = require('fakegato-history')(api);

        Accessory = api.platformAccessory;
        Service = api.hap.Service;
        Characteristic = api.hap.Characteristic;

        var platform = this;

        this.api = api;
        this.log = log;
        this.config = config;
        this.name = config.name;
        this.homeID = config.homeID;
        this.username = config.username;
        this.password = config.password;
        this.polling = config.polling;
        this.interval = config.interval
        this.tempUnit = config.tempUnit;

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
            .setCharacteristic(Characteristic.Model, 'Weather')
            .setCharacteristic(Characteristic.SerialNumber, "W-" + this.homeID + "-00")
            .setCharacteristic(Characteristic.FirmwareRevision, require('../package.json').version);

        this.Weather = new Service.TemperatureSensor(this.name);

        this.Weather.getCharacteristic(Characteristic.CurrentTemperature)
            .setProps({
                minValue: -100,
                maxValue: 100,
                minStep: 0.01
            })
            .on('get', this.getCurrentTemperature.bind(this));

        //FAKEGATO
        this.historyService = new FakeGatoHistoryService("weather", this, {
            storage: 'fs',
            disableTimer: true,
            path: this.api.user.cachedAccessoryPath()
        });

        if (this.polling) {
            (function poll() {
                setTimeout(function() {
                    accessory.Weather.getCharacteristic(Characteristic.CurrentTemperature).getValue();
                    poll()
                }, accessory.interval)
            })();
        }

        return [this.informationService, this.Weather, this.historyService];

    }

    getCurrentWeather(callback) {

        var self = this;

        self.get.WEATHER()
            .then(response => {

                var state = response;

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

    getCurrentTemperature(callback) {

        var accessory = this;

        accessory.getCurrentWeather(function(err, data) {

            if (err) callback(err)
            else {
                if (accessory.tempUnit == "CELSIUS") {
                    accessory.historyService.addEntry({
                        time: moment().unix(),
                        temp: data.outsideTemperature.celsius,
                        pressure: 0,
                        humidity: 0
                    });
                    callback(null, data.outsideTemperature.celsius);
                } else {
                    accessory.historyService.addEntry({
                        time: moment().unix(),
                        temp: data.outsideTemperature.fahrenheit,
                        pressure: 0,
                        humidity: 0
                    });
                    callback(null, data.outsideTemperature.fahrenheit);
                }
            }
        })

    }

    getTemperatureDisplayUnits(callback) {

        var accessory = this;

        if (accessory.tempUnit == "CELSIUS") {
            callback(null, Characteristic.TemperatureDisplayUnits.CELSIUS);
        } else {
            callback(null, Characteristic.TemperatureDisplayUnits.FAHRENHEIT);
        }

    }

}

module.exports = WEATHER