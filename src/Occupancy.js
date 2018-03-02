const moment = require('moment');
var rp = require("request-promise");
var pollingtoevent = require("polling-to-event");
var inherits = require("util").inherits;

var Accessory,
    Service,
    Characteristic,
    FakeGatoHistoryService,
    EveMotionSensitivity,
    EveMotionDuration,
    EveMotionLastActivation;

class USER {

    constructor(log, config, api) {

        FakeGatoHistoryService = require('fakegato-history')(api);

        Accessory = api.platformAccessory;
        Service = api.hap.Service;
        Characteristic = api.hap.Characteristic;

        EveMotionSensitivity = function() {
            Characteristic.call(this, "Sensitivity", "E863F120-079E-48FF-8F27-9C2605A29F52");
            this.setProps({
                format: Characteristic.Formats.UINT8,
                minValue: 0,
                maxValue: 7,
                validValues: [0, 4, 7],
                perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
            });
            EveMotionSensitivity.HIGH = 0
            EveMotionSensitivity.MEDIUM = 4
            EveMotionSensitivity.LOW = 7

            this.value = this.getDefaultValue();
        };
        inherits(EveMotionSensitivity, Characteristic);
        EveMotionSensitivity.UUID = "E863F120-079E-48FF-8F27-9C2605A29F52";

        EveMotionDuration = function() {
            Characteristic.call(this, "Duration", "E863F12D-079E-48FF-8F27-9C2605A29F52");
            this.setProps({
                format: Characteristic.Formats.UINT16,
                unit: Characteristic.Units.SECONDS,
                minValue: 5,
                maxValue: 15 * 3600,
                validValues: [
                    5, 10, 20, 30,
                    1 * 60, 2 * 60, 3 * 60, 5 * 60, 10 * 60, 20 * 60, 30 * 60,
                    1 * 3600, 2 * 3600, 3 * 3600, 5 * 3600, 10 * 3600, 12 * 3600, 15 * 3600
                ],
                perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY, Characteristic.Perms.WRITE]
            });
            this.value = this.getDefaultValue();
        };
        inherits(EveMotionDuration, Characteristic);
        EveMotionDuration.UUID = "E863F12D-079E-48FF-8F27-9C2605A29F52";

        EveMotionLastActivation = function() {
            Characteristic.call(this, "Last Activation", "E863F11A-079E-48FF-8F27-9C2605A29F52");
            this.setProps({
                format: Characteristic.Formats.UINT32,
                unit: Characteristic.Units.SECONDS,
                perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
            });
            this.value = this.getDefaultValue();
        };
        inherits(EveMotionLastActivation, Characteristic);
        EveMotionLastActivation.UUID = "E863F11A-079E-48FF-8F27-9C2605A29F52";

        var platform = this;

        this.api = api;
        this.log = log;
        this.config = config;
        this.name = config.name;
        this.displayName = config.name;
        this.homeID = config.homeID;
        this.username = config.username;
        this.password = config.password;
        this.userID = config.id;

        this.url = "https://my.tado.com/api/v2/homes/" + this.homeID +
            "/mobileDevices?password=" + this.password +
            "&username=" + this.username;

        this.state = 0;

        this.emitter = pollingtoevent(function(done) {
            rp.get(platform.url, function(err, req, data) {
                done(err, data);
            });
        }, {
            longpolling: true
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
                .updateValue(accessory.state)
            accessory.getAnyoneDetected()
        } else {
            this.Motion.getCharacteristic(Characteristic.MotionDetected)
                .updateValue(accessory.state)
            accessory.getMotionDetected()
        }

        this.Motion.getCharacteristic(Characteristic.StatusActive)
            .updateValue(true);

        this.Motion.addCharacteristic(EveMotionSensitivity);
        this.Motion.getCharacteristic(EveMotionSensitivity)
            .updateValue(EveMotionSensitivity.HIGH);

        this.Motion.addCharacteristic(EveMotionDuration);
        this.Motion.getCharacteristic(EveMotionDuration)
            .updateValue(5);

        this.Motion.addCharacteristic(EveMotionLastActivation);
        this.Motion.getCharacteristic(EveMotionLastActivation)
            .on('get', this.getMotionLastActivation.bind(this));

        //FAKEGATO
        this.historyService = new FakeGatoHistoryService("motion", this, {
            storage: 'fs',
            disableTimer: true,
            path: this.api.user.cachedAccessoryPath()
        });

        setTimeout(function() {
            accessory.Motion.getCharacteristic(EveMotionDuration).getValue();
            accessory.Motion.getCharacteristic(EveMotionLastActivation).getValue();
        }, 2000)

        return [this.informationService, this.Motion, this.historyService];

    }

    getMotionDetected() {

        var self = this;

        self.emitter
            .on("longpoll", function(data) {

                var result = JSON.parse(data);

                for (var i = 0; i < result.length; i++) {

                    if (result[i].id == self.userID) {

                        var userStatus = false;

                        if (result[i].settings.geoTrackingEnabled == true) {
                            userStatus = result[i].location.atHome;
                        }

                        if (userStatus == true) {
                            //self.log(self.name + " is at home!");
                            self.state = 1;
                        } else {
                            //self.log("Bye! " + self.name);
                            self.state = 0;
                        }

                    }

                }

                self.historyService.addEntry({
                    time: moment().unix(),
                    status: self.state
                });

                self.Motion.getCharacteristic(Characteristic.MotionDetected).updateValue(self.state);

            })
            .on("error", function(err) {
                console.log("%s", err);
                self.Motion.getCharacteristic(Characteristic.MotionDetected).updateValue(0);
            });

    }

    getAnyoneDetected() {

        var self = this;

        self.emitter
            .on("longpoll", function(data) {

                var result = JSON.parse(data);

                var a = 0;
                var b = 0;

                for (var i = 0; i < result.length; i++) {
                    if (result[i].settings.geoTrackingEnabled == true) {
                        result[i].location.atHome == true ? a = 1 : b = 0
                    }
                }

                var c = a + b;

                if (c > 0) {
                    self.state = 1
                        //self.log("Anyone at home");
                } else {
                    self.state = 0
                        //self.log("No one at home");
                }

                self.historyService.addEntry({
                    time: moment().unix(),
                    status: self.state
                });

                self.Motion.getCharacteristic(Characteristic.MotionDetected).updateValue(self.state);

            })
            .on("error", function(err) {
                console.log("%s", err);
                self.Motion.getCharacteristic(Characteristic.MotionDetected).updateValue(0);
            });

    }

    getMotionLastActivation(callback) {

        var self = this;

        this.activated = 0;
        this.lastactivity = 0;

        if (self.Motion.getCharacteristic(Characteristic.MotionDetected).value == true) {
            self.activated = moment().unix();
            self.lastactivity = self.activated;

            callback(null, self.activated)
        } else {
            callback(null, self.lastactivity)
        }

    }

}

module.exports = USER
