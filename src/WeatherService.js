var rp = require("request-promise"),
    inherits = require("util").inherits,
    pollingtoevent = require("polling-to-event");

var Accessory,
    Service,
    Characteristic,
    WeatherService,
    WeatherCharacteristic;

class WEATHERSERVICE {

    constructor(log, config, api) {

        Accessory = api.platformAccessory;
        Service = api.hap.Service;
        Characteristic = api.hap.Characteristic;

        WeatherService = function(displayName, subtype) {
            Service.call(this, displayName, "15473fd1-4e44-4aea-96e2-11af1809d8ad", subtype);
        };
        inherits(WeatherService, Service);

        WeatherCharacteristic = function() {
            Characteristic.call(this, "Current Weather", "08ea5ea1-372a-4a6d-bec7-1dfd6107d6f0");
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

        !this.weather ? this.weather = "" : this.weather;

        this.url = "https://my.tado.com/api/v2/homes/" + this.homeID +
            "/weather?password=" + this.password +
            "&username=" + this.username;

        this.emitter = pollingtoevent(function(done) {
            rp.get(platform.url, function(err, req, data) {
                done(err, data);
            });
        }, {
            longpolling: false,
            interval: 60 * 60 * 1000
        });

    }

    getServices() {

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
            .updateValue(this.weather);

        this.getCurrentWeatherState()

        return [this.informationService, this.weatherService];

    }

    getCurrentWeatherState(callback) {

        var self = this;

        self.emitter
            .on("poll", function(data) {

                var result = JSON.parse(data);
                self.weather = result.weatherState.value;

                self.weatherService.getCharacteristic(WeatherCharacteristic)
                    .updateValue(self.weather);

            })
            .on("error", function(err) {
                self.log("An Error occured: %s", err);
                self.log("Setting Current Weather state to: " + self.weather);
                self.weatherService.getCharacteristic(WeatherCharacteristic)
                    .updateValue(self.weather);
            });

    }

}

module.exports = WEATHERSERVICE
