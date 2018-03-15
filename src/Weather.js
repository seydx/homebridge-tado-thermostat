var moment = require('moment'),
    rp = require("request"),
    pollingtoevent = require("polling-to-event"),
    inherits = require("util").inherits;

var Accessory,
    Service,
    Characteristic,
    FakeGatoHistoryService,
    AirPressure;

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
        this.displayName = config.name;
        this.homeID = config.homeID;
        this.username = config.username;
        this.password = config.password;
        this.tempUnit = config.tempUnit;
        this.weatherAPI = config.weatherAPI;
        this.weatherLocation = config.weatherLocation;

        !this.temp ? this.temp = 0 : this.temp;
        !this.humidity ? this.humidity = 0 : this.humidity;
        !this.pressure ? this.pressure = 0 : this.pressure;

        this.url = "https://my.tado.com/api/v2/homes/" + this.homeID +
            "/weather?password=" + this.password +
            "&username=" + this.username;
            
        if (this.weatherAPI != "" && this.weatherAPI != undefined && this.weatherAPI != null && this.weatherLocation != "" && this.weatherLocation != undefined && this.weatherLocation != null) {
	        AirPressure = function() {
	            Characteristic.call(this, "Air Pressure", "E863F10F-079E-48FF-8F27-9C2605A29F52");
	            this.setProps({
	                format: Characteristic.Formats.UINT16,
	                unit: "mBar",
	                maxValue: 1100,
	                minValue: 700,
	                minStep: 1,
	                perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
	            });
	            this.value = this.getDefaultValue();
	        };
	        inherits(AirPressure, Characteristic);
	        AirPressure.UUID = "E863F10F-079E-48FF-8F27-9C2605A29F52";
        }

        if (this.weatherAPI != "" && this.weatherAPI != undefined && this.weatherAPI != null && this.weatherLocation != "" && this.weatherLocation != undefined && this.weatherLocation != null) {
            if (this.tempUnit == "CELSIUS") {
                this.url_weather = "http://api.openweathermap.org/data/2.5/weather?q=" + this.weatherLocation + "&appid=" + this.weatherAPI + "&units=metric";
            } else {
                this.url_weather = "http://api.openweathermap.org/data/2.5/weather?q=" + this.weatherLocation + "&appid=" + this.weatherAPI + "&units=imperial";
            }
        }

    }

    getServices() {

        var self = this;

        this.informationService = new Service.AccessoryInformation()
            .setCharacteristic(Characteristic.Name, this.name)
            .setCharacteristic(Characteristic.Identify, this.name)
            .setCharacteristic(Characteristic.Manufacturer, 'Tado GmbH')
            .setCharacteristic(Characteristic.Model, 'Weather')
            .setCharacteristic(Characteristic.SerialNumber, "W-" + this.homeID + "-00")
            .setCharacteristic(Characteristic.FirmwareRevision, require('../package.json').version);

        this.Weather = new Service.TemperatureSensor(this.name);

        if (this.weatherAPI != "" && this.weatherAPI != undefined && this.weatherAPI != null && this.weatherLocation != "" && this.weatherLocation != undefined && this.weatherLocation != null) {

            this.Weather.addCharacteristic(Characteristic.CurrentRelativeHumidity)
            this.Weather.getCharacteristic(Characteristic.CurrentRelativeHumidity)
                .setProps({
                    minValue: 0,
                    maxValue: 100,
                    minStep: 0.01
                })
                .updateValue(this.humidity);

            this.Weather.addCharacteristic(AirPressure)
            this.Weather.getCharacteristic(AirPressure)
                .updateValue(this.pressure);

        }

        this.Weather.getCharacteristic(Characteristic.CurrentTemperature)
            .setProps({
                minValue: -100,
                maxValue: 100,
                minStep: 0.01
            })
            .updateValue(this.state);

        this.historyService = new FakeGatoHistoryService("weather", this, {
            storage: 'fs',
            disableTimer: true,
            path: this.api.user.cachedAccessoryPath()
        });

        this.getCurrentTemperature();
        
        if (this.weatherAPI != "" && this.weatherAPI != undefined && this.weatherAPI != null && this.weatherLocation != "" && this.weatherLocation != undefined && this.weatherLocation != null) {
			this.getOpenWeatherData();
        }

        (function poll() {
            setTimeout(function() {
                self.getHistory();
                poll();
            }, 8 * 60 * 1000)
        })();

        return [this.informationService, this.Weather, this.historyService];

    }

    getCurrentTemperature() {

        var self = this;

        var emitter = pollingtoevent(function(done) {
            rp.get(self.url, function(err, req, data) {
                done(err, data);
            });
        }, {
            longpolling: false,
            interval: 5 * 60 * 1000
        });

        emitter
            .on("poll", function(data) {

                var result = JSON.parse(data);

                self.tempUnit == "CELSIUS" ?
                    self.temp = result.outsideTemperature.celsius :
                    self.temp = result.outsideTemperature.fahrenheit;

                self.Weather.getCharacteristic(Characteristic.CurrentTemperature)
                    .updateValue(self.temp);

            })
            .on("error", function(err) {
                self.log(self.name + ": An Error occured: %s", err.code + " - Polling again..");
                self.Weather.getCharacteristic(Characteristic.CurrentTemperature)
                    .updateValue(self.temp);
                emitter.pause();
                setTimeout(function() {
                    emitter.resume();
                }, 10000)
            });

    }

    getOpenWeatherData() {

        var self = this;

        var emitter = pollingtoevent(function(done) {
            rp.get(self.url_weather, function(err, req, data) {
                done(err, data);
            });
        }, {
            longpolling: false,
            interval: 5 * 60 * 1000
        });

        emitter
            .on("poll", function(data) {

                var result = JSON.parse(data);

                self.humidity = result.main.humidity;
                self.pressure = result.main.pressure;

                self.Weather.getCharacteristic(Characteristic.CurrentRelativeHumidity)
                    .updateValue(self.humidity);
                self.Weather.getCharacteristic(AirPressure)
                    .updateValue(self.pressure);

            })
            .on("error", function(err) {
                self.log(self.name + " Humidity/Air Pressure: An Error occured: %s", err.code + " - Polling again..");
                self.Weather.getCharacteristic(Characteristic.CurrentRelativeHumidity)
                    .updateValue(self.humidity);
                self.Weather.getCharacteristic(AirPressure)
                    .updateValue(self.pressure);
                emitter.pause();
                setTimeout(function() {
                    emitter.resume();
                }, 10000)
            });

    }

    getHistory() {

        var self = this;
        
        if (self.weatherAPI == "" || self.weatherAPI == undefined || self.weatherAPI == null || self.weatherLocation == "" || self.weatherLocation == undefined || self.weatherLocation == null) {
			self.pressure = 0;
			self.humidity = 0;
        }

        self.historyService.addEntry({
            time: moment().unix(),
            temp: self.temp,
            pressure: self.pressure,
            humidity: self.humidity
        });

    }

}

module.exports = WEATHER
