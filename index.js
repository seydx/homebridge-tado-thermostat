var https = require("https"),
    async = require("async");

var Accessory, Service, Characteristic;

module.exports = function(homebridge) { 
    console.log("homebridge API version: " + homebridge.version);

    Accessory = homebridge.platformAccessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    HomebridgeAPI = homebridge;

    homebridge.registerPlatform("homebridge-tado-thermostat", "TadoThermostat", TadoThermostatPlatform);
}

function TadoThermostatPlatform(log, config, api){

    if (!config) {
        log.warn("Ignoring Tado Thermostat Platform setup because it is not configured");
        this.disabled = true;
        return;
    }

    log("Tado Thermostat Platform Init");

    this.log = log;
    this.config = config;
    this.name = config["name"] || "Tado Thermostat";
    this.username = config["username"];
    this.password = config["password"];
    this.homeID = config["homeID"] || "";
    this.interval = (config["interval"]*1000) || 3000;
    this.coolValue = config["coolValue"] || 4;
    this.heatValue = config["heatValue"] || 4;

    this.storage = require('node-persist');
    this.storage.initSync({
       dir: HomebridgeAPI.user.persistPath()
    });
}

TadoThermostatPlatform.prototype = {
    accessories: function(callback){

       var accessoriesArray = []
       var self = this;

       async.waterfall([

          // Get HomeID
          function(next){
             self.getHomeID = function(next){
                self.log("Getting HomeID...")

                var options = {
                    host: "my.tado.com",
                    path: "/api/v2/me?password=" + self.password + "&username=" + self.username,
                    method: "GET"
                };

                https.request(options, function(response){
                    var strData = '';
                    response.on('data', function(chunk) {
                        strData += chunk;
                    });
                    response.on('end', function() {
                        try {
                            var data = JSON.parse(strData);
                            self.homeID = data.homes[0].id;
                            self.storage.setItem("HomeID", self.homeID);
                            self.log("Home ID is: " + self.homeID)
                            }
                        catch(e){
                            self.log("Could not retrieve Home ID, error:" + e);
                            self.log("Fetching home ID failed - Trying again...");
                            setTimeout(function(){
                                self.getHomeID(next)
                            }, 10000)
                        }
                        next()
                    });
                }).on('error', (e) => {
                    console.error(e);
                    console.log("Fetching home ID failed - Trying again...");
                    setTimeout(function(){
                        self.getHomeID(next)
                    }, 10000)
                }).end();
             }

             if (!self.homeID || self.homeID == "" || self.homeID == undefined) {

                var storageHomeID = self.storage.getItem("HomeID");
                if (storageHomeID == null || storageHomeID == undefined){
                    self.log("Getting Home ID")
                    self.getHomeID(next)
                } else {
                    self.log("Home ID found in storage")
                    self.homeID = self.storage.getItem("HomeID")
                    next()
                }
             } else next()
          }, // END HomeID


          // get temperatureUnit
          function(next){
                var options = {
                    host: 'my.tado.com',
                    path: '/api/v2/homes/' + self.homeID + '?password=' + self.password + '&username=' + self.username,
                    method: 'GET'
                };
            function fetchTemperatureUnit(next){
                https.request(options, function(response){
                    var strData = '';
                    response.on('data', function(chunk) {
                        strData += chunk;
                    });
                    response.on('end', function() {
                        try {
                            var data = JSON.parse(strData);
                            self.tempUnit = data.temperatureUnit;

                            if (self.tempUnit = "CELSIUS"){
                               self.targetMinValue = 5;
                               self.targetMaxValue = 25;
                            }else{
                               self.targetMinValue = 41;
                               self.targetMaxValue = 77;
                            }

                            //self.log("Temperature Unit is: " + self.tempUnit)
                        }
                        catch(e){
                            self.log("Could not retrieve Temperature Unit, error:" + e);
                            self.log("Fetching Temperature Unit failed - Trying again...");
                            setTimeout(function(){
                                fetchTemperatureUnit(next)
                            }, 10000)
                        }
                        next()
                    });
                }).on('error', (e) => {
                    console.error(e);
                    console.log("Fetching Temperature Unit failed - Trying again...");
                    setTimeout(function(){
                        fetchTemperatureUnit(next)
                    }, 10000)
                }).end();
            }
            fetchTemperatureUnit(next)
          }, //END tempUnit

            // get Zones
          function(next){
             var options = {
                 host: 'my.tado.com',
                 path: '/api/v2/homes/' + self.homeID + '/zones?password=' + self.password + '&username=' + self.username,
                 method: 'GET'
             };
             function fetchZones(next){
                 https.request(options, function(response){
                     var strData = '';
                     response.on('data', function(chunk) {
                         strData += chunk;
                     });
                     response.on('end', function() {
                         try {
                             var zones = JSON.parse(strData);
                             var zonesArray = []
                             for (i=0;i<zones.length;i++){
                                 if (zones[i].type == "HEATING"){
                                     var toConfig = {
                                         id: zones[i].id,
                                         name: zones[i].name,
                                         homeID: self.homeID,
                                         username: self.username,
                                         password: self.password,
                                         interval: self.interval,
                                         coolValue: self.coolValue,
                                         heatValue: self.heatValue,
                                         tempUnit: self.tempUnit,
                                         targetMinValue: self.targetMinValue,
                                         targetMaxValue: self.targetMaxValue
                                     }
                                    self.log("Found new Zone: "+ toConfig.name + " (" + toConfig.id + ") ...")
                                    zonesArray.push(toConfig);

                                    
                                 }
                                 
                             }
                            }
                         catch(e){
                             self.log("Could not retrieve Zones, error:" + e);
                             self.log("Fetching Zones failed - Trying again...");
                             setTimeout(function(){
                                fetchZones(next)
                             }, 10000)
                         }
                         next(null, zonesArray)
                         
                     });
                 }).on('error', (e) => {
                     console.error(e);
                     console.log("Fetching Zones failed - Trying again...");
                     setTimeout(function(){
                         fetchZones(next)
                     }, 10000)
                   }).end();
             }
             fetchZones(next)
          },
          
        // Create Accessories  
        function(zonesArray, next){
	          
	        async.forEachOf(zonesArray, function (zone, key, step) {
		          
		        function pushMyAccessories(step){
			        
			        var tadoAccessory = new TadoThermostatAccessory(self.log, zone)
					accessoriesArray.push(tadoAccessory);
					step()
			
				} pushMyAccessories(step)
				
			},	function(err){
				if (err) next(err)
				else next()
			})

		}
		
       ], function(err, result){
             if(err) callback(err)
             else callback(accessoriesArray);
          }
       )
   }
}

