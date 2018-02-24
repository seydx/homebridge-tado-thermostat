const moment = require('moment');
var rp = require("request-promise");
var HK_REQS = require('./Requests.js');

var Accessory, Service, Characteristic, FakeGatoHistoryService;

class THERMOSTAT {

    constructor(log, config, api) {

        FakeGatoHistoryService = require('fakegato-history')(api);

        Accessory = api.platformAccessory;
        Service = api.hap.Service;
        Characteristic = api.hap.Characteristic;

        var platform = this;

        this.api = api;
        this.log = log;
        this.config = config;
        this.zoneID = config.id;
        this.name = config.name;
        this.homeID = config.homeID;
        this.username = config.username;
        this.password = config.password;
        this.polling = config.polling;
        this.interval = config.interval;
        this.coolValue = config.coolValue;
        this.heatValue = config.heatValue;
        this.tempUnit = config.tempUnit;
        this.targetMinValue = config.targetMinValue;
        this.targetMaxValue = config.targetMaxValue;

        this.get = new HK_REQS(platform.username, platform.password, platform.homeID, {
            "token": process.argv[2]
        }, platform.zoneID, platform.coolValue, platform.heatValue);

    }

    getServices() {

        var accessory = this;

        this.informationService = new Service.AccessoryInformation()
            .setCharacteristic(Characteristic.Name, this.name + " Thermo")
            .setCharacteristic(Characteristic.Identify, this.name + " Thermo")
            .setCharacteristic(Characteristic.Manufacturer, 'Tado GmbH')
            .setCharacteristic(Characteristic.Model, 'Thermostat')
            .setCharacteristic(Characteristic.SerialNumber, "T-" + this.homeID + "-" + this.zoneID)
            .setCharacteristic(Characteristic.FirmwareRevision, require('../package.json').version);

        this.Thermostat = new Service.Thermostat(this.name + " Thermo");
        this.BatteryService = new Service.BatteryService();

        this.BatteryService.getCharacteristic(Characteristic.ChargingState)
            .updateValue(2); //NO CHARGABLE

        this.BatteryService.getCharacteristic(Characteristic.BatteryLevel)
            .on('get', this.getBatteryLevel.bind(this));

        this.BatteryService.getCharacteristic(Characteristic.StatusLowBattery)
            .on('get', this.getStatusLowBattery.bind(this));

        this.Thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
            .on('get', this.getCurrentHeatingCoolingState.bind(this));

        this.Thermostat.getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .on('get', this.getTargetHeatingCoolingState.bind(this))
            .on('set', this.setTargetHeatingCoolingState.bind(this));

        this.Thermostat.getCharacteristic(Characteristic.CurrentTemperature)
            .setProps({
                minValue: -100,
                maxValue: 100,
                minStep: 0.1
            })
            .on('get', this.getCurrentTemperature.bind(this));

        this.Thermostat.getCharacteristic(Characteristic.TargetTemperature)
            .setProps({
                minValue: this.targetMinValue,
                maxValue: this.targetMaxValue,
                minStep: 1
            })
            .on('get', this.getTargetTemperature.bind(this))
            .on('set', this.setTargetTemperature.bind(this));

        this.Thermostat.getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .on('get', this.getTemperatureDisplayUnits.bind(this));

        this.Thermostat.getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .setProps({
                minValue: 0,
                maxValue: 100,
                minStep: 0.01
            })
            .on('get', this.getCurrentRelativeHumidity.bind(this));

        //FAKEGATO
        this.historyService = new FakeGatoHistoryService("weather", this, {
            storage: 'fs',
            path: this.api.user.cachedAccessoryPath()
        });


        (function poll() {
            setTimeout(function() {
                    accessory.getHistory()
                    poll()
                }, 10 * 1000) //10s
        })();


        if (this.polling) {
            (function poll() {
                setTimeout(function() {
                        accessory.Thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState).getValue();
                        accessory.Thermostat.getCharacteristic(Characteristic.TargetHeatingCoolingState).getValue();
                        accessory.Thermostat.getCharacteristic(Characteristic.CurrentTemperature).getValue();
                        accessory.Thermostat.getCharacteristic(Characteristic.TargetTemperature).getValue();
                        poll()
                    }, accessory.interval) //Default: 3s
            })();
        }

        if (this.polling) {
            (function poll() {
                setTimeout(function() {
                        accessory.Thermostat.getCharacteristic(Characteristic.CurrentRelativeHumidity).getValue();
                        poll()
                    }, 1000 * 60 * 60) //1h
            })();
        }

