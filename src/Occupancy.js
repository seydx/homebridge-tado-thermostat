var moment = require('moment'),
    rp = require("request"),
    pollingtoevent = require("polling-to-event"),
    inherits = require("util").inherits;

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

        !this.state ? this.state = 0 : this.state;

        this.url = "https://my.tado.com/api/v2/homes/" + this.homeID +
            "/mobileDevices?password=" + this.password +
            "&username=" + this.username;

    }

    getServices() {

        var self = this;

        this.informationService = new Service.AccessoryInformation()
            .setCharacteristic(Characteristic.Name, this.name)
            .setCharacteristic(Characteristic.Identify, this.name)
            .setCharacteristic(Characteristic.Manufacturer, 'Tado GmbH')
            .setCharacteristic(Characteristic.Model, 'Motion')
            .setCharacteristic(Characteristic.SerialNumber, "O-" + this.userID)
            .setCharacteristic(Characteristic.FirmwareRevision, require('../package.json').version);

        this.Motion = new Service.MotionSensor(this.name);

        if (this.name == "Anyone") {
            this.Motion.getCharacteristic(Characteristic.MotionDetected)
                .updateValue(this.state)

            this.getAnyoneDetected()
        } else {
            this.Motion.getCharacteristic(Characteristic.MotionDetected)
                .updateValue(this.state)

            this.getMotionDetected();
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

        this.historyService = new FakeGatoHistoryService("motion", this, {
            storage: 'fs',
            disableTimer: true,
            path: this.api.user.cachedAccessoryPath()
        });

        (function poll() {
            setTimeout(function() {
                self.Motion.getCharacteristic(EveMotionDuration).getValue();
                self.Motion.getCharacteristic(EveMotionLastActivation).getValue();
                poll()
            }, 5000)
        })();

        (function poll() {
            setTimeout(function() {
                self.getHistory();
                poll()
            }, 2000)
        })();

        return [this.informationService, this.Motion, this.historyService];

    }

    getMotionDetected() {

        var self = this;

        var emitter = pollingtoevent(function(done) {
            rp.get(self.url, function(err, req, data) {
                done(err, data);
            });
        }, {
            longpolling: false,
            interval: 5000
        });

        emitter
            .on("poll", function(data) {

                var result = JSON.parse(data);

                for (var i = 0; i < result.length; i++) {
                    if (result[i].id == self.userID) {

                        if (result[i].settings.geoTrackingEnabled == true && result[i].location != null) {

                            if (result[i].location.atHome == true || result[i].location.relativeDistanceFromHomeFence < 0.1) {
                                self.state = 1;
                            } else {
                                self.state = 0;
                            }


                        }

                    }

                }

                self.Motion.getCharacteristic(Characteristic.MotionDetected)
                    .updateValue(self.state);

            })
            .on("error", function(err) {
                self.log(self.name + ": An Error occured: %s", err.code + " - Polling again..");
                self.Motion.getCharacteristic(Characteristic.MotionDetected)
                    .updateValue(self.state);
                emitter.pause();
                setTimeout(function() {
                    emitter.resume();
                }, 10000)
            });

    }

    getAnyoneDetected() {

        var self = this;

        var emitter = pollingtoevent(function(done) {
            rp.get(self.url, function(err, req, data) {
                done(err, data);
            });
        }, {
            longpolling: false,
            interval: 5000
        });

        emitter
            .on("poll", function(data) {

                var result = JSON.parse(data);

                var athome = 0;
                var notathome = 0;

                for (var i = 0; i < result.length; i++) {
                    if (result[i].settings.geoTrackingEnabled == true && result[i].location != null) {
                        result[i].location.atHome == true ? athome = 1 : notathome = 0
                    }
                }

                var count = athome + notathome;

                if (count > 0) {
                    self.state = 1
                    self.now = moment().unix();
                } else {
                    self.state = 0
                }

                self.Motion.getCharacteristic(Characteristic.MotionDetected)
                    .updateValue(self.state);

            })
            .on("error", function(err) {
                self.log(self.name + ": An Error occured: %s", err.code + " - Polling again..");
                self.Motion.getCharacteristic(Characteristic.MotionDetected)
                    .updateValue(self.state);
                emitter.pause();
                setTimeout(function() {
                    emitter.resume();
                }, 10000)
            });

    }

    getHistory() {

        var self = this;

        var totallength = self.historyService.history.length - 1;
        var latestStatus = self.historyService.history[totallength].status;

        if (self.state != latestStatus) {

            self.historyService.addEntry({
                time: moment().unix(),
                status: self.state
            });

            //self.log(self.name + ": New entry added to history! Old Status: " + latestStatus + " - New Status: " + self.state);

        }

    }

    getMotionLastActivation(callback) {

        var self = this;
        var totallength = self.historyService.history.length - 1;
        var latestTime = self.historyService.history[totallength].time;

        if (self.state == true) {

            var last = moment().unix();
            callback(null, last)

        } else {

            var last = latestTime - self.historyService.getInitialTime();
            callback(null, last)
        }

    }

}

module.exports = USER
