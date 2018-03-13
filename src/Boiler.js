var moment = require('moment'),
    rp = require("request"),
    pollingtoevent = require("polling-to-event"),
    inherits = require("util").inherits;

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
        this.delaytimer = config.delaytimer;

        !this.currenttemp ? this.currenttemp = 0 : this.currenttemp;
        !this.targettemp ? this.targettemp = 0 : this.targettemp;
        !this.currentstate ? this.currentstate = 0 : this.currentstate;
        !this.targetstate ? this.targetstate = 0 : this.targetstate;

        this.url_state = "https://my.tado.com/api/v2/homes/" + this.homeID +
            "/zones/" + this.zoneID + "/state?password=" + this.password +
            "&username=" + this.username;

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
                maxValue: 1,
                minValue: 0,
                validValues: [0, 1],
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

        var emitter_state = pollingtoevent(function(done) {
            rp.get(self.url_state, function(err, req, data) {
                done(err, data);
            });
        }, {
            longpolling: false,
            interval: 5000
        });

        emitter_state
            .on("poll", function(data) {

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

                            self.currentstate = 0;
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

            })
            .on("error", function(err) {
                self.log(self.name + ": An Error occured: %s", err.code + " - Polling again..");
                self.Thermostat.getCharacteristic(Characteristic.CurrentTemperature).updateValue(self.currenttemp);
                self.Thermostat.getCharacteristic(Characteristic.TargetTemperature).updateValue(self.targettemp);
                self.Thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(self.currentstate);
                self.Thermostat.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(self.targetstate);
                emitter_state.pause();
                setTimeout(function() {
                    emitter_state.resume();
                }, 10000)
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

        var url = "https://my.tado.com/api/v2/homes/" + self.homeID + "/zones/" + self.zoneID + "/overlay?username=" + self.username + "&password=" + self.password;

        switch (state) {
            case Characteristic.TargetHeatingCoolingState.OFF:

                rp({
                        url: url,
                        method: 'PUT',
                        json: {
                            "setting": {
                                "type": "HOT_WATER",
                                "power": "OFF"
                            },
                            "termination": {
                                "type": "MANUAL"
                            }
                        }
                    })
                    .on('response', function(res) {
                        self.log(self.displayName + ": Switched OFF");
                    })
                    .on('error', function(err) {
                        self.log(self.displayName + " - Error: " + err);
                    })

                callback()

                break;

            case Characteristic.TargetHeatingCoolingState.HEAT:
            
                var setTemp = self.currenttemp + self.heatValue;

                rp({
                        url: url,
                        method: 'PUT',
                        json: {
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
                        }
                    })
                    .on('response', function(res) {
                        self.log(self.displayName + ": Switched to HEAT");
                    })
                    .on('error', function(err) {
                        self.log(self.displayName + " - Error: " + err);
                    })

                callback()

                break;

            case Characteristic.TargetHeatingCoolingState.COOL:
            
                var setTemp = self.currenttemp - self.coolValue;

                rp({
                        url: url,
                        method: 'PUT',
                        json: {
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
                        }
                    })
                    .on('response', function(res) {
                        self.log(self.displayName + ": Switched to COOL");
                    })
                    .on('error', function(err) {
                        self.log(self.displayName + " - Error: " + err);
                    })

                callback()

                break;

            case Characteristic.TargetHeatingCoolingState.AUTO:

                rp({
                        url: url,
                        method: 'DELETE'
                    })
                    .on('response', function(res) {
                        self.log(self.displayName + ": Switched to AUTO");
                    })
                    .on('error', function(err) {
                        self.log(self.displayName + " - Error: " + err);
                    })

                self.Thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(0);

                callback()

                break;
        }

    }

    setTargetTemperature(value, callback) {

        var self = this;

        var url = "https://my.tado.com/api/v2/homes/" + self.homeID + "/zones/" + self.zoneID + "/overlay?username=" + self.username + "&password=" + self.password;

        if (self.targetstate == 0) {
            self.log("Can't set new Temperature, Thermostat is off");
            callback()
        } else if (self.targetstate == 3) {
            self.log("Can't set new Temperature, Thermostat is in auto mode");
            callback()
        } else {

            var onOff = "ON"

            rp({
                    url: url,
                    method: 'PUT',
                    json: {
                        "setting": {
                            "type": "HOT_WATER",
                            "power": onOff,
                            "temperature": {
                                "celsius": value
                            }
                        },
                        "termination": {
                            "type": "MANUAL"
                        }
                    }
                })
                .on('response', function(res) {
                    self.log(self.displayName + ": " + value);
                })
                .on('error', function(err) {
                    self.log(self.displayName + " - Error: " + err);
                })

            callback()
        }

    }
}

module.exports = BOILER
