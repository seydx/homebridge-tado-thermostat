var rp = require("request-promise");

class TADO_REQ {

    constructor(username, password, homeID, params, zoneID, heatValue, coolValue, currentValue, value) {
        this.username = username;
        this.password = password;
        this.homeID = homeID;
        this.params = params;
        this.zoneID = zoneID;
        this.heatValue = heatValue;
        this.coolValue = coolValue;
        this.currentValue = currentValue;
        this.newHeat = currentValue + heatValue;
        this.newCool = currentValue - coolValue;
        this.newTemp = value;

    }

    HOME_ID() {

        var self = this;

        this.tado = {

            token: null,

            get: function() {

                return rp({

                    "method": "GET",
                    "uri": "https://my.tado.com/api/v2/me",
                    "qs": {
                        "password": self.password,
                        "username": self.username
                    },
                    "json": true

                });
            }
        }

        self.tado.token = self.params.token;
        return self.tado.get();

    }

    TEMP_UNIT() {

        var self = this;

        this.tado = {

            token: null,

            get: function() {

                return rp({

                    "method": "GET",
                    "uri": "https://my.tado.com/api/v2/homes/" + self.homeID,
                    "qs": {
                        "password": self.password,
                        "username": self.username
                    },
                    "json": true

                });
            }
        }

        self.tado.token = self.params.token;
        return self.tado.get();

    }

    HOME_ZONES() {

        var self = this;

        this.tado = {

            token: null,

            get: function() {

                return rp({

                    "method": "GET",
                    "uri": "https://my.tado.com/api/v2/homes/" + self.homeID + "/zones",
                    "qs": {
                        "password": self.password,
                        "username": self.username
                    },
                    "json": true

                });
            }
        }

        self.tado.token = self.params.token;
        return self.tado.get();

    }

    STATE() {

        var self = this;

        this.tado = {

            token: null,

            get: function() {

                return rp({

                    "method": "GET",
                    "uri": "https://my.tado.com/api/v2/homes/" + self.homeID + "/zones/" + self.zoneID + "/state",
                    "qs": {
                        "password": self.password,
                        "username": self.username
                    },
                    "json": true

                });
            }
        }

        self.tado.token = self.params.token;
        return self.tado.get();

    }

    STATE_OFF() {

        var self = this;

        this.tado = {

            token: null,

            get: function() {

                return rp({

                    "method": "PUT",
                    "uri": "https://my.tado.com/api/v2/homes/" + self.homeID + "/zones/" + self.zoneID + "/overlay",
                    "qs": {
                        "password": self.password,
                        "username": self.username
                    },
                    "body": {
                        "setting": {
                            "type": "HEATING",
                            "power": "OFF"
                        },
                        "termination": {
                            "type": "MANUAL"
                        }
                    },
                    "json": true

                });
            }
        }

        self.tado.token = self.params.token;
        return self.tado.get();

    }

    STATE_HEAT() {

        var self = this;

        this.tado = {

            token: null,

            get: function() {

                return rp({

                    "method": "PUT",
                    "uri": "https://my.tado.com/api/v2/homes/" + self.homeID + "/zones/" + self.zoneID + "/overlay",
                    "qs": {
                        "password": self.password,
                        "username": self.username
                    },
                    "body": {
                        "setting": {
                            "type": "HEATING",
                            "power": "ON",
                            "temperature": {
                                "celsius": self.newHeat
                            }
                        },
                        "termination": {
                            "type": "MANUAL"
                        }
                    },
                    "json": true

                });
            }
        }

        self.tado.token = self.params.token;
        return self.tado.get();

    }

    STATE_COOL() {

        var self = this;

        this.tado = {

            token: null,

            get: function() {

                return rp({

                    "method": "PUT",
                    "uri": "https://my.tado.com/api/v2/homes/" + self.homeID + "/zones/" + self.zoneID + "/overlay",
                    "qs": {
                        "password": self.password,
                        "username": self.username
                    },
                    "body": {
                        "setting": {
                            "type": "HEATING",
                            "power": "ON",
                            "temperature": {
                                "celsius": self.newCool
                            }
                        },
                        "termination": {
                            "type": "MANUAL"
                        }
                    },
                    "json": true

                });
            }
        }

        self.tado.token = self.params.token;
        return self.tado.get();

    }

    STATE_AUTO() {

        var self = this;

        this.tado = {

            token: null,

            get: function() {

                return rp({

                    "method": "DELETE",
                    "uri": "https://my.tado.com/api/v2/homes/" + self.homeID + "/zones/" + self.zoneID + "/overlay",
                    "qs": {
                        "password": self.password,
                        "username": self.username
                    },
                    "json": true

                });
            }
        }

        self.tado.token = self.params.token;
        return self.tado.get();

    }

    STATE_NEWTEMP() {

        var self = this;

        this.tado = {

            token: null,

            get: function() {

                return rp({

                    "method": "PUT",
                    "uri": "https://my.tado.com/api/v2/homes/" + self.homeID + "/zones/" + self.zoneID + "/overlay",
                    "qs": {
                        "password": self.password,
                        "username": self.username
                    },
                    "body": {
                        "setting": {
                            "type": "HEATING",
                            "power": "ON",
                            "temperature": {
                                "celsius": self.newTemp
                            }
                        },
                        "termination": {
                            "type": "MANUAL"
                        }
                    },
                    "json": true

                });
            }
        }

        self.tado.token = self.params.token;
        return self.tado.get();

    }

}

module.exports = TADO_REQ