/********************************************************************************************************************************************************/
/********************************************************************************************************************************************************/
/*******************************************************************      Tado Thermostat      **********************************************************/
/********************************************************************************************************************************************************/
/********************************************************************************************************************************************************/

function TadoThermostatAccessory(log, config){
    var accessory = this;

    this.log = log;
    this.zoneName = config.name;
    this.zoneID = config.id;
    this.name = config.name;
    this.homeID = config.homeID;
    this.username = config.username;
    this.password = config.password;
    this.interval = config.interval;
    this.coolValue = config.coolValue;
    this.heatValue = config.heatValue;
    this.tempUnit = config.tempUnit;
    this.targetMinValue = config.targetMinValue;
    this.targetMaxValue = config.targetMaxValue;

    this.storage = require("node-persist");
    this.storage.initSync({
       dir: HomebridgeAPI.user.persistPath()
    });

    this.informationService = new Service.AccessoryInformation()
        .setCharacteristic(Characteristic.Manufacturer, 'Tado GmbH')
        .setCharacteristic(Characteristic.Model, 'Tado Thermostat Control')
        .setCharacteristic(Characteristic.SerialNumber, 'Tado Serial Number');
        
    ////Thermostat
        
    this.Thermostat = new Service.Thermostat(this.zoneName + " Heizung");

    this.Thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
        .on('get', this.getCurrentHeatingCoolingState.bind(this)) 
     
    setInterval(function(){
    	accessory.Thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState).getValue();
	}, accessory.interval)
	
    this.Thermostat.getCharacteristic(Characteristic.TargetHeatingCoolingState)
        .on('get', this.getTargetHeatingCoolingState.bind(this))
        .on('set', this.setTargetHeatingCoolingState.bind(this));  
        
    setInterval(function(){
    	accessory.Thermostat.getCharacteristic(Characteristic.TargetHeatingCoolingState).getValue();
	}, accessory.interval)

    this.Thermostat.getCharacteristic(Characteristic.CurrentTemperature)
        .setProps({
            minValue: -100,
            maxValue: 100,
            minStep: 0.1
        })
        .on('get', this.getCurrentTemperature.bind(this));
        
    setInterval(function(){
    	accessory.Thermostat.getCharacteristic(Characteristic.CurrentTemperature).getValue();
	}, accessory.interval)
        
    this.Thermostat.getCharacteristic(Characteristic.TargetTemperature)
        .setProps({
            minValue: this.targetMinValue,
            maxValue: this.targetMaxValue,
            minStep: 0.1
        })
        .on('get', this.getTargetTemperature.bind(this))
        .on('set', this.setTargetTemperature.bind(this));  
        
    setInterval(function(){
    	accessory.Thermostat.getCharacteristic(Characteristic.TargetTemperature).getValue();
	}, accessory.interval)

    this.Thermostat.getCharacteristic(Characteristic.TemperatureDisplayUnits)
        .on('get', this.getTemperatureDisplayUnits.bind(this))
        .on('set', this.setTemperatureDisplayUnits.bind(this));

    this.Thermostat.getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .setProps({
            minValue: 0,
            maxValue: 100,
            minStep: 0.01
        })
        .on('get', this.getCurrentRelativeHumidity.bind(this));

    setInterval(function(){
    	accessory.Thermostat.getCharacteristic(Characteristic.CurrentRelativeHumidity).getValue();
	}, 300000)
}



