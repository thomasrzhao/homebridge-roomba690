var Service, Characteristic;
var dorita980 = require('dorita980');

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-roomba690", "Roomba690", Roomba690Accessory);
}

/**
 * Roomba690Accessory
 *
 * @method Roomba690Accessory
 * @param {Object} log
 * @param {Object} config config.json
 * @param {String} config.name Name of Roomba to show in Home app
 * @param {String} config.blid Roomba's BLID
 * @param {String} config.password Roomba's password
 * @param {String} config.hostname Roomba's IP address
 * @param {String} config.model Model of Roomba to show in Home app
 *
 */
function Roomba690Accessory(log, config) {

    this.log = log;

    this.blid       = config["blid"];
    this.password   = config["password"];
    this.name       = config["name"];
    this.hostname   = config["hostname"];
    this.model      = config["model"];

    log("Initialised Roomba with Name: [%s] Hostname: [%s] BLID: [%s] Model: [%s]", this.name, this.hostname, this.blid, this.model);
}

/**
 * Roomba690Accessory
 *
 * Provides the following functions:
 * Roomba690Accessorytate()
 * getPowerState()
 * getIsCharging()
 * getBatteryLevel()
 * identify()
 * getServices()
 */
Roomba690Accessory.prototype = {

  /**
   * setPowerState
   *
   * @method setPowerState
   * @param {int} state 0 or 1
   * @param {function} callback
   *
   * Setting state to 0 will pause the Roomba and request that it docks.
   *
   */
    setPowerState: function(state, callback) {
      var log = this.log;

      log("Request to set power state to [%s]", state);

      var myRobotViaLocal = new dorita980.Local(this.blid, this.password, this.hostname);

      log("Connecting to Roomba");
      myRobotViaLocal.on('connect', function() {
        log("Connected to Roomba, getting current status");

        myRobotViaLocal.getRobotState(['cleanMissionStatus']).then(function(currentState) {
          var phase = currentState.cleanMissionStatus.phase;
          log("Roomba phase is %s", phase);

          if (state && phase != "run") {
            log("Starting Roomba");
            myRobotViaLocal.start().then(function(response) {
              myRobotViaLocal.end();

              log("Roomba started");
              log(response);
              callback();
            });
          } else if (!state) {
            if (phase == "run") {
              log("Pausing Roomba");
              myRobotViaLocal.pause().then(function(response) {
                log('Roomba is paused with phase %s', phase);
                // We call back so Siri can show success.
                callback();

                // We still have to dock!
                log("Requesting that Roomba return to dock");
                var checkStatus = function (time) {
                  if (this.setPowerStateTimeoutID) {
                    clearTimeout(this.setPowerStateTimeoutID);
                    delete this.setPowerStateTimeoutID;
                  }
                  this.setPowerStateTimeoutID = setTimeout(function() {
                    delete this.setPowerStateTimeoutID;
                    log('Checking Roomba status');

                    myRobotViaLocal.getRobotState(['cleanMissionStatus']).then(function(state) {
                      log ("Status is [%s]", state.cleanMissionStatus.phase);
                      switch (state.cleanMissionStatus.phase) {
                        case "stop":
                          log("Roomba has stopped, issuing dock request");

                          myRobotViaLocal.dock().then(function(response) {
                            log('Roomba docking');
                            myRobotViaLocal.end();
                          });
                          break;
                        case "run":
                          log('Roomba is still running. Will check again in 3 seconds');
                          checkStatus(3000);
                          break;
                        default:
                          myRobotViaLocal.end();
                          log('Roomba is not running');
                          break;
                      }
                    });
                  }, time);
                };
                checkStatus(3000);
              });
            } else if (phase == "stop" || phase == "pause") {
              // Roomba is not docked, docking, or stuck, so send it back to the dock
              myRobotViaLocal.dock().then(function(response) {
                callback();
                log('Roomba docking');
                myRobotViaLocal.end();
              });
            } else if (phase == "stuck") {
              log("Roomba is stuck and can't return to dock");
              throw new Error("Roomba is stuck and can't return to dock");
            } else {
              callback();
              log("Roomba is in-state %s for %s, not doing anything", phase, state);
              myRobotViaLocal.end();
            }
          } else {
            callback();
            log("Roomba is in-state %s for %s, not doing anything", phase, state);
            myRobotViaLocal.end();
          }
        }).catch(function(err) {
          myRobotViaLocal.end();
          log("Error setting power state to [%s]. Error was [%s]", state, err.message);
          callback(err);
        });
      });
    },
    /* End setPowerState */

  /**
   * getPowerState
   *
   * @method getPowerState
   * @param {function} callback
   * @return {Number} status
   *
   * Returns 1 if cleanMissionStatus.phase = run
   *
   */
    getPowerState: function(callback) {

        var log = this.log;
        log("Power state requested for Roomba");

        var myRobotViaLocal = new dorita980.Local(this.blid, this.password, this.hostname);

        myRobotViaLocal.on('connect', function() {

            log("Connected to Roomba");

            myRobotViaLocal.getRobotState(['cleanMissionStatus']).then((function(state) {

                myRobotViaLocal.end();

                log ("Status is [%s]", state.cleanMissionStatus.phase);

                switch (state.cleanMissionStatus.phase) {
                    case "run":
                        log("Roomba is running");
                        callback(null, 1);
                        break;
                    default:
                        log("Roomba is not running");
                        callback(null, 0);
                        break;
                }

            })).catch(function(err) {

                myRobotViaLocal.end();

                log("Unable to determine power state of Roomba");
                log(err);
                callback(err);

            });

        });

    },
    /* End getPowerState */

  /**
   * getPowerState
   *
   * @method getPowerState
   * @param {function} callback
   * @return {Characteristic.ChargingState}
   *
   */
    getIsCharging: function(callback) {

        var log = this.log;
        log("Charging status requested for Roomba");

        var myRobotViaLocal = new dorita980.Local(this.blid, this.password, this.hostname);

        myRobotViaLocal.on('connect', function() {

            log("Connected to Roomba");

            myRobotViaLocal.getRobotState(['cleanMissionStatus']).then((function(state) {

                myRobotViaLocal.end();

                log ("Status is [%s]", state.cleanMissionStatus.phase);

                switch (state.cleanMissionStatus.phase) {
                    case "charge":
                        log("Roomba is charging");
                        callback(null, Characteristic.ChargingState.CHARGING);
                        break;
                    default:
                        log(state.cleanMissionStatus.phase);
                        log("Roomba is not charging");
                        callback(null, Characteristic.ChargingState.NOT_CHARGING);
                        break;
                }

            })).catch(function(err) {

                myRobotViaLocal.end();

                log("Unable to determine charging status for Roomba");
                log(err);
                callback(err);

            });

        });
    },
    /* End getIsCharging */

  /**
   * getBatteryLevel
   *
   * @method getBatteryLevel
   * @param {function} callback
   * @return {Number} batteryLevel
   *
   * Returns a float representation of the battery level
   *
   */
    getBatteryLevel: function(callback) {

        var log = this.log;
        log("Battery level requested for Roomba");

        var myRobotViaLocal = new dorita980.Local(this.blid, this.password, this.hostname);

        myRobotViaLocal.on('connect', function() {

            log("Connected");

            myRobotViaLocal.getRobotState(['batPct']).then((function(state) {

                myRobotViaLocal.end();

                log("Roomba battery level [%s]", state.batPct);
                callback(null, state.batPct);

            })).catch(function(err) {

                myRobotViaLocal.end();

                log("Unable to determine battery level");
                log(err);
                callback(err);

            });

        });

    },
    /* End getBatteryLevel */

  /**
   * identify
   * If it is ever supported by dorita980, it'd be cool to have the Roomba play
   * a sound when identify() is called.
   *
   * As we can't yet do that, this method will always return successful to keep Siri happy.
   *
   * @method identify
   * @param {function} callback
   *
   */
    identify: function(callback) {
        this.log("Identify requested. Not supported yet.");
        callback();
    }, /* End identify */

  /**
   * getServices
   *
   * Roomba690 supports the following Services:
   * AccessoryInformation
   * BatteryService
   * Switch
   *
   * @method identify
   * @param {function} callback
   * @return {Array} services
   *
   */
    getServices: function() {

        var log = this.log;

        log("Services requested");

        /* Roomba Information */
        // Populates the info box for the accessory in the Home app
        var accessoryInfo = new Service.AccessoryInformation();
        accessoryInfo.setCharacteristic(Characteristic.Manufacturer, "iRobot"); // No need to dynamically return this.
        accessoryInfo.setCharacteristic(Characteristic.SerialNumber, "See iRobot App"); // dorita980 doesn't yet support a query for serial number
        accessoryInfo.setCharacteristic(Characteristic.Identify, false); // Disable idenitify capability
        accessoryInfo.setCharacteristic(Characteristic.Name, this.name); // Pull from conifguration
        accessoryInfo.setCharacteristic(Characteristic.Model, this.model); // Pull from configuration

        /* Battery Service */
        // Allows for Siri commands such as "Is the Roomba charging?" or "What is the battery percentage of the Roomba?"
        var batteryService = new Service.BatteryService();
        batteryService.getCharacteristic(Characteristic.BatteryLevel).on('get', this.getBatteryLevel.bind(this));
        batteryService.getCharacteristic(Characteristic.ChargingState).on('get', this.getIsCharging.bind(this));

        /* Switch Service */
        // Supports our on/off for the Roomba
        var switchService = new Service.Switch(this.name);
        switchService.getCharacteristic(Characteristic.On).on('get', this.getPowerState.bind(this)).on('set', this.setPowerState.bind(this));

        log("Reporting that we support AccessoryInformation, SwitchService and BatteryService");
        return [accessoryInfo, switchService, batteryService];
    } /* End getServices */

}
