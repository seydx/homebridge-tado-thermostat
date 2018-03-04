var moment = require('moment'),
    rp = require("request-promise"),
    HK_REQS = require('./Requests.js'),
    pollingtoevent = require("polling-to-event");

var Accessory,
    Service,
    Characteristic,
    FakeGatoHistoryService;

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
        this.displayName = config.name;
        this.homeID = config.homeID;
        this.username = config.username;
        this.password = config.password;
        this.coolValue = config.coolValue;
        this.heatValue = config.heatValue;
        this.tempUnit = config.tempUnit;
        this.targetMinValue = config.targetMinValue;
        this.targetMaxValue = config.targetMaxValue;
        this.serialNo = config.serialNo;
        this.delaytimer = config.delaytimer;

        !this.batteryLevel ? this.batteryLevel = 100 : this.batteryLevel;
        !this.batteryStatus ? this.batteryStatus = 0 : this.batteryStatus;
        !this.humidity ? this.humidity = 0 : this.humidity;
        !this.currenttemp ? this.currenttemp = 0 : this.currenttemp;
        !this.targettemp ? this.targettemp = 0 : this.targettemp;
        !this.currentstate ? this.currentstate = 0 : this.currentstate;
        !this.targetstate ? this.targetstate = 3 : this.targetstate;

        this.get = new HK_REQS(platform.username, platform.password, platform.homeID, {
            "token": process.argv[2]
        }, platform.zoneID, platform.coolValue, platform.heatValue);

        this.url_devices = "https://my.tado.com/api/v2/homes/" + this.homeID +
            "/zones/" + this.zoneID +
            "/devices?password=" + this.password +
            "&username=" + this.username;

        this.url_state = "https://my.tado.com/api/v2/homes/" + this.homeID +
            "/zones/" + this.zoneID + "/state?password=" + this.password +
            "&username=" + this.username;


        this.emitter_devices = pollingtoevent(function(done) {
            rp.get(platform.url_devices, function(err, req, data) {
                done(err, data);
            });
        }, {
            longpolling: false,
            interval: 10000
        });

        this.emitter_state = pollingtoevent(function(done) {
            rp.get(platform.url_state, function(err, req, data) {
                done(err, data);
            });
        }, {
            longpolling: false,
            interval: 5000
        });

    }

    getServices() {

        var accessory = this;

        this.informationService = new Service.AccessoryInformation()
            .setCharacteristic(Characteristic.Name, this.displayName + " Thermo")
            .setCharacteristic(Characteristic.Identify, this.displayName + " Thermo")
            .setCharacteristic(Characteristic.Manufacturer, 'Tado GmbH')
            .setCharacteristic(Characteristic.Model, 'Thermostat')
            .setCharacteristic(Characteristic.SerialNumber, "T-" + this.serialNo)
            .setCharacteristic(Characteristic.FirmwareRevision, require('../package.json').version);

        this.Thermostat = new Service.Thermostat(this.displayName + " Thermo");
        this.BatteryService = new Service.BatteryService();

        this.BatteryService.getCharacteristic(Characteristic.ChargingState)
            .updateValue(2);

        this.BatteryService.getCharacteristic(Characteristic.BatteryLevel)
            .updateValue(this.batteryLevel);

        this.BatteryService.getCharacteristic(Characteristic.StatusLowBattery)
            .updateValue(this.batteryStatus);

        this.Thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
            .updateValue(this.currentstate);

        this.Thermostat.getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .updateValue(this.targetstate)
            .on('set', this.setTargetHeatingCoolingState.bind(this));

        this.Thermostat.getCharacteristic(Characteristic.CurrentTemperature)
            .setProps({
                minValue: -100,
                maxValue: 100,
                minStep: 0.1
            })
            .updateValue(this.temp);

        this.Thermostat.getCharacteristic(Characteristic.TargetTemperature)
            .setProps({
                minValue: this.targetMinValue,
                maxValue: this.targetMaxValue,
                minStep: 1
            })
            .updateValue(this.target)
            .on('set', this.setTargetTemperature.bind(this));

        this.Thermostat.getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .on('get', this.getTemperatureDisplayUnits.bind(this));

        this.Thermostat.getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .setProps({
                minValue: 0,
                maxValue: 100,
                minStep: 0.01
            })
            .updateValue(this.humidity);

        this.historyService = new FakeGatoHistoryService("weather", this, {
            storage: 'fs',
            disableTimer: true,
            path: this.api.user.cachedAccessoryPath()
        });

        this._updateBatteryValues();
        this._updateThermostatValues();

        (function poll() {
            setTimeout(function() {
                accessory.getHistory();
                poll();
            }, 5 * 60 * 1000)
        })();

        return [this.informationService, this.Thermostat, this.BatteryService, this.historyService];

    }

    _updateBatteryValues() {

        var self = this;

        this.emitter_devices
            .on("poll", function(data) {

                var result = JSON.parse(data);

                for (var i = 0; i < result.length; i++) {

                    if (result[i].serialNo.match(self.serialNo)) {

                        if (result[i].batteryState == "NORMAL") {
                            self.batteryLevel = 100;
                            self.batteryStatus = 0;
                        } else {
                            self.batteryLevel = 10;
                            self.batteryStatus = 1;
                        }

                    }

                }

                self.BatteryService.getCharacteristic(Characteristic.BatteryLevel)
                    .updateValue(self.batteryLevel);
                self.BatteryService.getCharacteristic(Characteristic.StatusLowBattery)
                    .updateValue(self.batteryStatus);

            })
            .on("error", function(err) {
                self.log("An Error occured: %s", err);
                self.log("Setting Battery Level to: " + self.batteryLevel);
                self.log("Setting Battery Status to: " + self.batteryStatus);
                self.BatteryService.getCharacteristic(Characteristic.BatteryLevel)
                    .updateValue(self.batteryLevel);
                self.BatteryService.getCharacteristic(Characteristic.StatusLowBattery)
                    .updateValue(self.batteryStatus);
            });

    }

    _updateThermostatValues() {

        var self = this;

        this.emitter_state
            .on("poll", function(data) {

                var result = JSON.parse(data);

                self.humidity = result.sensorDataPoints.humidity.percentage;

                if (result.setting.power == "ON") {

                    if (self.tempUnit == "CELSIUS") {
                        self.currenttemp = result.sensorDataPoints.insideTemperature.celsius;
                        self.targettemp = result.setting.temperature.celsius;
                    } else {
                        self.currenttemp = result.sensorDataPoints.insideTemperature.fahrenheit;
                        self.targettemp = result.setting.temperature.fahrenheit;
                    }

                    if (result.overlayType == null) {

                        self.currentstate = 0;
                        self.targetstate = 3;

                    } else {

                        if (Math.round(result.sensorDataPoints.insideTemperature.celsius) >= Math.round(result.setting.temperature.celsius)) {
                            self.currentstate = 2;
                            self.targetstate = 2;

                        } else {
                            self.currentstate = 1;
                            self.targetstate = 1;
                        }

                    }

                } else {
                    self.currentstate = 0;
                    self.targetstate = 0;

                    if (self.tempUnit == "CELSIUS") {
                        self.currenttemp = result.sensorDataPoints.insideTemperature.celsius;
                        self.targettemp = result.sensorDataPoints.insideTemperature.celsius;
                    } else {
                        self.currenttemp = result.sensorDataPoints.insideTemperature.fahrenheit;
                        self.targettemp = result.sensorDataPoints.insideTemperature.fahrenheit;
                    }
                }

                self.Thermostat.getCharacteristic(Characteristic.CurrentTemperature).updateValue(self.currenttemp);
                self.Thermostat.getCharacteristic(Characteristic.TargetTemperature).updateValue(self.targettemp);
                self.Thermostat.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(self.humidity);
                self.Thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(self.currentstate);
                self.Thermostat.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(self.targetstate);

            })
            .on("error", function(err) {
                self.log("An Error occured: %s", err);
                self.log("Setting Current Temperature to: " + self.currenttemp);
                self.log("Setting Target Temperature to: " + self.targettemp);
                self.log("Setting Humidty to: " + self.humidity);
                self.log("Setting Current State to: " + self.currentstate);
                self.log("Setting Target State to: " + self.targetstate);
                self.Thermostat.getCharacteristic(Characteristic.CurrentTemperature).updateValue(self.currenttemp);
                self.Thermostat.getCharacteristic(Characteristic.TargetTemperature).updateValue(self.targettemp);
                self.Thermostat.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(self.humidity);
                self.Thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(self.currentstate);
                self.Thermostat.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(self.targetstate);
            });

    }

    getHistory() {

        var self = this;

        this.historyService.addEntry({
            time: moment().unix(),
            temp: self.currenttemp,
            pressure: 1029,
            humidity: self.humidity
        });

    }

    getTemperatureDisplayUnits(callback) {

        this.tempUnit == "CELSIUS" ?
            callback(null, Characteristic.TemperatureDisplayUnits.CELSIUS) :
            callback(null, Characteristic.TemperatureDisplayUnits.FAHRENHEIT);

    }

    setTargetHeatingCoolingState(state, callback) {

        var self = this;

        self.get = new HK_REQS(self.username, self.password, self.homeID, {
            "token": process.argv[2]
        }, self.zoneID, self.heatValue, self.coolValue, self.currenttemp);

        switch (state) {
            case Characteristic.TargetHeatingCoolingState.OFF:

                self.get.STATE_OFF()
                    .then(response => {

                        self.log(self.displayName + ": OFF");
                        callback()

                    })
                    .catch(err => {

                        if (err.message.match("ETIMEDOUT") || err.message.match("EHOSTUNREACH")) {
                            self.log(self.displayName + ": No connection - Trying to reconnect...");
                            callback()
                        } else {
                            self.log(self.displayName + ": Error: " + err);
                            callback()
                        }

                    });

                break;

            case Characteristic.TargetHeatingCoolingState.HEAT:

                self.get.STATE_HEAT()
                    .then(response => {

                        self.log(self.displayName + ": HEAT");
                        callback()

                    })
                    .catch(err => {

                        if (err.message.match("ETIMEDOUT") || err.message.match("EHOSTUNREACH")) {
                            self.log(self.displayName + ": No connection - Trying to reconnect...");
                            callback()
                        } else {
                            self.log(self.displayName + ": Error: " + err);
                            callback()
                        }

                    });

                break;

            case Characteristic.TargetHeatingCoolingState.COOL:

                self.get.STATE_COOL()
                    .then(response => {

                        self.log(self.displayName + ": COOL");
                        callback()

                    })
                    .catch(err => {

                        if (err.message.match("ETIMEDOUT") || err.message.match("EHOSTUNREACH")) {
                            self.log(self.displayName + ": No connection - Trying to reconnect...");
                            callback()
                        } else {
                            self.log(self.displayName + ": Error: " + err);
                            callback()
                        }

                    });

                break;

            case Characteristic.TargetHeatingCoolingState.AUTO:


                if (self.delaytimer > 0) {

                    self.log(self.displayName + ": Switching to automatic mode in " + self.delaytimer / 1000 + " seconds...");

                    function sleep(time) {
                        return new Promise((resolve) => setTimeout(resolve, time));
                    }

                    sleep(self.delaytimer).then(() => {

                        self.get.STATE_AUTO()
                            .then(response => {

                                self.log(self.displayName + ": AUTO");
                                self.Thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(0);
                                callback()

                            })
                            .catch(err => {

                                if (err.message.match("ETIMEDOUT") || err.message.match("EHOSTUNREACH")) {
                                    self.log(self.displayName + ": No connection - Trying to reconnect...");
                                    callback()
                                } else {
                                    self.log(self.displayName + ": Error: " + err);
                                    callback()
                                }

                            });

                    });

                } else {

                    self.log(self.displayName + ": AUTO");

                    self.get.STATE_AUTO()
                        .then(response => {

                            self.Thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(0);
                            callback()

                        })
                        .catch(err => {

                            if (err.message.match("ETIMEDOUT") || err.message.match("EHOSTUNREACH")) {
                                self.log(self.displayName + ": No connection - Trying to reconnect...");
                                callback()
                            } else {
                                self.log(self.displayName + ": Error: " + err);
                                callback()
                            }

                        });

                }

                break;
        }

    }

    setTargetTemperature(value, callback) {

        var self = this;

        self.get = new HK_REQS(self.username, self.password, self.homeID, {
            "token": process.argv[2]
        }, self.zoneID, self.heatValue, self.coolValue, self.currenttemp, value);

        if (self.targetstate == 0) {
            self.log("Can't set new Temperature, Thermostat is off");
            callback()
        } else if (self.targetstate == 3) {
            self.log("Can't set new Temperature, Thermostat is in auto mode");
            callback()
        } else {
            self.get.STATE_NEWTEMP()
                .then(response => {

                    self.log(self.displayName + ": " + value);
                    callback()

                })
                .catch(err => {

                    if (err.message.match("ETIMEDOUT") || err.message.match("EHOSTUNREACH")) {
                        self.log("Thermostat: No connection...");
                        callback()
                    } else {
                        self.log(self.displayName + ": Error: " + err);
                        callback()
                    }

                });

        }

    }
}

module.exports = THERMOSTAT
