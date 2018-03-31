var moment = require('moment'),
    inherits = require("util").inherits,
    https = require('https');

var Accessory,
    Service,
    Characteristic,
    FakeGatoHistoryService;

class BOILER {

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
        this.interval = config.interval + 2000;

        !this.currenttemp ? this.currenttemp = 0 : this.currenttemp;
        !this.targettemp ? this.targettemp = 0 : this.targettemp;
        !this.currentstate ? this.currentstate = 0 : this.currentstate;
        !this.targetstate ? this.targetstate = 0 : this.targetstate;

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

        this.storage = require('node-persist');
        this.storage.initSync({
            dir: platform.api.user.persistPath()
        });

    }

    getServices() {

        var accessory = this;

        this.informationService = new Service.AccessoryInformation()
            .setCharacteristic(Characteristic.Name, this.displayName)
            .setCharacteristic(Characteristic.Identify, this.displayName)
            .setCharacteristic(Characteristic.Manufacturer, 'Tado GmbH')
            .setCharacteristic(Characteristic.Model, 'Hot Water')
            .setCharacteristic(Characteristic.SerialNumber, "HW-" + this.serialNo)
            .setCharacteristic(Characteristic.FirmwareRevision, require('../package.json').version);

        this.Thermostat = new Service.Thermostat(this.displayName);

        this.Thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
            .updateValue(this.currentstate)
            .setProps({
                format: Characteristic.Formats.UINT8,
                maxValue: 3,
                minValue: 0,
                validValues: [0, 1, 2, 3],
                perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
            });

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

        this.historyService = new FakeGatoHistoryService("weather", this, {
            storage: 'fs',
            disableTimer: true,
            path: this.api.user.cachedAccessoryPath()
        });

        this._updateThermostatValues();

        (function poll() {
            setTimeout(function() {
                accessory.getHistory();
                poll();
            }, 5 * 60 * 1000)
        })();

        return [this.informationService, this.Thermostat, this.historyService];

    }

    _updateThermostatValues() {

        var self = this;

        self.getContent(self.url_state)
            .then((data) => {
                var result = JSON.parse(data);

                if (result.setting != undefined) {

                    if (result.setting.power == "ON") {

                        if (self.tempUnit == "CELSIUS") {
                            self.currenttemp = result.setting.temperature.celsius;
                            self.targettemp = result.setting.temperature.celsius;
                        } else {
                            self.currenttemp = result.setting.temperature.fahrenheit;
                            self.targettemp = result.setting.temperature.fahrenheit;
                        }

                        if (result.overlayType == null) {

                            self.currentstate = 3;
                            self.targetstate = 3;

                        } else {

                            self.currentstate = 1;
                            self.targetstate = 1;

                        }

                        if (self.currenttemp != null || self.currenttemp != undefined) {
                            self.storage.setItem("TadoTemp", self.currenttemp);
                        }

                    } else {

                        self.currentstate = 0;
                        self.targetstate = 0;

                        if (self.storage.getItem("TadoTemp") == null || self.storage.getItem("TadoTemp") == undefined) {
                            self.currenttemp = 0;
                        } else {
                            self.currenttemp = self.storage.getItem("TadoTemp");
                        }

                    }

                }

                self.Thermostat.getCharacteristic(Characteristic.CurrentTemperature).updateValue(self.currenttemp);
                self.Thermostat.getCharacteristic(Characteristic.TargetTemperature).updateValue(self.targettemp);
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
            humidity: 0
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
                    method: 'PUT',
                    headers: {
	                    'Content-Type': 'application/json'
                    }
                };

                var post_data = JSON.stringify({
                    "setting": {
                        "type": "HOT_WATER",
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

                var setTemp = self.currenttemp + self.heatValue;

                if (self.tempUnit == "CELSIUS") {
                    if (setTemp > 65) {
                        setTemp = 65;
                    } else if (setTemp < 30) {
                        setTemp = 30;
                    } else {
                        setTemp = self.currenttemp + self.heatValue;
                    }
                } else {
                    if (setTemp > 149) {
                        setTemp = 149;
                    } else if (setTemp < 86) {
                        setTemp = 86;
                    } else {
                        setTemp = self.currenttemp + self.heatValue;
                    }
                }

                var options = {
                    host: 'my.tado.com',
                    path: "/api/v2/homes/" + self.homeID + "/zones/" + self.zoneID + "/overlay?username=" + self.username + "&password=" + self.password,
                    method: 'PUT',
                    headers: {
	                    'Content-Type': 'application/json'
                    }
                };

                var post_data = JSON.stringify({
                    "setting": {
                        "type": "HOT_WATER",
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

                var setTemp = self.currenttemp - self.coolValue;

                if (self.tempUnit == "CELSIUS") {
                    if (setTemp > 65) {
                        setTemp = 65;
                    } else if (setTemp < 30) {
                        setTemp = 30;
                    } else {
                        setTemp = self.currenttemp - self.coolValue;
                    }
                } else {
                    if (setTemp > 149) {
                        setTemp = 149;
                    } else if (setTemp < 86) {
                        setTemp = 86;
                    } else {
                        setTemp = self.currenttemp - self.coolValue;
                    }
                }

                var options = {
                    host: 'my.tado.com',
                    path: "/api/v2/homes/" + self.homeID + "/zones/" + self.zoneID + "/overlay?username=" + self.username + "&password=" + self.password,
                    method: 'PUT',
                    headers: {
	                    'Content-Type': 'application/json'
                    }
                };

                var post_data = JSON.stringify({
                    "setting": {
                        "type": "HOT_WATER",
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

                self.Thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(1);

                callback()

                break;

            case Characteristic.TargetHeatingCoolingState.AUTO:

                var options = {
                    host: 'my.tado.com',
                    path: "/api/v2/homes/" + self.homeID + "/zones/" + self.zoneID + "/overlay?username=" + self.username + "&password=" + self.password,
                    method: 'DELETE',
                    headers: {
	                    'Content-Type': 'application/json'
                    }
                };

                var req = https.request(options, function(res) {
                    self.log(self.displayName + ": Switched to AUTO");
                });

                req.on('error', function(err) {
                    self.log(self.displayName + " - Error: " + err);
                });

                req.end();

                self.Thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(3);

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
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            var post_data = JSON.stringify({
                "setting": {
                    "type": "HOT_WATER",
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

            self.Thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(1);

            callback()
        }

    }
}

module.exports = BOILER
