const moment = require('moment');
var rp = require("request-promise");
var HK_REQS = require('./Requests.js');

var Accessory, Service, Characteristic, FakeGatoHistoryService;

class USER {

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
        this.username = config.username;
        this.password = config.password;
        this.polling = config.polling;
        this.interval = config.interval
        this.userID = config.id;

        this.get = new HK_REQS(platform.username, platform.password, platform.homeID, {
            "token": process.argv[2]
        });

    }

    getServices() {

        var accessory = this;

        this.informationService = new Service.AccessoryInformation()
            .setCharacteristic(Characteristic.Name, this.name)
            .setCharacteristic(Characteristic.Identify, this.name)
            .setCharacteristic(Characteristic.Manufacturer, 'Tado GmbH')
            .setCharacteristic(Characteristic.Model, 'Motion')
            .setCharacteristic(Characteristic.SerialNumber, "O-" + this.userID)
            .setCharacteristic(Characteristic.FirmwareRevision, require('../package.json').version);

        this.Motion = new Service.MotionSensor(this.name);

        if (accessory.name == "Anyone") {
            this.Motion.getCharacteristic(Characteristic.MotionDetected)
                .on('get', this.getAnyoneDetected.bind(this));
        } else {
            this.Motion.getCharacteristic(Characteristic.MotionDetected)
                .on('get', this.getMotionDetected.bind(this));
        }

        this.Motion.getCharacteristic(Characteristic.StatusActive)
            .updateValue(true);

        //FAKEGATO
        this.historyService = new FakeGatoHistoryService("motion", this, {
            storage: 'fs',
            disableTimer: false,
            path: this.api.user.cachedAccessoryPath()
        });

        if (this.polling) {
            (function poll() {
                setTimeout(function() {
                    accessory.Motion.getCharacteristic(Characteristic.MotionDetected).getValue();
                    poll()
                }, accessory.interval)
            })();
        }

        return [this.informationService, this.Motion, this.historyService];

    }

    getMotionDetected(callback) {

        var self = this;

        self.get.HOME_MOBILEDEVICES()
            .then(response => {

                var result = response;

                for (var i = 0; i < result.length; i++) {

                    if (result[i].id == self.userID) {

                        var userStatus = result[i].location.atHome;

                        if (userStatus == true) {
                            self.historyService.addEntry({
                                time: moment().unix(),
                                status: 1
                            });
                            callback(null, 1)
                        } else {
                            self.historyService.addEntry({
                                time: moment().unix(),
                                status: 0
                            });
                            callback(null, 0)
                        }

                    }

                }

            })
            .catch(err => {

                if (err.message.match("ETIMEDOUT") || err.message.match("EHOSTUNREACH")) {
                    self.log(self.name + ": No connection...");
                } else {
                    self.log(self.name + ": Error: " + err);
                }

            });

    }

    getAnyoneDetected(callback) {

        var self = this;

        self.get.HOME_MOBILEDEVICES()
            .then(response => {

                var result = response;
                var occupied = 0;

                for (var i = 0; i < result.length; i++) {

                    if (result[i].location.atHome) {

                        occupied = 1;

                    }

                }

                callback(null, occupied)

            })
            .catch(err => {

                if (err.message.match("ETIMEDOUT") || err.message.match("EHOSTUNREACH")) {
                    self.log(self.name + ": No connection...");
                } else {
                    self.log(self.name + ": Error: " + err);
                }

            });

    }
    
}

module.exports = USER
