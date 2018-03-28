var async = require("async");

var Tado_Thermostat = require('./src/Thermostat.js'),
    Tado_Boiler = require('./src/Boiler.js'),
    Tado_Weather = require('./src/Weather.js'),
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

    homebridge.registerPlatform("homebridge-tado-thermostat", "TadoThermostat", TadoThermostatPlatform);
}

function TadoThermostatPlatform(log, config, api) {

    //Homebridge
    this.api = api;
    this.log = log;
    this.config = config;

    //Base Config
    this.name = config["name"] || "Tado";
    this.username = encodeURIComponent(config["username"]);
    if (!this.username) throw new Error("Username is required!");
    this.password = encodeURIComponent(config["password"]);
    if (!this.password) throw new Error("Password is required!");

    this.homeID = config["homeID"] || "";
    this.tempUnit = config["tempUnit"] || "";

    //Intervals
    this.interval = (config["interval"] * 1000) || 10000;
    this.weatherInterval = 8 * 60 * 1000;
    this.weatherServiceInterval = 15 * 60 * 1000;
    this.occupancyInterval = 10 * 1000;

    //Thermostat Config
    this.coolValue = config["coolValue"] || 4;
    this.heatValue = config["heatValue"] || 4;
    this.delaytimer = (config["delaytimer"] * 1000) || 0;
    this.includeTypes = config["includeTypes"];
    if (!this.includeTypes) {
        this.includeTypes = ["VA01", "RU01"]
    }
    this.onePerRoom = config["onePerRoom"] || false;

    //Boiler Config
    this.boilerEnabled = config["boilerEnabled"] || false;
    this.coolValueBoiler = config["coolValueBoiler"] || 10;
    this.heatValueBoiler = config["heatValueBoiler"] || 10;
    this.boilerType = config["boilerType"] || "BU01";

    //Weather Config
    this.weatherEnabled = config["weatherEnabled"] || false;
    this.weatherAPI = config["weatherAPI"] || "";
    this.weatherLocation = config["weatherLocation"] || "";

    //Extras Config
    this.occupancyEnabled = config["occupancyEnabled"] || false;
    this.windowDetection = config["windowDetection"] || false;
    this.centralSwitch = config["centralSwitch"] || false;

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

TadoThermostatPlatform.prototype = {
    accessories: function(callback) {

        var accessoriesArray = []
        this.idArray = []
        var self = this;

        async.waterfall([

            function(next) {
                function fetchHomeID(next) {

                    if (!self.homeID || self.homeID == "" || self.homeID == undefined || self.homeID == null) {

                        self.log("Getting HomeID...")

                        self.getContent("https://my.tado.com/api/v2/me?username=" + self.username + "&password=" + self.password)
                            .then((data) => {
                                var response = JSON.parse(data);

                                self.homeID = response.homes[0].id;
                                self.log("Home ID is: " + self.homeID);

                                next()
                            })
                            .catch((err) => {
                                self.log("HomeID Error: " + err);
                                setTimeout(function() {
                                    fetchHomeID(next)
                                }, 10000)
                            });

                    } else {

                        self.log("Home ID found in config. Home ID: " + self.homeID);
                        next()

                    }

                }
                fetchHomeID(next)
            },

            function(next) {
                function fetchTemperatureUnit(next) {

                    if (!self.tempUnit || self.tempUnit == "" || self.tempUnit == undefined) {

                        self.log("Getting Temperature Unit...")

                        self.getContent("https://my.tado.com/api/v2/homes/" + self.homeID + "?username=" + self.username + "&password=" + self.password)
                            .then((data) => {
                                var response = JSON.parse(data);

                                self.tempUnit = response.temperatureUnit;

                                self.log("Temperature Unit is: " + self.tempUnit);

                                if (self.tempUnit = "CELSIUS") {
                                    self.targetMinValue = 5;
                                    self.targetMaxValue = 25;
                                    self.targetMinBoilerValue = 30;
                                    self.targetMaxBoilerValue = 65;
                                } else {
                                    self.targetMinValue = 41;
                                    self.targetMaxValue = 77;
                                    self.targetMinBoilerValue = 86;
                                    self.targetMaxBoilerValue = 149;
                                }

                                next()
                            })
                            .catch((err) => {
                                self.log("Temperature Unit Error: " + err);
                                setTimeout(function() {
                                    fetchTemperatureUnit(next)
                                }, 10000)
                            });

                    } else {

                        self.log("Temperature Unit found in config. Unit: " + self.tempUnit);

                        if (self.tempUnit = "CELSIUS") {
                            self.targetMinValue = 5;
                            self.targetMaxValue = 25;
                            self.targetMinBoilerValue = 30;
                            self.targetMaxBoilerValue = 65;
                        } else if (self.tempUnit = "FAHRENHEIT") {
                            self.targetMinValue = 41;
                            self.targetMaxValue = 77;
                            self.targetMinBoilerValue = 86;
                            self.targetMaxBoilerValue = 149;
                        } else {
                            self.log("Cant recognize Temperature Unit! Setting it to CELSIUS!")
                            self.tempUnit = "CELSIUS";
                            self.targetMinValue = 5;
                            self.targetMaxValue = 25;
                            self.targetMinBoilerValue = 30;
                            self.targetMaxBoilerValue = 65;
                        }

                        next()

                    }

                }
                fetchTemperatureUnit(next)
            },

            function(next) {
                function fetchZones(next) {

                    self.log("Getting Zones...")

                    self.getContent("https://my.tado.com/api/v2/homes/" + self.homeID + "/zones?username=" + self.username + "&password=" + self.password)
                        .then((data) => {
                            var response = JSON.parse(data);

                            var zones = response;
                            var zonesArray = []
                            var count = 0;

                            for (var i = 0; i < zones.length; i++) {
                                if (zones[i].type.match("HEATING")) {

                                    count += 1;

                                    self.idArray.push(zones[i].id);

                                    var devices = zones[i].devices;
                                    var zonename = zones[i].name;

                                    if (self.onePerRoom) {

                                        toConfig = {
                                            name: zones[i].name,
                                            id: zones[i].id,
                                            homeID: self.homeID,
                                            username: self.username,
                                            password: self.password,
                                            coolValue: self.coolValue,
                                            heatValue: self.heatValue,
                                            tempUnit: self.tempUnit,
                                            targetMinValue: self.targetMinValue,
                                            targetMaxValue: self.targetMaxValue,
                                            delaytimer: self.delaytimer,
                                            interval: self.interval
                                        }

                                        if (zones[i].deviceTypes.includes("RU01")) {
                                            for (var j = 0; j < devices.length; j++) {
                                                if (devices[j].deviceType == "RU01") {
                                                    toConfig["serialNo"] = zones[i].devices[j].serialNo;
                                                    toConfig["deviceType"] = zones[i].devices[j].deviceType;
                                                }
                                            }
                                        } else {
                                            for (var j = 0; j < devices.length; j++) {
                                                if (devices[j].deviceType == "VA01") {
                                                    toConfig["serialNo"] = zones[i].devices[j].serialNo;
                                                    toConfig["deviceType"] = zones[i].devices[j].deviceType;
                                                }
                                            }
                                        }

                                        self.log("Found new Zone: " + toConfig.name + " (" + toConfig.id + " | " + toConfig.deviceType + ")")
                                        zonesArray.push(toConfig);

                                    } else {
                                        for (var j = 0; j < devices.length; j++) {

                                            devices.length > 1 ? zonename = zones[i].name + " " + j : zonename = zones[i].name;

                                            for (var l = 0; l < self.includeTypes.length; l++) {

                                                if (devices[j].deviceType == self.includeTypes[l]) {

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
                                                        delaytimer: self.delaytimer,
                                                        interval: self.interval
                                                    }

                                                    self.log("Found new Zone: " + toConfig.name + " (" + toConfig.id + " | " + devices[j].deviceType + ")")
                                                    zonesArray.push(toConfig);

                                                }

                                            }

                                        }
                                    }

                                }
                            }

                            if (count == 0) {
                                self.log("No Zones found!");
                                count = 0;
                            }

                            next(null, zonesArray)
                        })
                        .catch((err) => {
                            self.log("Zones Error: " + err);
                            setTimeout(function() {
                                fetchZones(next)
                            }, 10000)
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
                function fetchBoiler(next) {

                    if (self.boilerEnabled) {

                        self.log("Getting Boiler...")

                        self.getContent("https://my.tado.com/api/v2/homes/" + self.homeID + "/zones?username=" + self.username + "&password=" + self.password)
                            .then((data) => {
                                var response = JSON.parse(data);

                                var zones = response;
                                var boilerArray = []
                                var count = 0;

                                for (var i = 0; i < zones.length; i++) {
                                    if (zones[i].type.match("HOT_WATER")) {

                                        count += 1;

                                        var devices = zones[i].devices;
                                        var zonename = zones[i].name;

                                        for (var j = 0; j < devices.length; j++) {

                                            devices.length > 1 ? zonename = zones[i].name + " " + j : zonename = zones[i].name;

                                            if (devices[j].deviceType.match(self.boilerType)) {

                                                toConfig = {
                                                    name: zonename + " Hot Water",
                                                    id: zones[i].id,
                                                    homeID: self.homeID,
                                                    username: self.username,
                                                    password: self.password,
                                                    tempUnit: self.tempUnit,
                                                    coolValue: self.coolValueBoiler,
                                                    heatValue: self.heatValueBoiler,
                                                    targetMinValue: self.targetMinBoilerValue,
                                                    targetMaxValue: self.targetMaxBoilerValue,
                                                    serialNo: zones[i].devices[j].shortSerialNo,
                                                    interval: self.interval
                                                }

                                                self.log("Found new Boiler: " + toConfig.name + " (" + toConfig.id + " | " + devices[j].deviceType + ")")
                                                boilerArray.push(toConfig);

                                            }
                                        }

                                    }
                                }

                                if (count == 0) {
                                    self.log("No Boiler installed!");
                                    count = 0;
                                }

                                next(null, boilerArray)
                            })
                            .catch((err) => {
                                self.log("Boiler Error: " + err);
                                setTimeout(function() {
                                    fetchBoiler(next)
                                }, 10000)
                            });

                    } else {
                        var boilerArray;
                        next(null, boilerArray)
                    }

                }
                fetchBoiler(next)
            },

            function(boilerArray, next) {

                async.forEachOf(boilerArray, function(zone, key, step) {

                    function pushMyAccessories(step) {

                        var tadoAccessory = new Tado_Boiler(self.log, zone, self.api)
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

                    if (self.occupancyEnabled) {

                        self.log("Getting User...")

                        self.getContent("https://my.tado.com/api/v2/homes/" + self.homeID + "/mobileDevices?username=" + self.username + "&password=" + self.password)
                            .then((data) => {
                                var response = JSON.parse(data);

                                var occupancies = response;
                                var occupancyArray = []
                                var count = 0;

                                for (var i = 0; i < occupancies.length; i++) {
                                    if (occupancies[i].settings.geoTrackingEnabled == true && self.occupancyEnabled == true) {

                                        count += 1;

                                        toConfig = {
                                            name: occupancies[i].name,
                                            id: occupancies[i].id,
                                            homeID: self.homeID,
                                            username: self.username,
                                            password: self.password,
                                            interval: self.occupancyInterval
                                        }

                                        self.log("Found new User: " + toConfig.name)
                                        occupancyArray.push(toConfig);

                                    }
                                }

                                if (occupancyArray.length > 0 && self.occupancyEnabled == true) {
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

                                if (count == 0) {
                                    self.log("No User found!");
                                    count = 0;
                                }

                                next(null, occupancyArray)
                            })
                            .catch((err) => {
                                self.log("Users Error: " + err);
                                setTimeout(function() {
                                    fetchOccupancy(next)
                                }, 10000)
                            });

                    } else {
                        var occupancyArray;
                        next(null, occupancyArray)
                    }

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

                    if (self.windowDetection) {

                        self.log("Getting Windows...")

                        self.getContent("https://my.tado.com/api/v2/homes/" + self.homeID + "/zones?username=" + self.username + "&password=" + self.password)
                            .then((data) => {
                                var response = JSON.parse(data);

                                var windows = response;
                                var windowArray = []
                                var count = 0;

                                for (var i = 0; i < windows.length; i++) {
                                    if (windows[i].openWindowDetection.supported == true && self.windowDetection == true) {

                                        if (windows[i].openWindowDetection.enabled == true) {

                                            count += 1;

                                            toConfig = {
                                                name: windows[i].name + " Window",
                                                homeID: self.homeID,
                                                zoneID: windows[i].id,
                                                username: self.username,
                                                password: self.password,
                                                timeout: windows[i].openWindowDetection.timeoutInSeconds,
                                                interval: self.interval
                                            }

                                            self.log("Found new window: " + toConfig.name)
                                            windowArray.push(toConfig);

                                        } else {

                                            self.log(windows[i].name + ": Please activate Open weather detection in your Tado app!")

                                        }

                                    }
                                }

                                if (count == 0) {
                                    self.log("No Windows detected!");
                                    count = 0;
                                }

                                next(null, windowArray)
                            })
                            .catch((err) => {
                                self.log("Windows Error: " + err);
                                setTimeout(function() {
                                    fetchWindows(next)
                                }, 10000)
                            });

                    } else {
                        var windowArray;
                        next(null, windowArray)
                    }

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
                        tempUnit: self.tempUnit,
                        weatherAPI: self.weatherAPI,
                        weatherLocation: self.weatherLocation,
                        interval: self.weatherInterval
                    }
                    var weatherAccessory = new Tado_Weather(self.log, weatherConfig, self.api)
                    accessoriesArray.push(weatherAccessory);
                }
                next();
            },

            function(next) {
                if (self.centralSwitch) {

                    var centralSwitchConfig = {
                        name: "Tado Switch",
                        homeID: self.homeID,
                        username: self.username,
                        password: self.password,
                        roomids: JSON.stringify(self.idArray),
                        interval: self.interval
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
