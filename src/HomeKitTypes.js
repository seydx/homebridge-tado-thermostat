var inherits = require("util").inherits;
var HK_REQS = require('./Requests.js');

module.exports = {
    registerWith: function(homebridge) {

        var Service = homebridge.hap.Service;
        var Characteristic = homebridge.hap.Characteristic;

        Service.TadoService = function(displayName, subtype) {
            Service.call(this, displayName, 'fceea0b1-9ced-4d04-96d4-4c56c75ba5c0', subtype);
        };
        inherits(Service.TadoService, Service);
        Service.TadoService.UUID = 'fceea0b1-9ced-4d04-96d4-4c56c75ba5c0';

        var Characteristic = homebridge.hap.Characteristic;

        Characteristic.BatteryCharacteristic = function(uuid, displayName, config, log) {

			this.log = log;
            this.name = config.name;
            this.username = config.username;
            this.password = config.password;
            this.homeID = config.homeID;
            this.polling = config.polling;
            this.interval = config.interval;

            var self = this;

            this.get = new HK_REQS(self.username, self.password, self.homeID, {
                "token": process.argv[2]
            });

            this.UUID = uuid.generate(displayName);
            Characteristic.call(this, displayName, this.UUID);

            this.setProps({
                format: Characteristic.Formats.STRING,
                perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
            });
            this.value = this.getDefaultValue();
            this.on('get', this._onGet.bind(this));
        }
        inherits(Characteristic.BatteryCharacteristic, Characteristic);

        if (this.polling) {
            (function poll() {
                setTimeout(function() {
                        self.Thermostat.getCharacteristic(Characteristic.BatteryCharacteristic).getValue();
                        poll()
                    }, 1 * 1000 * 60 * 60) // 1h
            })();
        }

        Characteristic.BatteryCharacteristic.prototype._onGet = function(callback) {

            var self = this;

            self.get.HOME_ZONES()
                .then(response => {

                    var zones = response;

                    for (var i = 0; i < zones.length; i++) {

                        if (zones[i].name.match(self.name)) {
                            var batteryStatus = zones[i].devices[0].batteryState;
                            self.log("Battery status " + self.name + " : " + batteryStatus);
                            callback(null, batteryStatus);
                        }
                    }

                })
                .catch(err => {

                    if (err.message.match("ETIMEDOUT") || err.message.match("EHOSTUNREACH")) {
                        self.log(self.name + " Service: No connection...");
                    } else {
                        self.log(self.name + " Service: Error: " + err);
                    }

                });
                
        }

    }
}