/********************************************************************************************************************************************************/
/********************************************************************************************************************************************************/
/*******************************************************************      GET      **********************************************************************/
/********************************************************************************************************************************************************/
/********************************************************************************************************************************************************/



TadoThermostatAccessory.prototype.getServices = function(){
   return [this.informationService, this.Thermostat];
}

TadoThermostatAccessory.prototype.getCurrentState = function(callback){
    var self = this;
    
    //self.log("Getting state for: " + self.zoneName);

    var options = {
        host: "my.tado.com",
        path: "/api/v2/homes/" + self.homeID + "/zones/" + self.zoneID + "/state?password=" + self.password + "&username=" + self.username,
        method: "GET"
    };

    https.request(options, function(response){
        var strData = '';
        response.on('data', function(chunk) {
            strData += chunk;
        });
        response.on('end', function() {
            try {
                var data = JSON.parse(strData);
                callback(null, data)
                }
            catch(e){
                self.log("Could not retrieve status from " + self.zoneName + "; error: " + e)
                callback(e)
            }
        });
    }).on('error', (e) => {
        console.error(e);
    }).end();
}

TadoThermostatAccessory.prototype.getCurrentHeatingCoolingState = function(callback){
    var accessory = this;
    
    accessory.getCurrentState(function(err, data) {
	        
        if (err) callback (err)
        else {
			if(data.setting.power == "ON"){
				
				if (data.sensorDataPoints.insideTemperature.celsius > data.setting.temperature.celsius){
					callback(null, Characteristic.CurrentHeatingCoolingState.COOL);
				} else if (data.sensorDataPoints.insideTemperature.celsius < data.setting.temperature.celsius){
					callback(null, Characteristic.CurrentHeatingCoolingState.HEAT);
				} else {
					callback(null, Characteristic.CurrentHeatingCoolingState.AUTO)
				}
				
			} else {
					callback(null, Characteristic.CurrentHeatingCoolingState.OFF);
			}	
        }
    })	
}

