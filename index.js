var rp = require("request-promise"),
    async = require("async");

var HK_REQS = require('./src/Requests.js');
var Tado_Thermostat = require('./src/Thermostat.js');

var Accessory, Service, Characteristic;

module.exports = function(homebridge) {

    Accessory = homebridge.platformAccessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    HomebridgeAPI = homebridge;

    homebridge.registerPlatform("homebridge-tado-thermostat", "TadoThermostat", TadoThermostatPlatform);
}

function TadoThermostatPlatform(log, config, api) {
    var platform = this;

    this.api = api;
    this.log = log;
    this.config = config;
    this.name = config["name"] || "Tado";
    this.username = config["username"];
    this.password = config["password"];
    this.polling = config["polling"] === true;
    this.interval = (config["interval"] * 1000) || 3000;
    this.coolValue = config["coolValue"] || 4;
    this.heatValue = config["heatValue"] || 4;
}

TadoThermostatPlatform.prototype = {
    accessories: function(callback) {

        var accessoriesArray = []
        var self = this;

        async.waterfall([

            // Get HomeID
            function(next) {
                function fetchHomeID(next) {

                    self.get = new HK_REQS(self.username, self.password, self.homeID, {
                        "token": process.argv[2]
                    });

                    self.log("Getting HomeID...")

                    self.get.HOME_ID()
                        .then(response => {

                            self.homeID = response.homes[0].id;
                            self.log("Home ID is: " + self.homeID);

                            next()
                        })
                        .catch(err => {

                            if (err.message.match("ETIMEDOUT") || err.message.match("EHOSTUNREACH")) {
                                self.log("HomeID: No connection - Trying to reconnect...");
                                setTimeout(function() {
                                    fetchHomeID(next)
                                }, 10000)
                            } else {
                                self.log("Fetching Home ID failed - Trying again..." + err);
                                setTimeout(function() {
                                    fetchHomeID(next)
                                }, 10000)
                            }

                        });


                }
                fetchHomeID(next)
            },


            // get temperatureUnit
            function(next) {
                function fetchTemperatureUnit(next) {

                    self.get = new HK_REQS(self.username, self.password, self.homeID, {
                        "token": process.argv[2]
                    });

                    self.log("Getting Temp Unit...")

                    self.get.TEMP_UNIT()
                        .then(response => {

                            self.tempUnit = response.temperatureUnit;

                            self.log("Temperature Unit is: " + self.tempUnit);

                            if (self.tempUnit = "CELSIUS") {
                                self.targetMinValue = 5;
                                self.targetMaxValue = 25;
                            } else {
                                self.targetMinValue = 41;
                                self.targetMaxValue = 77;
                            }
                            next()

                        })
                        .catch(err => {

                            if (err.message.match("ETIMEDOUT") || err.message.match("EHOSTUNREACH")) {
                                self.log("TempUnit: No connection - Trying to reconnect...");
                                setTimeout(function() {
                                    fetchTemperatureUnit(next)
                                }, 10000)
                            } else {
                                self.log("Fetching Temp Unit failed - Trying again..." + err);
                                setTimeout(function() {
                                    fetchTemperatureUnit(next)
                                }, 10000)
                            }

                        });

                }
                fetchTemperatureUnit(next)
            },

            // get Zones
            function(next) {
                function fetchZones(next) {

                    self.get = new HK_REQS(self.username, self.password, self.homeID, {
                        "token": process.argv[2]
                    });

                    self.get.HOME_ZONES()
                        .then(response => {

                            var zones = response;
                            var zonesArray = []

                            for (var i = 0; i < zones.length; i++) {
                                if (zones[i].type.match("HEATING")) {

                                    var devices = zones[i].devices;

                                    for (var j = 0; j < devices.length; j++) {
                                        if (devices[j].deviceType.match("VA01") || devices[j].deviceType.match("RU01")) {

                                            toConfig = {
                                                name: zones[i].name + " " + j,
                                                id: zones[i].id,
                                                homeID: self.homeID,
                                                username: self.username,
                                                password: self.password,
                                                polling: self.polling,
                                                interval: self.interval,
                                                coolValue: self.coolValue,
                                                heatValue: self.heatValue,
                                                tempUnit: self.tempUnit,
                                                targetMinValue: self.targetMinValue,
                                                targetMaxValue: self.targetMaxValue,
                                                serialNo: zones[i].devices[j].serialNo
                                            }

                                            self.log("Found new Zone: " + toConfig.name + " (" + toConfig.id + " | " + devices[j].deviceType + ")")
                                            zonesArray.push(toConfig);

                                        }
                                    }

                                }
                            }

                            next(null, zonesArray)

                        })
                        .catch(err => {

                            if (err.message.match("ETIMEDOUT") || err.message.match("EHOSTUNREACH")) {
                                self.log("Zones: No connection - Trying to reconnect...");
                                setTimeout(function() {
                                    fetchZones(next)
                                }, 10000)
                            } else {
                                self.log(err);
                                setTimeout(function() {
                                    fetchZones(next)
                                }, 10000)
                            }

                        });


                }
                fetchZones(next)
            },

            // Create Accessories  
            function(zonesArray, next) {

                async.forEachOf(zonesArray, function(zone, key, step) {

                    function pushMyAccessories(step) {

                        var tadoAccessory = new Tado_Thermostat(self.log, zone, self.api)
                        accessoriesArray.push(tadoAccessory);
                        step()

                    }
                    pushMyAccessories(step)

                }, function(err) {
                    if (err) next(err)
                    else next()
                })

            }

        ], function(err, result) {
            if (err) callback(err)
            else callback(accessoriesArray);
        })
    }
}
