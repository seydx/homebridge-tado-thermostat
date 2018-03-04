var rp = require("request-promise"),
    async = require("async");

var HK_REQS = require('./src/Requests.js'),
    Tado_Thermostat = require('./src/Thermostat.js'),
    Tado_Weather = require('./src/Weather.js'),
    Tado_WeatherService = require('./src/WeatherService.js'),
    Tado_Occupancy = require('./src/Occupancy.js'),
    Tado_Windows = require('./src/Window.js'),
    Tado_Switch = require('./src/Switch.js');

var Accessory,
    Service,
    Characteristic;

module.exports = function(homebridge) {

    Accessory = homebridge.platformAccessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    HomebridgeAPI = homebridge;

    homebridge.registerPlatform("homebridge-tado-thermostat", "TadoThermostat", TadoThermostatPlatform);
}

function TadoThermostatPlatform(log, config, api) {

    //Homebridge
    this.api = api;
    this.log = log;
    this.config = config;

    //Base Config
    this.name = config["name"] || "Tado";
    this.username = config["username"];
    if (!config.username) throw new Error("Username is required!");
    this.password = config["password"];
    if (!config.password) throw new Error("Password is required!");

    //Thermostat Config
    this.coolValue = config["coolValue"] || 4;
    this.heatValue = config["heatValue"] || 4;
    this.delaytimer = (config["delaytimer"] * 1000);

    //Extras Config
    this.weatherEnabled = config["weatherEnabled"] || false;
    this.weatherServiceEnabled = config["weatherServiceEnabled"] || false;
    this.occupancyEnabled = config["occupancyEnabled"] || false;
    this.windowDetection = config["windowDetection"] || false;
    this.centralSwitch = config["centralSwitch"] || false;

}

