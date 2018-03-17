var moment = require('moment'),
    https = require("https");

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
        this.interval = config.interval;

        !this.batteryLevel ? this.batteryLevel = 100 : this.batteryLevel;
        !this.batteryStatus ? this.batteryStatus = 0 : this.batteryStatus;
        !this.humidity ? this.humidity = 0 : this.humidity;
        !this.currenttemp ? this.currenttemp = 0 : this.currenttemp;
        !this.targettemp ? this.targettemp = 0 : this.targettemp;
        !this.currentstate ? this.currentstate = 0 : this.currentstate;
        !this.targetstate ? this.targetstate = 0 : this.targetstate;

        this.url_devices = "https://my.tado.com/api/v2/homes/" + this.homeID +
            "/zones/" + this.zoneID +
            "/devices?password=" + this.password +
            "&username=" + this.username;

        this.url_state = "https://my.tado.com/api/v2/homes/" + this.homeID +
            "/zones/" + this.zoneID + "/state?password=" + this.password +
            "&username=" + this.username;

        this.getContent = function(url) {

            return new Promise((resolve, reject) => {

                const lib = url.startsWith('https') ? require('https') : require('http');

                const request = lib.get(url, (response) => {

                    if (response.statusCode < 200 || response.statusCode > 299) {
                        reject(new Error('Failed to load data, status code: ' + response.statusCode));
                    }

                    const body = [];
                    response.on('data', (chunk) => body.push(chunk));
                    response.on('end', () => resolve(body.join('')));
                });

                request.on('error', (err) => reject(err))

            })

        };

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
            .updateValue(this.currentstate)
            .setProps({
                format: Characteristic.Formats.UINT8,
                maxValue: 3,
                minValue: 0,
                validValues: [0, 1, 2, 3],
                perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
            });

        Characteristic.CurrentHeatingCoolingState.AUTO = 3;

        this.Thermostat.getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .updateValue(this.targetstate)
            .on('set', this.setTargetHeatingCoolingState.bind(this))
            .setProps({
                format: Characteristic.Formats.UINT8,
                maxValue: 3,
                minValue: 0,
                validValues: [0, 1, 2, 3],
                perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
            });

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

        self.getContent(self.url_devices)
            .then((data) => {
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
                setTimeout(function() {
                    self._updateBatteryValues();
                }, 30 * 60 * 1000)
            })
            .catch((err) => {
                self.log(self.name + ": " + err + " - Trying again");
                self.BatteryService.getCharacteristic(Characteristic.BatteryLevel)
                    .updateValue(self.batteryLevel);
                self.BatteryService.getCharacteristic(Characteristic.StatusLowBattery)
                    .updateValue(self.batteryStatus);
                setTimeout(function() {
                    self._updateBatteryValues();
                }, 15000)
            });

    }

    _updateThermostatValues() {

        var self = this;

        self.getContent(self.url_state)
            .then((data) => {
                var result = JSON.parse(data);

                if (result.sensorDataPoints != undefined) {

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

                            self.currentstate = 3;
                            self.targetstate = 3;

                        } else {

                            if (Math.round(self.currenttemp) >= Math.round(self.targettemp)) {
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

                }

                self.Thermostat.getCharacteristic(Characteristic.CurrentTemperature).updateValue(self.currenttemp);
                self.Thermostat.getCharacteristic(Characteristic.TargetTemperature).updateValue(self.targettemp);
                self.Thermostat.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(self.humidity);
                self.Thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(self.currentstate);
                self.Thermostat.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(self.targetstate);
                setTimeout(function() {
                    self._updateThermostatValues();
                }, self.interval)
            })
            .catch((err) => {
                self.log(self.name + ": " + err + " - Trying again");
                self.Thermostat.getCharacteristic(Characteristic.CurrentTemperature).updateValue(self.currenttemp);
                self.Thermostat.getCharacteristic(Characteristic.TargetTemperature).updateValue(self.targettemp);
                self.Thermostat.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(self.humidity);
                self.Thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(self.currentstate);
                self.Thermostat.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(self.targetstate);
                setTimeout(function() {
                    self._updateThermostatValues();
                }, 15000)
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

        switch (state) {
            case Characteristic.TargetHeatingCoolingState.OFF:

                var options = {
                    host: 'my.tado.com',
                    path: "/api/v2/homes/" + self.homeID + "/zones/" + self.zoneID + "/overlay?username=" + self.username + "&password=" + self.password,
                    method: 'PUT'
                };

                var post_data = JSON.stringify({
                    "setting": {
                        "type": "HEATING",
                        "power": "OFF"
                    },
                    "termination": {
                        "type": "MANUAL"
                    }
                });

                var req = https.request(options, function(res) {
                    self.log(self.displayName + ": Switched OFF");
                });

                req.on('error', function(err) {
                    self.log(self.displayName + " - Error: " + err);
                });

                req.write(post_data);
                req.end();

                self.Thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(0);

                callback()

                break;

            case Characteristic.TargetHeatingCoolingState.HEAT:

                var options = {
                    host: 'my.tado.com',
                    path: "/api/v2/homes/" + self.homeID + "/zones/" + self.zoneID + "/overlay?username=" + self.username + "&password=" + self.password,
                    method: 'PUT'
                };

                var setTemp = self.currenttemp + self.heatValue;

                if (self.tempUnit == "CELSIUS") {
                    if (setTemp > 25) {
                        setTemp = 25;
                    } else if (setTemp < 5) {
                        setTemp = 5;
                    }
                } else {
                    if (setTemp > 77) {
                        setTemp = 77;
                    } else if (setTemp < 41) {
                        setTemp = 41;
                    }
                }

                var post_data = JSON.stringify({
                    "setting": {
                        "type": "HEATING",
                        "power": "ON",
                        "temperature": {
                            "celsius": setTemp
                        }
                    },
                    "termination": {
                        "type": "MANUAL"
                    }
                });

                var req = https.request(options, function(res) {
                    self.log(self.displayName + ": Switched to HEAT");
                });

                req.on('error', function(err) {
                    self.log(self.displayName + " - Error: " + err);
                });

                req.write(post_data);
                req.end();

                self.Thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(1);

                callback()

                break;

            case Characteristic.TargetHeatingCoolingState.COOL:

                var options = {
                    host: 'my.tado.com',
                    path: "/api/v2/homes/" + self.homeID + "/zones/" + self.zoneID + "/overlay?username=" + self.username + "&password=" + self.password,
                    method: 'PUT'
                };

                var setTemp = self.currenttemp - self.coolValue;

                if (self.tempUnit == "CELSIUS") {
                    if (setTemp > 25) {
                        setTemp = 25;
                    } else if (setTemp < 5) {
                        setTemp = 5;
                    }
                } else {
                    if (setTemp > 77) {
                        setTemp = 77;
                    } else if (setTemp < 41) {
                        setTemp = 41;
                    }
                }

                var post_data = JSON.stringify({
                    "setting": {
                        "type": "HEATING",
                        "power": "ON",
                        "temperature": {
                            "celsius": setTemp
                        }
                    },
                    "termination": {
                        "type": "MANUAL"
                    }
                });

                var req = https.request(options, function(res) {
                    self.log(self.displayName + ": Switched to COOL");
                });

                req.on('error', function(err) {
                    self.log(self.displayName + " - Error: " + err);
                });

                req.write(post_data);
                req.end();

                self.Thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(2);

                callback()

                break;

            case Characteristic.TargetHeatingCoolingState.AUTO:

                var options = {
                    host: 'my.tado.com',
                    path: "/api/v2/homes/" + self.homeID + "/zones/" + self.zoneID + "/overlay?username=" + self.username + "&password=" + self.password,
                    method: 'DELETE'
                };

                if (self.delaytimer > 0) {

                    self.log(self.displayName + ": Switching to automatic mode in " + self.delaytimer / 1000 + " seconds...");

                    function sleep(time) {
                        return new Promise((resolve) => setTimeout(resolve, time));
                    }

                    sleep(self.delaytimer).then(() => {

                        var req = https.request(options, function(res) {
                            self.log(self.displayName + ": Switched to AUTO");
                        });

                        req.on('error', function(err) {
                            self.log(self.displayName + " - Error: " + err);
                        });

                        req.end();

                        self.Thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(0);

                    });

                } else {

                    var req = https.request(options, function(res) {
                        self.log(self.displayName + ": Switched to AUTO");
                    });

                    req.on('error', function(err) {
                        self.log(self.displayName + " - Error: " + err);
                    });

                    req.end();

                    self.Thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(3);

                }

                callback()

                break;
        }

    }

    setTargetTemperature(value, callback) {

        var self = this;

        if (self.targetstate == 0) {
            self.log("Can't set new Temperature, Thermostat is off");
            callback()
        } else if (self.targetstate == 3) {
            self.log("Can't set new Temperature, Thermostat is in auto mode");
            callback()
        } else {

            var options = {
                host: 'my.tado.com',
                path: "/api/v2/homes/" + self.homeID + "/zones/" + self.zoneID + "/overlay?username=" + self.username + "&password=" + self.password,
                method: 'PUT'
            };

            var post_data = JSON.stringify({
                "setting": {
                    "type": "HEATING",
                    "power": "ON",
                    "temperature": {
                        "celsius": value
                    }
                },
                "termination": {
                    "type": "MANUAL"
                }
            });

            var req = https.request(options, function(res) {
                self.log(self.displayName + ": " + value);
            });

            req.on('error', function(err) {
                self.log(self.displayName + " - Error: " + err);
            });

            req.write(post_data);
            req.end();

            callback()
        }

    }
}

module.exports = THERMOSTAT