TadoThermostatAccessory.prototype.getTargetHeatingCoolingState = function(callback){
    var accessory = this;
    
    accessory.getCurrentState(function(err, data) {
	        
        if (err) callback (err)
        else {
			if(data.setting.power == "ON"){
				
				if(data.sensorDataPoints.insideTemperature.celsius > data.setting.temperature.celsius){
					callback(null, Characteristic.CurrentHeatingCoolingState.COOL);
				} else if (data.sensorDataPoints.insideTemperature.celsius < data.setting.temperature.celsius) {
					callback(null, Characteristic.CurrentHeatingCoolingState.HEAT);
				} else {
					callback(null, Characteristic.CurrentHeatingCoolingState.AUTO);
				}
				
			} else {
				callback(null, Characteristic.CurrentHeatingCoolingState.OFF);
			}
        }
    })
}

TadoThermostatAccessory.prototype.getCurrentTemperature = function(callback){
    var accessory = this;
    
    accessory.getCurrentState(function(err, data) {
	    
        if (err) callback (err)
        else {
                if(accessory.tempUnit == "CELSIUS"){
                  callback(null, data.sensorDataPoints.insideTemperature.celsius);
                }else{
                  callback(null, data.sensorDataPoints.insideTemperature.fahrenheit);
                }
        }
    })
}

TadoThermostatAccessory.prototype.getTargetTemperature = function(callback){
    var accessory = this;
    
    accessory.getCurrentState(function(err, data) {
	    
        if (err) callback (err)
        else {
              if(data.setting.power == "ON"){
                if(accessory.tempUnit == "CELSIUS"){
	            	callback(null, data.setting.temperature.celsius);
                }else{
	            	callback(null, data.setting.temperature.fahrenheit);
                }
              }else{
                if(accessory.tempUnit == "CELSIUS"){
	            	callback(null, data.sensorDataPoints.insideTemperature.celsius);
                }else{
	            	callback(null, data.sensorDataPoints.insideTemperature.fahrenheit);
                }
              }
        }
    })
}

TadoThermostatAccessory.prototype.getTemperatureDisplayUnits = function(callback){
    var accessory = this;
    
    //accessory.log("The current temperature display unit is " + accessory.tempUnit);

    if(accessory.tempUnit == "CELSIUS"){
       callback(null, Characteristic.TemperatureDisplayUnits.CELSIUS);
    }else{
       callback(null, Characteristic.TemperatureDisplayUnits.FAHRENHEIT);
    }

}

TadoThermostatAccessory.prototype.getCurrentRelativeHumidity = function(callback){
    var accessory = this;
    
    accessory.getCurrentState(function(err, data) {
	    
        if (err) callback (err)
        else {
            //accessory.log(accessory.zoneName + " Current Humidity is " + data.sensorDataPoints.humidity.percentage);
            callback(null, data.sensorDataPoints.humidity.percentage);
        }
    })

}


/********************************************************************************************************************************************************/
/********************************************************************************************************************************************************/
/*******************************************************************      SET      **********************************************************************/
/********************************************************************************************************************************************************/
/********************************************************************************************************************************************************/


