/**
 * EGroupware Rocketchat Initialization
 *
 * @package Rocketchat
 * @author Hadi Nategh <hn-At-egroupware.org>
 * @copyright 2018 by Hadi Nategh <hn-At-egroupware.org>
 * @description Initializes rocketchat app object
 */

/**
 *
 * @param {type} window
 */
(function(window){
	"use strict";

	egw_LAB.wait(function() {
		//instatiate rocketchat app
		app.rocketchat = new app.classes.rocketchat;
		if (egw(window).is_popup())
		{
			return;
		}
		app.rocketchat.getUpdates();
		let menu = document.getElementById('egw_fw_topmenu_items');

		let select = document.createElement('et2-select');
		select.setAttribute('id', 'rc_status_select');
		select.addEventListener('change', function(){
			if (app.rocketchat && app.rocketchat.api) app.rocketchat.api.setUserPresence(this.value);
		});
		menu.prepend(select);

		// delay creation of options to have translations loaded
		window.setTimeout(function() {
			if (app.rocketchat)
			{
				let options = [
					{value: "online", label: app.rocketchat.egw.lang("Online"), icon: 'check-circle-fill', color: 'green'},
					{value: "away", label: app.rocketchat.egw.lang("Away"), icon: 'clock', color: 'yellow'},
					{value: "busy", label: app.rocketchat.egw.lang("Busy"), icon: 'dash-circle', color: 'red'},
					{value: "offline", label: app.rocketchat.egw.lang("Offline"), icon: 'circle'},
				];
				select.select_options = options;
			}
		}, 500);
	});

})(window);