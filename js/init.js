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

		egw.includeJS('/rocketchat/js/app.js', undefined, undefined, egw.webserverUrl).then(() => {
			//instatiate rocketchat app
			app.rocketchat = new app.classes.rocketchat;
			if (egw(window).is_popup())
			{
				return;
			}
			app.rocketchat.getUpdates();
			var $menu = jQuery('#egw_fw_topmenu_items');

			var $select = jQuery(document.createElement('select')).attr({id:"rc_status_select"}).change(function(){
				if (app.rocketchat && app.rocketchat.api) app.rocketchat.api.setUserPresence(this.value);
			}).prependTo($menu);

			// delay creation of options to have translations loaded
			window.setTimeout(function() {
				if (app.rocketchat)
				{
					jQuery("<option></option>", {value: "online", text: app.rocketchat.egw.lang("Online")}).appendTo($select);
					jQuery("<option></option>", {value: "away", text: app.rocketchat.egw.lang("Away")}).appendTo($select);
					jQuery("<option></option>", {value: "busy", text: app.rocketchat.egw.lang("Busy")}).appendTo($select);
					jQuery("<option></option>", {value: "offline", text: app.rocketchat.egw.lang("Offline")}).appendTo($select);
				}
			}, 500);

			jQuery('#topmenu_info_user_avatar').mouseover(function(){
				$select.chosen({
					disable_search: true,
					display_selected_options: false
				});
			});
		});
	});
})(window);