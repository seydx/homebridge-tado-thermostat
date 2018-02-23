var rp = require("request-promise");

var HK_REQS = require('./Requests.js');
var HK_TYPES = require("./HomeKitTypes.js");

var Accessory, Service, Characteristic, uuid;

class TADOSERVICE {

    constructor(log, config, api) {

        Accessory = api.platformAccessory;
        Service = api.hap.Service;
        Characteristic = api.hap.Characteristic;
        uuid = api.hap.uuid;

        var platform = this;

        this.uuid = uuid;
        this.config = config;

        this.log = log;
        this.name = config.name;
        this.homeID = config.homeID;
        this.username = config.username;
        this.password = config.password;
        this.polling = config.polling;
        this.interval = config.interval;

        this.zonesArray = []

        HK_TYPES.registerWith(api);
        //TD_TYPES.registerWith(api);

        this.get = new HK_REQS(platform.username, platform.password, platform.homeID, {
            "token": process.argv[2]
        });

    }

    getServices() {

        var accessory = this;

        this.informationService = new Service.AccessoryInformation()
            .setCharacteristic(Characteristic.Manufacturer, 'Tado GmbH')
            .setCharacteristic(Characteristic.Model, 'Tado Thermostat Service')
            .setCharacteristic(Characteristic.SerialNumber, 'Tado Serial Number');

        this.TadoService = new Service.TadoService(this.name);

        accessory.get.HOME_ZONES()
            .then(response => {

                var zones = response;

                for (var i = 0; i < zones.length; i++) {
                    if (zones[i].type.match("HEATING")) {

                        var CharacteristicConfig = {
                            name: zones[i].name,
                            homeID: accessory.homeID,
                            username: accessory.username,
                            password: accessory.password,
                            polling: accessory.polling,
                            interval: accessory.interval,
                        }

                        var c = new Characteristic.BatteryCharacteristic(accessory.uuid, zones[i].name, CharacteristicConfig, accessory.log);
                        accessory.TadoService.addCharacteristic(c)
                    }
                }

            })
            .catch(err => {

                if (err.message.match("ETIMEDOUT") || err.message.match("EHOSTUNREACH")) {
                    accessory.log("Service Zones: No connection...");
                } else {
                    accessory.log("Could not fetch Battery Accessory: " + err);
                }

            });

        return [this.informationService, this.TadoService];

    }

}

module.exports = TADOSERVICE