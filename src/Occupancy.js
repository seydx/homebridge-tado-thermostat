var moment = require('moment'),
    rp = require("request-promise"),
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
        !this.now ? this.now = 0 : this.now;
        !this.lasttime ? this.lasttime = 0 : this.lasttime;

        this.url = "https://my.tado.com/api/v2/homes/" + this.homeID +
            "/mobileDevices?password=" + this.password +
            "&username=" + this.username;

        this.emitter = pollingtoevent(function(done) {
            rp.get(platform.url, function(err, req, data) {
                done(err, data);
            });
        }, {
            longpolling: false,
            interval: 3000
        });

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
            }, 2000)
        })();

        return [this.informationService, this.Motion, this.historyService];

    }

    getMotionDetected() {

        var self = this;

        var active = 0;
        var inactive = 0;

        self.emitter
            .on("poll", function(data) {

                var result = JSON.parse(data);

                for (var i = 0; i < result.length; i++) {
                    if (result[i].id == self.userID) {

                        var userStatus = false;
                        var distance = 1;

                        if (result[i].settings.geoTrackingEnabled == true) {
                            userStatus = result[i].location.atHome;
                            distance = result[i].location.relativeDistanceFromHomeFence;
                        }

                        if (userStatus == true || distance < 0.3) {
                            self.state = 1;
                            self.now = moment().unix();
                            active = 1;
                        } else {
                            self.state = 0;
                            active == 1 ? inactive = 1 : inactive = 0;

                            if (inactive == 1) {
                                self.lasttime = moment().unix();
                            }

                            active = 0;
                            inactive = 0;

                        }

                    }

                }

                self.historyService.addEntry({
                    time: moment().unix(),
                    status: self.state
                });

                self.Motion.getCharacteristic(Characteristic.MotionDetected)
                    .updateValue(self.state);

            })
            .on("error", function(err) {
                self.log("An Error occured: %s", err);
                self.log("Setting Motion/Occupancy State to: " + self.state);
                self.Motion.getCharacteristic(Characteristic.MotionDetected)
                    .updateValue(self.state);
            });

    }

    getAnyoneDetected() {

        var self = this;

        var active = 0;
        var inactive = 0;

        self.emitter
            .on("poll", function(data) {

                var result = JSON.parse(data);

                var athome = 0; //a
                var notathome = 0; //b

                for (var i = 0; i < result.length; i++) {
                    if (result[i].settings.geoTrackingEnabled == true) {
                        result[i].location.atHome == true ? athome = 1 : notathome = 0
                    }
                }

                var count = athome + notathome;

                if (count > 0) {
                    self.state = 1
                    self.now = moment().unix();
                    athome = 1;
                } else {
                    self.state = 0

                    active == 1 ? inactive = 1 : inactive = 0;

                    if (inactive == 1) {
                        self.lasttime = moment().unix();
                    }

                    active = 0;
                    inactive = 0;
                }

                self.historyService.addEntry({
                    time: moment().unix(),
                    status: self.state
                });

                self.Motion.getCharacteristic(Characteristic.MotionDetected)
                    .updateValue(self.state);

            })
            .on("error", function(err) {
                self.log("An Error occured: %s", err);
                self.log("Setting Motion/Occupancy State to: " + self.state);
                self.Motion.getCharacteristic(Characteristic.MotionDetected)
                    .updateValue(self.state);
            });

    }

    getMotionLastActivation(callback) {

        var self = this;

        if (self.state == true) {

            var last = moment().unix();
            callback(null, last)

        } else {

            var last = self.lasttime - self.historyService.getInitialTime();
            callback(null, last)
        }

    }

}

module.exports = USER
