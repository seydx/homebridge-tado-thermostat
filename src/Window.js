var moment = require('moment');

var Accessory,
    Service,
    Characteristic,
    FakeGatoHistoryService;

class WINDOW {

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
        this.timeout = config.timeout;
        this.interval = config.interval + 6000;

        !this.state ? this.state = 0 : this.state;

        this.url = "https://my.tado.com/api/v2/homes/" + this.homeID +
            "/zones/" + this.zoneID + "/state?password=" + this.password +
            "&username=" + this.username;

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

        this.informationService = new Service.AccessoryInformation()
            .setCharacteristic(Characteristic.Name, this.name)
            .setCharacteristic(Characteristic.Identify, this.name)
            .setCharacteristic(Characteristic.Manufacturer, 'Tado GmbH')
            .setCharacteristic(Characteristic.Model, 'Window')
            .setCharacteristic(Characteristic.SerialNumber, "OWD-" + this.homeID + "-" + this.zoneID)
            .setCharacteristic(Characteristic.FirmwareRevision, require('../package.json').version);

        this.Window = new Service.ContactSensor(this.name);

        this.Window.getCharacteristic(Characteristic.ContactSensorState)
            .updateValue(this.state)

        this.getCurrentState()

        return [this.informationService, this.Window];

    }

    getCurrentState() {

        var self = this;

        self.getContent(self.url)
            .then((data) => {
                var result = JSON.parse(data);
                result.openWindow != null ? self.state = 1 : self.state = 0;

                self.Window.getCharacteristic(Characteristic.ContactSensorState).updateValue(self.state);

                setTimeout(function() {
                    self.getCurrentState();
                }, self.interval)
            })
            .catch((err) => {
                self.log(self.name + ": " + err + " - Trying again");
                self.Window.getCharacteristic(Characteristic.ContactSensorState).updateValue(self.state);
                setTimeout(function() {
                    self.getCurrentState();
                }, 15000)
            });

    }

}

module.exports = WINDOW