TadoThermostatPlatform.prototype = {
    accessories: function(callback) {

        var accessoriesArray = []
        this.idArray = []
        var self = this;

        async.waterfall([

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
                                self.log("HomeID Error: " + err);
                                setTimeout(function() {
                                    fetchHomeID(next)
                                }, 10000)
                            }

                        });

                }
                fetchHomeID(next)
            },

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
                                self.log("Temperature Unit: No connection - Trying to reconnect...");
                                setTimeout(function() {
                                    fetchTemperatureUnit(next)
                                }, 10000)
                            } else {
                                self.log("Temperature Unit Error: " + err);
                                setTimeout(function() {
                                    fetchTemperatureUnit(next)
                                }, 10000)
                            }

                        });

                }
                fetchTemperatureUnit(next)
            },

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

                                    self.idArray.push(zones[i].id);

                                    var devices = zones[i].devices;
                                    var zonename = zones[i].name;

                                    for (var j = 0; j < devices.length; j++) {

                                        devices.length > 1 ? zonename = zones[i].name + " " + j : zonename = zones[i].name;

                                        if (devices[j].deviceType.match("VA01") || devices[j].deviceType.match("RU01")) {

                                            toConfig = {
                                                name: zonename,
                                                id: zones[i].id,
                                                homeID: self.homeID,
                                                username: self.username,
                                                password: self.password,
                                                coolValue: self.coolValue,
                                                heatValue: self.heatValue,
                                                tempUnit: self.tempUnit,
                                                targetMinValue: self.targetMinValue,
                                                targetMaxValue: self.targetMaxValue,
                                                serialNo: zones[i].devices[j].serialNo,
                                                delaytimer: self.delaytimer
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
                                self.log("Zone Error: " + err);
                                setTimeout(function() {
                                    fetchZones(next)
                                }, 10000)
                            }

                        });

                }
                fetchZones(next)
            },

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

            },

            function(next) {

                function fetchOccupancy(next) {

                    self.get = new HK_REQS(self.username, self.password, self.homeID, {
                        "token": process.argv[2]
                    });

                    self.get.HOME_MOBILEDEVICES()
                        .then(response => {

                            var occupancies = response;
                            var occupancyArray = []

                            for (var i = 0; i < occupancies.length; i++) {
                                if (occupancies[i].settings.geoTrackingEnabled == true) {

                                    toConfig = {
                                        name: occupancies[i].name,
                                        id: occupancies[i].id,
                                        homeID: self.homeID,
                                        username: self.username,
                                        password: self.password
                                    }

                                    self.log("Found new User: " + toConfig.name)
                                    occupancyArray.push(toConfig);

                                }
                            }

                            if (occupancyArray.length > 0) {
                                toConfig = {
                                    name: "Anyone",
                                    id: 999999,
                                    homeID: self.homeID,
                                    username: self.username,
                                    password: self.password
                                }

                                self.log("Adding ANYONE sensor");
                                occupancyArray.push(toConfig);
                            }

                            next(null, occupancyArray)

                        })
                        .catch(err => {

                            if (err.message.match("ETIMEDOUT") || err.message.match("EHOSTUNREACH")) {
                                self.log("Occupancy: No connection - Trying to reconnect...");
                                setTimeout(function() {
                                    fetchOccupancy(next)
                                }, 10000)
                            } else {
                                self.log("Occupancy Error: " + err);
                                setTimeout(function() {
                                    fetchOccupancy(next)
                                }, 10000)
                            }

                        });
                }
                fetchOccupancy(next)
            },

            function(occupancyArray, next) {
                if (self.occupancyEnabled) {
                    async.forEachOf(occupancyArray, function(zone, key, step) {

                        function pushMyAccessories(step) {

                            var tadoAccessory = new Tado_Occupancy(self.log, zone, self.api)
                            accessoriesArray.push(tadoAccessory);
                            step()

                        }
                        pushMyAccessories(step)

                    }, function(err) {
                        if (err) next(err)
                        else next()
                    })
                } else {
                    next()
                }
            },

            function(next) {

                function fetchWindows(next) {

                    self.get = new HK_REQS(self.username, self.password, self.homeID, {
                        "token": process.argv[2]
                    });

                    self.get.HOME_ZONES()
                        .then(response => {

                            var windows = response;
                            var windowArray = []

                            for (var i = 0; i < windows.length; i++) {
                                if (windows[i].openWindowDetection.supported == true && self.windowDetection == true) {

                                    if (windows[i].openWindowDetection.enabled == true) {

                                        toConfig = {
                                            name: windows[i].name + " Window",
                                            homeID: self.homeID,
                                            zoneID: windows[i].id,
                                            username: self.username,
                                            password: self.password,
                                            timeout: windows[i].openWindowDetection.timeoutInSeconds
                                        }

                                        self.log("Found new window: " + toConfig.name)
                                        windowArray.push(toConfig);

                                    } else {

                                        self.log(windows[i].name + ": Please activate Open weather detection in your Tado app!")

                                    }

                                }
                            }

                            next(null, windowArray)

                        })
                        .catch(err => {

                            if (err.message.match("ETIMEDOUT") || err.message.match("EHOSTUNREACH")) {
                                self.log("Window Detection: No connection - Trying to reconnect...");
                                setTimeout(function() {
                                    fetchOccupancy(next)
                                }, 10000)
                            } else {
                                self.log("Detection Error: " + err);
                                setTimeout(function() {
                                    fetchWindows(next)
                                }, 10000)
                            }

                        });
                }
                fetchWindows(next)
            },

            function(windowArray, next) {
                if (self.windowDetection) {
                    async.forEachOf(windowArray, function(zone, key, step) {

                        function pushMyAccessories(step) {

                            var tadoAccessory = new Tado_Windows(self.log, zone, self.api)
                            accessoriesArray.push(tadoAccessory);
                            step()

                        }
                        pushMyAccessories(step)

                    }, function(err) {
                        if (err) next(err)
                        else next()
                    })
                } else {
                    next()
                }
            },

            function(next) {
                if (self.weatherEnabled) {
                    var weatherConfig = {
                        name: "Weather",
                        homeID: self.homeID,
                        username: self.username,
                        password: self.password,
                        tempUnit: self.tempUnit
                    }
                    var weatherAccessory = new Tado_Weather(self.log, weatherConfig, self.api)
                    accessoriesArray.push(weatherAccessory);
                }
                next();
            },

            function(next) {
                if (self.weatherServiceEnabled) {
                    var weatherServiceConfig = {
                        name: "Weather Service",
                        homeID: self.homeID,
                        username: self.username,
                        password: self.password
                    }
                    var weatherServiceAccessory = new Tado_WeatherService(self.log, weatherServiceConfig, self.api)
                    accessoriesArray.push(weatherServiceAccessory);
                }
                next();
            },

            function(next) {
                if (self.centralSwitch) {

                    var centralSwitchConfig = {
                        name: "Central Switch",
                        homeID: self.homeID,
                        username: self.username,
                        password: self.password,
                        roomids: JSON.stringify(self.idArray)
                    }
                    var centralSwitchAccessory = new Tado_Switch(self.log, centralSwitchConfig, self.api)
                    accessoriesArray.push(centralSwitchAccessory);
                }
                next();
            }

        ], function(err, result) {
            if (err) callback(err)
            else callback(accessoriesArray);
        })
    }
}
