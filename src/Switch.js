var moment = require('moment'),
    https = require('https');

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
        this.interval = config.interval + 2000;

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
            }, accessory.interval)
        })();

        return [this.informationService, this.Switch];

    }

    getSwitch(callback) {

        var self = this;

        for (var i = 0; i < self.roomids.length; i++) {

            self.getContent("https://my.tado.com/api/v2/homes/" + self.homeID + "/zones/" + self.roomids[i] + "/state?username=" + self.username + "&password=" + self.password)
                .then((data) => {
                    var response = JSON.parse(data);
                    if (response.setting.power == "ON") {
                        self.offstate += 1;
                    }
                })
                .catch((err) => {
                    self.log(self.name + ": " + err + " - Trying again");
                    self.offstate = 0;
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

                var options = {
                    host: 'my.tado.com',
                    path: "/api/v2/homes/" + self.homeID + "/zones/" + self.roomids[i] + "/overlay?username=" + self.username + "&password=" + self.password,
                    method: 'DELETE'
                };

                var req = https.request(options, function(res) {
                    req.on('error', function(err) {
                        console.log('Error: ' + err);
                    });
                });

                req.end();

            }

            self.offstate = self.roomids.length;
            self.log("Thermostats switching to auto mode!");
            callback(null, true)

        } else {

            for (var i = 0; i < self.roomids.length; i++) {

                var options = {
                    host: 'my.tado.com',
                    path: "/api/v2/homes/" + self.homeID + "/zones/" + self.roomids[i] + "/overlay?username=" + self.username + "&password=" + self.password,
                    method: 'PUT'
                };

                var post_data = JSON.stringify({
                    "setting": {
                        "type": "HEATING",
                        "power": "OFF"
                    },
                    "termination": {
                        "type": "MANUAL"
                    }
                });

                var req = https.request(options, function(res) {
                    req.on('error', function(err) {
                        console.log('Error: ' + err);
                    });
                });

                req.write(post_data);
                req.end();

            }

            self.offstate = 0;
            self.log("Thermostats switching off!");
            callback(null, false)

        }

    }

}

module.exports = SWITCH
