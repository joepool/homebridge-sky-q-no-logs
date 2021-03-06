'use strict';

var SkyRemote = require('sky-remote');
var SkyQCheck = require('sky-q');
var Accessory, Service, Characteristic;

module.exports = function(homebridge) {

	Accessory = homebridge.platformAccessory;
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerAccessory("homebridge-sky-q", "SkyQ", SkyQAccessory);
};

function SkyQAccessory(log, config, api) {

	this.log = log;
	this.config = config;
	this.name = config.name || 'Sky Q';
	this.stateful = false;

	if (this.config.cmd === 'power' || !this.config.cmd) {

		this.stateful = true;
	}

	var remoteControl = new SkyRemote(config.ipAddress);
	var boxCheck = new SkyQCheck({ip:config.ipAddress})
	this.skyQ = remoteControl;
	this.box = boxCheck;
}


SkyQAccessory.prototype = {

	setPowerState: function(powerOn, callback, context) {

		let funcContext = 'fromSetPowerState';
		var switchService = this.service;
		var log = this.log;
		var name = this.name;
		var stateful = this.stateful;
		var state = powerOn ? 'on' : 'off';
		var delayed = this.config.delayed;
		var skyQ = this.skyQ;
		var box = this.box;
		

		function sendCmd(callBacked) {
			//log('Sending "' + cmd + '" command to ' + name + '...');

			if (cmd.length > 6 && callBacked === false) {
				// If it's a long command string that will take a while, immedately callback() to avoid Siri timeout
				callBacked = true;	
				callback();
			}

			skyQ.press(cmd, function(error) {

				if (error) {

					log('Failed to send cmd ' + name + '. ' + error);
				}

				if (stateful === true) {
	
					callback(); // Do this early or Siri moans it takes too long
					if (state === 'on' && delayed === true) {
						setTimeout(function() {

							skyQ.press('sky', function(error) {

								//log('Sending "sky" command to ' + name + '...');

			                	       		if (error) {

                        				        	log('Failed to send cmd ' + name + '. ' + error);
	                       					}

							});

						}, 20000);

					}


				} else {
					if (callBacked === false) {
						callback();
					}
					setTimeout(function() {
						switchService.getCharacteristic(Characteristic.On).getValue(null, funcContext);
					}, 1000);
				}
			});
		}
		if (this.config.cmd) {

			var cmd = this.config.cmd.split(',');
		} else {

			var cmd = 'power';
		}
		
		if (stateful === false && this.config.autoOn === true) {

			box.getPowerState().then(isOn=>{
				if (isOn) {

					log(name + " is on :-)")
					sendCmd(false);
				} else {

					log(name + " is in standby :-(")
					skyQ.press(['power','backup'], function(error) {

						//log('Sending "power,backup" command to ' + name + '...');

						if (error) {

							log('Failed to send cmd ' + name + '. ' + error);
						}
					});
					if (delayed === true) {
						log("Delayed 'sky' press enabled");
						callback(); // Do this early or Siri moans that it takes too long
						setTimeout(function() {

							skyQ.press(['sky','backup'], function(error) {

								//log('Sending "sky,backup" command to ' + name + '...');
								if (error) {

									log('Failed to send cmd ' + name + '. ' + error);
								}
							});
							setTimeout(function() {
								
								sendCmd(true);

							}, 1000); //Give the box a chance to get back to a channel before sending the cmd
						}, 20000);
					} else {
					
						setTimeout(function() {

							sendCmd(false);

						}, 3000); //Give the box a chance to start up before we send the cmd
					}
				}
			}).catch(err=>{
				log("Unable to determine power state 1")
				log("Perhaps looking at this error will help you figure out why" + err)
			  	callback(err || new Error('Error getting state of ' + this.name));
			})

		} else {
	
			box.getPowerState().then(isOn=>{
				if ((isOn && state === 'on') || (!isOn && state === 'off')) {
					callback();
					setTimeout(function() {
						switchService.getCharacteristic(Characteristic.On).getValue(null, funcContext);
					}, 1000);

				} else {
					sendCmd(false);
				}
			}).catch(err=>{
				log("Unable to determine power state 2")
				log("Perhaps looking at this error will help you figure out why" + err)
			  	callback(err || new Error('Error getting state of ' + this.name));
			})
		}

	},

	identify: function(callback) {

		this.log("Identify...");

		callback();
	},

	getState: function(callback) {
		
		if (this.stateful) {

			this.box.getPowerState().then(isOn=>{
	  		if (isOn) {

			    //this.log(this.name + " is on :-)")
			  } else {

			    //this.log(this.name + " is in standby :-(")
			  }
			  callback(null, isOn);

			}).catch(err=>{

			  this.log("Unable to determine power state 3")
			  this.log("Perhaps looking at this error will help you figure out why" + err)
			  callback(err || new Error('Error getting state of ' + this.name));
			})
		} else {

		  callback(null, 0);
		}
	},

	getServices: function() {

	var informationService = new Service.AccessoryInformation();

    informationService
        .setCharacteristic(Characteristic.Manufacturer, "Sky")
        .setCharacteristic(Characteristic.Model, `Q`)
        .setCharacteristic(Characteristic.SerialNumber, this.config.ipAddress);

		var switchService = new Service.Switch(this.name);

		var characteristic = switchService.getCharacteristic(Characteristic.On).on('set', this.setPowerState.bind(this));

		characteristic.on('get', this.getState.bind(this));

		this.service = switchService;
		var services = [informationService, switchService]
		return services;
	}
};
