var moment = require('moment'),
    rp = require("request"),
    pollingtoevent = require("polling-to-event"),
    HK_REQS = require('./Requests.js');

var Accessory,
    Service,
    Characteristic,
    FakeGatoHistoryService;

class SWITCH {

    constructor(log, config, api) {

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
        this.offstate = 0;

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
        
        var failed, error;

        for (var i = 0; i < self.roomids.length; i++) {

            var _;

            self.get = new HK_REQS(self.username, self.password, self.homeID, {
                "token": process.argv[2]
            }, _, _, _, _, _, self.roomids[i]);

            self.get.CENTRAL_STATE()
                .then(response => {

                    if (response.setting.power == "OFF") {
                        self.offstate = 1;
                    }

                })
                .catch(err => {
                    failed = true;
                    error = err.message
                });

        }
        
        if (failed) {
            self.log("An Error occured: " + error);
        }

        if (self.offstate > 0) {
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

            var failed, error;

            for (var i = 0; i < self.roomids.length; i++) {

                var _;

                self.get = new HK_REQS(self.username, self.password, self.homeID, {
                    "token": process.argv[2]
                }, _, _, _, _, _, self.roomids[i]);

                self.get.STATE_OFF_ALL()
                    .then(response => {
                        failed = false
                    })
                    .catch(err => {
                        failed = true;
                        error = err.message
                    });

            }

            self.offstate = 1;
            if (failed) {
                self.log("An Error occured: " + error);
            }
            self.log("Turning all Thermostats off!");
            callback(null, true)

        } else {

            var failed, error;

            for (var i = 0; i < self.roomids.length; i++) {

                var _;

                self.get = new HK_REQS(self.username, self.password, self.homeID, {
                    "token": process.argv[2]
                }, _, _, _, _, _, self.roomids[i]);

                self.get.STATE_AUTO_ALL()
                    .then(response => {
                        failed = false
                    })
                    .catch(err => {
                        failed = true;
                        error = err.message
                    });

            }

            self.offstate = 0;
            if (failed) {
                self.log(self.name + ": An Error occured: " + error);
            }
            self.log("Turning all Thermostats to auto mode!");
            callback(null, false)

        }

    }

}

module.exports = SWITCH
