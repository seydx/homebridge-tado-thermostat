const moment = require('moment');
var rp = require("request-promise");
var pollingtoevent = require("polling-to-event");
var HK_REQS = require('./Requests.js');

var Accessory,
    Service,
    Characteristic,
    FakeGatoHistoryService;

class SWITCH {

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
        this.homeID = config.homeID;
        this.zoneID = config.zoneID;
        this.username = config.username;
        this.password = config.password;
        this.roomids = JSON.parse(config.roomids);
        this.stateArray = [];

    }

    getServices() {

        var accessory = this;

        this.informationService = new Service.AccessoryInformation()
            .setCharacteristic(Characteristic.Name, this.name)
            .setCharacteristic(Characteristic.Identify, this.name)
            .setCharacteristic(Characteristic.Manufacturer, 'Tado GmbH')
            .setCharacteristic(Characteristic.Model, 'Central Switch')
            .setCharacteristic(Characteristic.SerialNumber, "CS-" + this.homeID + "-99")
            .setCharacteristic(Characteristic.FirmwareRevision, require('../package.json').version);

        this.Switch = new Service.Switch(this.name);

        this.Switch.getCharacteristic(Characteristic.On)
            .on('get', this.getSwitch.bind(this))
            .on('set', this.setSwitch.bind(this));


        (function poll() {
            setTimeout(function() {
                accessory.Switch.getCharacteristic(Characteristic.On).getValue();
                poll()
            }, 5000)
        })();

        return [this.informationService, this.Switch];

    }

    getSwitch(callback) {

        var self = this;

        for (var i = 0; i < self.roomids.length; i++) {

            var a;

            self.get = new HK_REQS(self.username, self.password, self.homeID, {
                "token": process.argv[2]
            }, self.zoneID, self.heatValue, self.coolValue, a, a, self.roomids[i]);

            self.get.CENTRAL_STATE()
                .then(response => {

                    self.stateArray.push(response.setting.power);

                })
                .catch(err => {

                    if (err.message.match("ETIMEDOUT") || err.message.match("EHOSTUNREACH")) {
                        self.log("No connection...");
                    } else {
                        self.log("Error: " + err);
                    }

                });

        }

        if ((new RegExp('\\b' + self.stateArray.join('\\b|\\b') + '\\b')).test("OFF")) {
            self.stateArray = []
            callback(null, true)
        } else {
            self.stateArray = []
            callback(null, false)
        }

    }

    setSwitch(state, callback) {

        var self = this;

        if (state) {
            //TURN ON > TURN OFF THERMOSTATS
            var self = this;

            for (var i = 0; i < self.roomids.length; i++) {

                var a;

                self.get = new HK_REQS(self.username, self.password, self.homeID, {
                    "token": process.argv[2]
                }, self.zoneID, self.heatValue, self.coolValue, a, a, self.roomids[i]);

                self.get.STATE_OFF_ALL()
                    .then(response => {})
                    .catch(err => {

                        if (err.message.match("ETIMEDOUT") || err.message.match("EHOSTUNREACH")) {
                            self.log("No connection...");
                        } else {
                            self.log("Error: " + err);
                        }

                    });

            }

            setTimeout(function() {
                self.Switch.getCharacteristic(Characteristic.On).updateValue(true);
            }, 300)

            self.log("Turning all Thermostats off!");
            callback()

        } else {
            //TURN OFF > TURN ON THERMOSTATS (AUTO MODE)
            var self = this;

            for (var i = 0; i < self.roomids.length; i++) {

                var a;

                self.get = new HK_REQS(self.username, self.password, self.homeID, {
                    "token": process.argv[2]
                }, self.zoneID, self.heatValue, self.coolValue, a, a, self.roomids[i]);

                self.get.STATE_AUTO_ALL()
                    .then(response => {})
                    .catch(err => {

                        if (err.message.match("ETIMEDOUT") || err.message.match("EHOSTUNREACH")) {
                            self.log("No connection...");
                        } else {
                            self.log("Error: " + err);
                        }

                    });

            }

            setTimeout(function() {
                self.Switch.getCharacteristic(Characteristic.On).updateValue(false);
            }, 300)

            self.log("Turning all Thermostats to auto mode!");
            callback()

        }

    }

}

module.exports = SWITCH
