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
		app.rocketchat.getUpdates();
		var $menu = jQuery('#egw_fw_topmenu_items');

		var $select = jQuery(document.createElement('select')).attr({id:"rc_status_select"}).change(function(){
			app.rocketchat.api.setUserPresence(this.value);
		}).prependTo($menu);

		jQuery("<option></option>", {value: "online", text: "Online"}).appendTo($select);
		jQuery("<option></option>", {value: "away", text: "Away"}).appendTo($select);
		jQuery("<option></option>", {value: "busy", text: "Busy"}).appendTo($select);
		jQuery("<option></option>", {value: "offline", text: "Offline"}).appendTo($select);

		jQuery('#topmenu_info_user_avatar').mouseover(function(){
			$select.chosen({
				disable_search: true,
				display_selected_options: false
			});
		});

		app.rocketchat.api.subscribeToNotifyLogged('user-status').then(function(_data){
			if (_data)
			{
				for (var i in _data.fields.args)
				{
					if (_data.fields.args[i][1] == egw.user('account_lid'))
					{
						$select.val(app.rocketchat._userStatusNum2String(_data.fields.args[i][2]));
					}
				}
			}
		});
	});
})(window);