        if (this.polling) {
            (function poll() {
                setTimeout(function() {
                        accessory.BatteryService.getCharacteristic(Characteristic.BatteryLevel).getValue();
                        accessory.BatteryService.getCharacteristic(Characteristic.StatusLowBattery).getValue();
                        poll()
                    }, 1000 * 60 * 60 * 24) //24h
            })();
        }

        return [this.informationService, this.Thermostat, this.BatteryService, this.historyService];

    }

    getBatteryLevel(callback) {
        var self = this;

        self.get.HOME_DEVICES()
            .then(response => {

                var batteryStatus = response[0].batteryState;

                if (batteryStatus == "NORMAL") {
                    self.log(self.name + ": Battery Status: " + batteryStatus)
                    callback(null, 100)
                } else {
                    self.log(self.name + ": Battery Status: " + batteryStatus)
                    callback(null, 10)
                }

            })
            .catch(err => {

                if (err.message.match("ETIMEDOUT") || err.message.match("EHOSTUNREACH")) {
                    self.log(self.name + " Battery: No connection...");
                } else {
                    self.log(self.name + " Battery: Error: " + err);
                }

            });
    }

    getStatusLowBattery(callback) {
        var self = this;

        self.get.HOME_DEVICES()
            .then(response => {

                var batteryStatus = response[0].batteryState;

                if (batteryStatus == "NORMAL") {
                    callback(null, 0)
                } else {
                    callback(null, 1)
                }

            })
            .catch(err => {

                if (err.message.match("ETIMEDOUT") || err.message.match("EHOSTUNREACH")) {
                    self.log(self.name + " Battery: No connection...");
                } else {
                    self.log(self.name + " Battery: Error: " + err);
                }

            });
    }

    getCurrentState(callback) {

        var self = this;

        self.get.STATE()
            .then(response => {

                var state = response;

                callback(null, state)

            })
            .catch(err => {

                if (err.message.match("ETIMEDOUT") || err.message.match("EHOSTUNREACH")) {
                    self.log("State: No connection - Trying to reconnect...");
                    callback(null, false)
                } else {
                    self.log("Could not retrieve status from " + self.name + ": " + err);
                    callback(null, false)
                }

            });

    }


    getCurrentHeatingCoolingState(callback) {

        var accessory = this;

        accessory.getCurrentState(function(err, data) {

            if (err) callback(err)
            else {
                if (data.setting.power == "ON") {

                    if (data.overlayType == null) {

                        callback(null, Characteristic.CurrentHeatingCoolingState.AUTO);

                    } else {

                        if (Math.round(data.sensorDataPoints.insideTemperature.celsius) >= Math.round(data.setting.temperature.celsius)) {
                            callback(null, Characteristic.CurrentHeatingCoolingState.COOL);
                        } else {
                            callback(null, Characteristic.CurrentHeatingCoolingState.HEAT);
                        }

                    }

                } else {
                    callback(null, Characteristic.CurrentHeatingCoolingState.OFF);
                }
            }

        })

    }

    getTargetHeatingCoolingState(callback) {

        var accessory = this;

        accessory.getCurrentState(function(err, data) {

            if (err) callback(err)
            else {
                if (data.setting.power == "ON") {

                    if (data.overlayType == null) {

                        callback(null, Characteristic.TargetHeatingCoolingState.AUTO);

                    } else {

                        if (Math.round(data.sensorDataPoints.insideTemperature.celsius) >= Math.round(data.setting.temperature.celsius)) {
                            callback(null, Characteristic.TargetHeatingCoolingState.COOL);
                        } else {
                            callback(null, Characteristic.TargetHeatingCoolingState.HEAT);
                        }

                    }

                } else {
                    callback(null, Characteristic.TargetHeatingCoolingState.OFF);
                }
            }
        })

    }


    getHistory() {

        var accessory = this;

        accessory.getCurrentState(function(err, data) {

            if (err) accessory.log(err)
            else {
                accessory.historyService.addEntry({
                    time: moment().unix(),
                    temp: data.sensorDataPoints.insideTemperature.celsius,
                    pressure: 1029,
                    humidity: data.sensorDataPoints.humidity.percentage
                });

            }
        })
    }


    getCurrentTemperature(callback) {

        var accessory = this;

        accessory.getCurrentState(function(err, data) {

            if (err) callback(err)
            else {
                if (accessory.tempUnit == "CELSIUS") {
                    callback(null, data.sensorDataPoints.insideTemperature.celsius);
                } else {
                    callback(null, data.sensorDataPoints.insideTemperature.fahrenheit);
                }
            }
        })

    }

    getTargetTemperature(callback) {

        var accessory = this;

        accessory.getCurrentState(function(err, data) {

            if (err) callback(err)
            else {
                if (data.setting.power == "ON") {
                    if (accessory.tempUnit == "CELSIUS") {
                        callback(null, data.setting.temperature.celsius);
                    } else {
                        callback(null, data.setting.temperature.fahrenheit);
                    }
                } else {
                    if (accessory.tempUnit == "CELSIUS") {
                        callback(null, data.sensorDataPoints.insideTemperature.celsius);
                    } else {
                        callback(null, data.sensorDataPoints.insideTemperature.fahrenheit);
                    }
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

    getCurrentRelativeHumidity(callback) {

        var accessory = this;

        accessory.getCurrentState(function(err, data) {

            if (err) callback(err)
            else {
                callback(null, data.sensorDataPoints.humidity.percentage);
            }
        })

    }


    setTargetHeatingCoolingState(state, callback) {

        var self = this;

        self.getCurrentState(function(err, data) {

            var currentValue = Math.round(data.sensorDataPoints.insideTemperature.celsius);

            self.get = new HK_REQS(self.username, self.password, self.homeID, {
                "token": process.argv[2]
            }, self.zoneID, self.heatValue, self.coolValue, currentValue);

            switch (state) {
                case Characteristic.TargetHeatingCoolingState.OFF:

                    self.get.STATE_OFF()
                        .then(response => {

                            self.log(self.name + ": Switch off");
                            callback()

                        })
                        .catch(err => {

                            if (err.message.match("ETIMEDOUT") || err.message.match("EHOSTUNREACH")) {
                                self.log(self.name + ": No connection - Trying to reconnect...");
                                callback()
                            } else {
                                self.log(self.name + ": Error: " + err);
                                callback()
                            }

                        });

                    break;

                case Characteristic.TargetHeatingCoolingState.HEAT:

                    self.get.STATE_HEAT()
                        .then(response => {

                            self.log(self.name + ": Switch to heat mode");
                            callback()

                        })
                        .catch(err => {

                            if (err.message.match("ETIMEDOUT") || err.message.match("EHOSTUNREACH")) {
                                self.log(self.name + ": No connection - Trying to reconnect...");
                                callback()
                            } else {
                                self.log(self.name + ": Error: " + err);
                                callback()
                            }

                        });
                    break;

                case Characteristic.TargetHeatingCoolingState.COOL:
                    self.get.STATE_COOL()
                        .then(response => {

                            self.log(self.name + ": Switch to cool mode");
                            callback()

                        })
                        .catch(err => {

                            if (err.message.match("ETIMEDOUT") || err.message.match("EHOSTUNREACH")) {
                                self.log(self.name + ": No connection - Trying to reconnect...");
                                callback()
                            } else {
                                self.log(self.name + ": Error: " + err);
                                callback()
                            }

                        });
                    break;

                case Characteristic.TargetHeatingCoolingState.AUTO:
                    self.get.STATE_AUTO()
                        .then(response => {

                            self.log(self.name + ": Switch to automatic mode");
                            self.Thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(0);
                            callback()

                        })
                        .catch(err => {

                            if (err.message.match("ETIMEDOUT") || err.message.match("EHOSTUNREACH")) {
                                self.log(self.name + ": No connection - Trying to reconnect...");
                                callback()
                            } else {
                                self.log(self.name + ": Error: " + err);
                                callback()
                            }

                        });
                    break;
            }

        })

    }

    setTargetTemperature(value, callback) {

        var accessory = this;

        accessory.getCurrentState(function(err, data) {

            accessory.get = new HK_REQS(accessory.username, accessory.password, accessory.homeID, {
                "token": process.argv[2]
            }, accessory.zoneID, accessory.heatValue, accessory.coolValue, accessory.currentValue, value);

            var tarstate = accessory.Thermostat.getCharacteristic(Characteristic.TargetHeatingCoolingState).value;

            if (tarstate == 0) {
                accessory.log("No setting new temperature, because thermostat is off");
                callback()
            } else if (tarstate == 3) {
                accessory.log("No setting new temperature, because thermostat is in auto mode");
                callback()
            } else {
                accessory.get.STATE_NEWTEMP()
                    .then(response => {

                        accessory.log(accessory.name + ": " + value);
                        callback()

                    })
                    .catch(err => {

                        if (err.message.match("ETIMEDOUT") || err.message.match("EHOSTUNREACH")) {
                            accessory.log("Thermostat: No connection - Trying to reconnect...");
                            callback()
                        } else {
                            accessory.log("Could not change temperature: " + err);
                            callback()
                        }

                    });

            }

        })

    }
}

module.exports = THERMOSTAT
