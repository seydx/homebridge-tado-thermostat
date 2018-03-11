var moment = require('moment'),
    rp = require("request");

var Accessory,
    Service,
    Characteristic;

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

        for (var i = 0; i < self.roomids.length; i++) {

            var url = "https://my.tado.com/api/v2/homes/" + self.homeID + "/zones/" + self.roomids[i] + "/state?username=" + self.username + "&password=" + self.password

            rp(url, function(error, response, body) {
                    if (!error && response != undefined) {
                        var response = JSON.parse(body);
                        if (response.setting.power == "ON") {
                            self.offstate += 1;
                        }
                    } else {
                        self.offstate = 0;
                    }
                })
                .on('error', function(err) {
                    self.log("Error getting switch state: " + err.message);
                });

        }

        if (self.offstate == 0) {
            callback(null, false)
        } else {
            self.offstate = 0;
            callback(null, true)
        }


    }

    setSwitch(state, callback) {

        var self = this;

        if (state) {

            for (var i = 0; i < self.roomids.length; i++) {

                var url = "https://my.tado.com/api/v2/homes/" + self.homeID + "/zones/" + self.roomids[i] + "/overlay?username=" + self.username + "&password=" + self.password

                rp({
                        url: url,
                        method: 'DELETE'
                    })
                    .on('error', function(err) {
                        self.log("ERROR: " + err.message);
                    });

            }

            self.offstate = self.roomids.length;
            self.log("Thermostats switching to auto mode!");
            callback(null, true)

        } else {

            for (var i = 0; i < self.roomids.length; i++) {

                var url = "https://my.tado.com/api/v2/homes/" + self.homeID + "/zones/" + self.roomids[i] + "/overlay?username=" + self.username + "&password=" + self.password

                rp({
                        url: url,
                        method: 'PUT',
                        json: {
                            "setting": {
                                "type": "HEATING",
                                "power": "OFF"
                            },
                            "termination": {
                                "type": "MANUAL"
                            }
                        }
                    })
                    .on('error', function(err) {
                        self.log("ERROR: " + err.message);
                    })

            }

            self.offstate = 0;
            self.log("Thermostats switching off!");
            callback(null, false)

        }

    }

}

module.exports = SWITCH
