var rp = require("request"),
    async = require("async");

var Tado_Thermostat = require('./src/Thermostat.js'),
    Tado_Boiler = require('./src/Boiler.js'),
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
    this.homeID = config["homeID"] || "";
    this.tempUnit = config["tempUnit"] || "";

    //Thermostat Config
    this.coolValue = config["coolValue"] || 4;
    this.heatValue = config["heatValue"] || 4;
    this.coolValue = config["coolValueBoiler"] || 10;
    this.heatValue = config["heatValueBoiler"] || 10;
    this.delaytimer = (config["delaytimer"] * 1000);

    //Extras Config
    this.weatherEnabled = config["weatherEnabled"] || false;
    this.weatherServiceEnabled = config["weatherServiceEnabled"] || false;
    this.occupancyEnabled = config["occupancyEnabled"] || false;
    this.windowDetection = config["windowDetection"] || false;
    this.centralSwitch = config["centralSwitch"] || false;

    //Extras Config
    this.weatherAPI = config["weatherAPI"] || "";
    this.weatherLocation = config["weatherLocation"] || "";

    //Experimental!
    this.boilerEnabled = config["boilerEnabled"] || false;

}

TadoThermostatPlatform.prototype = {
    accessories: function(callback) {

        var accessoriesArray = []
        this.idArray = []
        var self = this;

        async.waterfall([

            function(next) {
                function fetchHomeID(next) {

                    if (!self.homeID || self.homeID == "" || self.homeID == undefined) {

                        self.log("Getting HomeID...")

                        var url = "https://my.tado.com/api/v2/me?username=" + self.username + "&password=" + self.password;

                        rp(url, function(error, response, body) {
                                if (!error && response != undefined) {
                                    var response = JSON.parse(body);

                                    self.homeID = response.homes[0].id;
                                    self.log("Home ID is: " + self.homeID);

                                    next()
                                }
                            })
                            .on('error', function(err) {
                                self.log("HomeID Error: " + err.message);
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

                        var url = "https://my.tado.com/api/v2/homes/" + self.homeID + "?username=" + self.username + "&password=" + self.password;

                        rp(url, function(error, response, body) {
                                if (!error && response != undefined) {
                                    var response = JSON.parse(body);

                                    self.tempUnit = response.temperatureUnit;

                                    self.log("Temperature Unit is: " + self.tempUnit);

                                    if (self.tempUnit = "CELSIUS") {
                                        self.targetMinValue = 5;
                                        self.targetMinBoilerValue = 30;
                                        self.targetMaxValue = 25;
                                        self.targetMaxBoilerValue = 65;
                                    } else {
                                        self.targetMinValue = 41;
                                        self.targetMinBoilerValue = 86;
                                        self.targetMaxValue = 77;
                                        self.targetMaxBoilerValue = 149;
                                    }

                                    next()
                                }
                            })
                            .on('error', function(err) {
                                self.log("Temperature Unit Error: " + err.message);
                                setTimeout(function() {
                                    fetchTemperatureUnit(next)
                                }, 10000)
                            });

                    } else {

                        self.log("Temperature Unit found in config. Unit: " + self.tempUnit);
                        next()

                    }

                }
                fetchTemperatureUnit(next)
            },

            function(next) {
                function fetchZones(next) {

                    self.log("Getting Zones...")

                    var url = "https://my.tado.com/api/v2/homes/" + self.homeID + "/zones?username=" + self.username + "&password=" + self.password;

                    rp(url, function(error, response, body) {
                            if (!error && response != undefined) {
                                var response = JSON.parse(body);

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
                            }
                        })
                        .on('error', function(err) {
                            self.log("Zones Error: " + err.message);
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

                        var url = "https://my.tado.com/api/v2/homes/" + self.homeID + "/zones?username=" + self.username + "&password=" + self.password;

                        rp(url, function(error, response, body) {
                                if (!error && response != undefined) {
                                    var response = JSON.parse(body);

                                    var zones = response;
                                    var boilerArray = []

                                    for (var i = 0; i < zones.length; i++) {
                                        if (zones[i].type.match("HOT_WATER")) {

                                            var devices = zones[i].devices;
                                            var zonename = zones[i].name;

                                            for (var j = 0; j < devices.length; j++) {

                                                devices.length > 1 ? zonename = zones[i].name + " " + j : zonename = zones[i].name;

                                                if (devices[j].deviceType.match("BU01")) {

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
                                                        delaytimer: self.delaytimer
                                                    }

                                                    self.log("Found new Boiler: " + toConfig.name + " (" + toConfig.id + " | " + devices[j].deviceType + ")")
                                                    boilerArray.push(toConfig);

                                                }
                                            }

                                        }
                                    }

                                    next(null, boilerArray)
                                }
                            })
                            .on('error', function(err) {
                                self.log("Boiler Error: " + err.message);
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

                        var url = "https://my.tado.com/api/v2/homes/" + self.homeID + "/mobileDevices?username=" + self.username + "&password=" + self.password;

                        rp(url, function(error, response, body) {
                                if (!error && response != undefined) {
                                    var response = JSON.parse(body);

                                    var occupancies = response;
                                    var occupancyArray = []

                                    for (var i = 0; i < occupancies.length; i++) {
                                        if (occupancies[i].settings.geoTrackingEnabled == true && self.occupancyEnabled == true) {

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

                                    next(null, occupancyArray)
                                }
                            })
                            .on('error', function(err) {
                                self.log("Users Error: " + err.message);
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

                        var url = "https://my.tado.com/api/v2/homes/" + self.homeID + "/zones?username=" + self.username + "&password=" + self.password;

                        rp(url, function(error, response, body) {
                                if (!error && response != undefined) {
                                    var response = JSON.parse(body);

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
                                }
                            })
                            .on('error', function(err) {
                                self.log("Windows Error: " + err.message);
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
                        weatherLocation: self.weatherLocation
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
                        name: "Tado Switch",
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