TadoThermostatAccessory.prototype.setTargetHeatingCoolingState = function(state, callback){
    var self = this;
    
    self.getCurrentState(function(err, data) {      
        switch(state){
	        case Characteristic.TargetHeatingCoolingState.OFF:
		        self.log(self.zoneName + ": Switch OFF");
		
		        body = {
		                 "setting": {
		                   "type": "HEATING",
		                   "power": "OFF"
		                 },
		                 "termination": {
		                   "type": "MANUAL"
		                 }
		               };
		
		        body = JSON.stringify(body);
		
		        var options = {
		            host: 'my.tado.com',
		            path: '/api/v2/homes/' + self.homeID + '/zones/' + self.zoneID + '/overlay?username=' + self.username + '&password=' + self.password,
		            method: 'PUT'
		        };
		        callback();
		
		        https.request(options, null).on('error', (e) => {
		            console.error(e);
		            callback(e)
		            return
		          }).end(body);
	        break;
	        
	        case Characteristic.TargetHeatingCoolingState.HEAT:
		        self.log(self.zoneName + ": HEAT activated");

                        var newMinValue = Math.round(data.sensorDataPoints.insideTemperature.celsius) + self.heatValue;
		                
		        //self.log("Fahrenheit: " + Math.round(((data.sensorDataPoints.insideTemperature.celsius + self.heatValue)*1.8+32) * 10.0 ) / 10.0);
				
		        body = {
		                 "setting": {
		                   "type": "HEATING",
		                   "power": "ON",
		                   "temperature": {
						     "celsius": newMinValue
    						}
		                 },
		                 "termination": {
		                   "type": "MANUAL"
		                 }
		               };
		
		        body = JSON.stringify(body);
		
		        var options = {
		            host: 'my.tado.com',
		            path: '/api/v2/homes/' + self.homeID + '/zones/' + self.zoneID + '/overlay?username=' + self.username + '&password=' + self.password,
		            method: 'PUT'
		        };
		        callback();
		
		        https.request(options, null).on('error', (e) => {
		            console.error(e);
		            callback(e)
		            return
		          }).end(body);
	        break;
	        
	        case Characteristic.TargetHeatingCoolingState.COOL:
		        self.log(self.zoneName + ": COOL activated");
				
                        var newMinValue = Math.round(data.sensorDataPoints.insideTemperature.celsius) - self.heatValue;
                        
		        body = {
		                 "setting": {
		                   "type": "HEATING",
		                   "power": "ON",
		                   "temperature": {
						     "celsius": newMinValue
    						}
		                 },
		                 "termination": {
		                   "type": "MANUAL"
		                 }
		               };
		
		        body = JSON.stringify(body);
		
		        var options = {
		            host: 'my.tado.com',
		            path: '/api/v2/homes/' + self.homeID + '/zones/' + self.zoneID + '/overlay?username=' + self.username + '&password=' + self.password,
		            method: 'PUT'
		        };
		        callback();
		
		        https.request(options, null).on('error', (e) => {
		            console.error(e);
		            callback(e)
		            return
		          }).end(body);
	        break;
	        
	        case Characteristic.TargetHeatingCoolingState.AUTO:
		        self.log(self.zoneName + ": AUTOMATIC activated");
		
		        body = {};
		
		        body = JSON.stringify(body);
		
		        var options = {
		            host: 'my.tado.com',
		            path: '/api/v2/homes/' + self.homeID + '/zones/' + self.zoneID + '/overlay?username=' + self.username + '&password=' + self.password,
		            method: 'DELETE'
		        };
		        callback();
		
		        https.request(options, null).on('error', (e) => {
		            console.error(e);
		            callback(e)
		            return
		          }).end(body);
	        break;
        }
        
    })
}

TadoThermostatAccessory.prototype.setTargetTemperature = function(value, callback){
	var accessory = this;
	
	    accessory.getCurrentState(function(err, data) {

			var newTemp = Math.round(value);

			var mystate = accessory.Thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState).value;

			if(mystate != 0){
		        body = {
		                 "setting": {
		                   "type": "HEATING",
		                   "power": "ON",
		                   "temperature": {
						     "celsius": newTemp
    						}
		                 },
		                 "termination": {
		                   "type": "MANUAL"
		                 }
		               };
		
		        body = JSON.stringify(body);
		
		        var options = {
		            host: 'my.tado.com',
		            path: '/api/v2/homes/' + accessory.homeID + '/zones/' + accessory.zoneID + '/overlay?username=' + accessory.username + '&password=' + accessory.password,
		            method: 'PUT'
		        };
		        callback();
		
		        https.request(options, null).on('error', (e) => {
		            console.error(e);
		            callback(e)
		            return
		          }).end(body);
			}else{
				callback()
			}
    })
}

TadoThermostatAccessory.prototype.setTemperatureDisplayUnits = function(value, callback){
    var accessory = this;

    accessory.temperatureDisplayUnits = value;
    callback(null, accessory.temperatureDisplayUnits)
}
