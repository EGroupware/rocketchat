/**
 * EGroupware - Rocketchat
 *
 * @link http://www.egroupware.org
 * @package Rocketchat
 * @author Hadi Nategh <hn-At-egroupware.org>
 * @copyright (c) 2019 by Hadi Nategh <hn-At-egroupware.org>
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 * @version $Id$
 */

/*egw:uses
	/rocketchat/js/init.js;
	/rocketchat/js/realtimeapi.js;
 */
app.classes.rocketchat = AppJS.extend(
{
	appname: 'rocketchat',

	api: undefined,

	updateInterval: 10000,
	rocketchat: {},

	mainframe: {},

	chatbox: {},

	content: {},

	init: function()
	{
		this._super.apply(this, arguments);
	},

	et2_ready: function(et2,name)
	{
		// call parent
		this._super.apply(this, arguments);
		this.content = this.et2.getArrayMgr('content').data;
		var self = this;
		switch (name)
		{
			case 'rocketchat.index':
				egw(window).loading_prompt('rocketchat-loading', true, this.egw.lang('Loading Rocket.Chat ...'), jQuery('#rocketchat-index'));
				this.mainframe = this.et2.getWidgetById('iframe').getDOMNode();
				jQuery(this.mainframe).on('load', function(){
					self._isRocketchatLoaded().then(function(_mode){
						egw(window).loading_prompt('rocketchat-loading', false);
						if (self._shouldCallCustomOAuth(_mode))
						{
							self.postMessage('call-custom-oauth-login', {service:'egroupware'});
							egw(window).loading_prompt('rocketchat-login', true, self.egw.lang('Logging you into Rocket.Chat ...'), jQuery('#rocketchat-index'));
							window.setTimeout(function(){
								egw(window).loading_prompt('rocketchat-login', false);
							}, 4000); // disable the login prompt automatically after 4s
						}
					},
					function(){
						self.mainframe.contentWindow.location.reload();
					});
				});
				window.addEventListener('message', jQuery.proxy(this.messageHandler, this));
				break;
			case 'rocketchat.chat':
				this.chatbox = this.et2.getWidgetById('chatbox').getDOMNode();
				jQuery(this.chatbox).on('load', function(){
					self._isRocketchatLoaded().then(function(_mode){
						if (self._shouldCallCustomOAuth(_mode))
						{
							self.postMessage('call-custom-oauth-login', {service:'egroupware'});
						}
					});
				});
		}
		window.addEventListener('message', jQuery.proxy(this.messageHandler, this));
	},

	/**
	 * Chech wheter custom call oauth relogin should be called
	 * @return {boolean}
	 * @private
	 */
	_shouldCallCustomOAuth:function(_mode)
	{
		return _mode !=="setup" && this.content['authentication'] ==='openid'
			&& !(sessionStorage.getItem('Meteor.loginToken:/:/rocketchat') || localStorage.getItem('Meteor.loginToken:/:/rocketchat'))
			&& !(sessionStorage.getItem('Meteor.loginToken') || localStorage.getItem('Meteor.loginToken'));
	},

	_isRocketchatLoaded: function()
	{
		var self = this;
		return new Promise (function(_resolve, _reject){
			window.setTimeout(function(){
				try {
					var frame = egw(window).is_popup() ? self.chatbox : self.mainframe;
					if (jQuery('.setup-wizard', frame.contentWindow.document).length > 0
							|| jQuery('[class*="SetupWizard"]', frame.contentWindow.document).length > 0)
					{
						self.install_info();
						_resolve("setup");
					}
					else if (jQuery('body', frame.contentWindow.document).length > 0)
					{
						_resolve();
					}
				}
				catch(e){
					_resolve('setup');
				}
				_reject();
			}, 1000);
		});
	},

	/**
	 * Opens Administration panel
	 * @returns {undefined}
	 */
	administration: function ()
	{
		this.postMessage('go', {path: '/admin'});
	},

	/**
	 * Opens My Account panel
	 * @returns {undefined}
	 */
	myaccount: function ()
	{
		this.postMessage('go', {path:'/account'});
	},

	/**
	 * iframe post message handler
	 *
	 * @param {type} e message
	 */
	messageHandler: function (e)
	{
		var self = this;
		var frame = egw(window).is_popup() ? self.chatbox : self.mainframe;
		try{
			if (frame && frame.contentWindow && jQuery('.setup-wizard', frame.contentWindow.document))
			{
				jQuery(frame.contentWindow.document.body).off().on('click', function(e){
					if (e.target.nodeName =="BUTTON" && e.target.className == "rc-button rc-button--primary js-finish")
					{
						self.postMessage('logout');
						et2_dialog.alert("You're Rocket.Chat is installed, please once relogin to EGroupware.","Rocket.Chat");
					}
				});
			}
		}catch(e){
			console.log(e);
		}


		if (e && e.type == 'message' && e.data && e.data.eventName)
		{
			egw(window).loading_prompt('rocketchat-login', false);
			switch(e.data.eventName)
			{
				case 'room-opened':

					break;
				case 'notification':

					break;
				case 'new-message':

					break;
				case 'click-action-link':
					if (Object.keys(app.rocketchat.chatbox).length > 0
							&& typeof e['data']['data']['message']['t'] != 'undefined'
							&& e.data.data.message.t == 'jitsi_call_started')
					{
						this.egw.message('Sorry at the moment you can not join video calls from chat popup, please try to join this call either from Rocket.Chat main app or your desktop client.', 'warning');
					}
					break;
				default:
					console.log(e);
					break;
			}
		}

	},

	/**
	 *
	 * @param {type} _id
	 * @param {type} _data
	 * @returns {Boolean}
	 */
	chatPopupLookup: function(_id, _data)
	{
		var params = jQuery.extend({}, egw.link_get_registry('rocketchat', 'view'));
		params.path = _data.path;
		var popup = window.framework.popups_get(this.appname, {name:"^"+_id+"$"});
		if (!popup || popup.length == 0)
		{
			popup = egw.openPopup(egw.link('/index.php',params), params.width, params.height, _id, '', null, true);

		}
		return popup;
	},

	/**
	 * Post message to rocketchat iframe
	 * @param {type} _cmd command
	 * @param {type} _params paramaeters to send with command
	 *
	 * @returns {Boolean} return ture if successful
	 */
	postMessage: function (_cmd, _params)
	{
		var frame = egw(window).is_popup() ? this.chatbox : this.mainframe;
		if (frame)
		{
			frame.contentWindow.postMessage(jQuery.extend({externalCommand: _cmd}, _params), '*');
			return true;
		}
		egw.debug('No rocketchat frame found!');
	},

	/**
	 * Handle executed action on selected row
	 *
	 * @param {type} _action
	 * @param {type} _selected
	 * @TODO Implementing the response and error
	 */
	handle_actions: function (_action, _selected)
	{
		var user_id = _selected[0]['id'];
		var account_id = _selected[0]['data']['account_id'];
		var data = _selected[0]['data'];
		var self = this;
		var base_path = '';
		switch (_action.id)
		{
			case 'message':
				if (data && typeof data.data.rocketchat != 'undefined')
				{
					switch (data.data.rocketchat.type)
					{
						case 'c':
							base_path = 'channel';
							break;
						case 'p':
							base_path = 'group';
							break;
						default:
							base_path = 'direct';
					}

					this.chatPopupLookup(user_id, {path:base_path+'/'+user_id+'?layout=embedded'});
				}
				else
				{
					egw.message('You are not logged in Rocket.Chat app.', 'warning');
				}
				break;
			case 'linkto':
				et2_createWidget("dialog",{
					callback: function(button, value){
						if (button == et2_dialog.BUTTONS_YES_NO && value)
						{
							egw.json("EGroupware\\Api\\Etemplate\\Widget\\Link::ajax_link",
								['rocketchat', account_id, [{
									app: 'addressbook',
									id: value.link[0]
								}]],
								function(_result){
									if (_result)
									{
										app.status.mergeContent([{
											id: user_id,
											class: data.class.replace('unlinked', 'linked'),
											"link_to": {
												app: 'addressbook',
												id: value.link[0]
											}
										}]);
									}
								},
								self,
								true,
								self
							).sendRequest();
						}
						return true;
					},
					title: 'link to contact',
					buttons: et2_dialog.BUTTONS_YES_NO,
					type: et2_dialog.PLAIN_MESSAGE,
					template: egw.webserverUrl+'/rocketchat/templates/default/link_to_contact.xet',
					value: {content: ''}
				});
				break;
			case 'unlinkto':
				egw.json("EGroupware\\Api\\Etemplate\\Widget\\Link::ajax_delete",
					[data.link_to.link_id],
					function(_result){
						if (_result)
						{
							app.status.mergeContent([{
								id: user_id,
								class: data.class.replace('linked', 'unlinked'),
								"link_to": null
							}]);
						}
					},
					self,
					true,
					self
				).sendRequest();
				break;
		}

	},

	/**
	 * Rest Api call handler
	 *
	 * @param {string} _cmd
	 * @param {object} _data
	 * @returns {Promise|Boolean}
	 */
	restapi_call: function (_cmd, _data)
	{
		var data = _data || {};
		var cmd = _cmd;
		if (!_cmd) {
			egw.debug('You forgot the command!');
			return false;
		}
		return new Promise (function(_resolve, _reject){
			egw.json(
				"EGroupware\\Rocketchat\\Ui::ajax_restapi_call", [cmd, data],
				function(_response){
					if (typeof _resolve == 'function') _resolve(_response);
				}).sendRequest(true,'POST', function(_err){
					if (_err && _err.message) egw.message(_err.message);
					if (typeof _reject == 'function') _reject();
			});
		});
	},

	_subscriptionsInterval: function()
	{
		var self = this;
		let latest = [];
		window.setInterval(function () {
			self.api.getSubscriptions().then(function (_data) {
				if (_data && _data.msg === 'result' && _data.result.length > 0) {
					let data = [];
					let counter = 0;
					for (let i in _data.result) {
						let updateIt = true;
						let entry = {
							id: _data.result[i]['name'],
							stat1: _data.result[i]['unread'],
							fname: _data.result[i]['fname']
						};
						counter = (entry.stat1) ? counter + entry.stat1 : counter;
						for (let j in latest) {
							if (latest[j] && latest[j]['name'] == _data.result[i]['name']
								&& latest[j]['_updatedAt'].$date == _data.result[i]['_updatedAt'].$date
								&& latest[j]['unread'] == _data.result[i]['unread']) {
								updateIt = false;
							}
						}
						if (updateIt) {
							if ((_data.result[i]['t'] == 'c' || _data.result[i]['t'] == 'p') && _data.result[i]['alert']) {
								entry.stat1 = _data.result[i]['t'] == 'c' ? "#" : "@";
							}
							if (entry.stat1 > 0 && _data.result[i]['t'] == 'd') {
								self.notifyMe(entry);
							}
							data.push(entry);
						}
					}
					if (framework.notifyAppTab) framework.notifyAppTab('rocketchat', counter);
					if (data.length > 0) {
						latest = _data.result;
						if (app.status && app.status.et2) app.status.mergeContent(data);
					}

				}
			});
		}, this.updateInterval);

		// use getSubscription once to make sure the api is ready to bind the sub
		this.api.getSubscriptions().then(_=> {
			self.api.subscribeToNotifyLogged('user-status', function (_data) {
				if (_data) {
					let title = "";
					let data = [];
					let entry = {};
					for (let i in _data.fields.args) {
						data.push({
							id: _data.fields.args[i][1],
							class1: self._userStatusNum2String(_data.fields.args[i][2]),
							data: {rocketchat: {class: self._userStatusNum2String(_data.fields.args[i][2])}}
						});
						title = _data.fields.args[i][3] != "" ? _data.fields.args[i][3] : self._userStatusNum2String(_data.fields.args[i][2]);
						if (_data.fields.args[i][1] == egw.user('account_lid')) {
							jQuery('span.fw_avatar_stat', '#topmenu_info_user_avatar').attr({
								class: 'fw_avatar_stat stat1 ' + self._userStatusNum2String(_data.fields.args[i][2]),
								title: title
							});
							jQuery('#rc_status_select').val(self._userStatusNum2String(_data.fields.args[i][2])).trigger('liszt:updated');
							continue;
						}
						jQuery('tr#' + _data.fields.args[i][1] + ' span.stat1', '#egw_fw_sidebar_r').attr({
							class: 'et2_label stat1 ' + self._userStatusNum2String(_data.fields.args[i][2]),
							title: title
						});
					}
					if (app.status && app.status.et2) app.status.mergeContent(data);
				}
			});
		});
	},

	/**
	 * Get latest updates regarding the subscribed channels/users
	 * and will set unread indications accordingly.
	 */
	getUpdates: function ()
	{
		let self = this;
		let url_timeout = 1000; // 1s
		let api_timeout = 1000; // 1s
		const BACKOFFMAX = 1024000; //1024s max timeout then stops requesting
		let init = null;
		egw.json("EGroupware\\Rocketchat\\Hooks::ajax_getServerUrl", [], function (response){
			if (response && response.server_url) {
				let url = response.server_url;
				init = function () {
					if (self.api) return;
					checkApi().then(function () {
						self._subscriptionsInterval();
					}, init);
				};
				var checkApi = function (_resolve, _reject) {
					return new Promise(function (_resolve, _reject) {
						// query Rocket.Chat /api/info first
						jQuery.ajax(url + 'api/info').done(function (_response) {
							// only open websocket, if Rocket.Chat is not powered off
							if (!_response.powered || _response.powered !== 'off') {
								self.api = new rocketchat_realtime_api(
									url.replace(/^(https?:\/\/)?/, (url.substr(0, 5) == 'https' ? 'wss://' : 'ws://')) + 'websocket');
								_resolve();
							}
							else if(!self.api)
							{
								if (api_timeout <= BACKOFFMAX)
								{
									console.log("server is still booting! trying again in " + api_timeout/1000+"s")
									window.setTimeout(_reject, api_timeout);
									api_timeout *= 2; // 2s, 4s, 8s, 16s ... 1024s
								}
							}
						}).fail(function(){
							if (url_timeout <= BACKOFFMAX)
							{
								console.log("server is not reachable! trying again in "+url_timeout/1000+"s")
								window.setTimeout(init, url_timeout);
								url_timeout *= 4; // 'api/info' not reachable check every 4s, 16s, 64s, ... 1024s
							}
						});
					});
				};
				init();
			}
		}).sendRequest();
	},

	/**
	 * Conver numerical user-status code to string
	 * @param {int} _stat
	 * @returns {String}
	 */
	_userStatusNum2String: function (_stat)
	{
		switch (_stat)
		{
			case 0:
				return "offline";
			case 1:
				return "online";
			case 2:
				return "away";
			case 3:
				return "busy";
		}
	},

	/**
	 * Notify user about new incomming messages (sound and browser notifications)
	 *
	 * @param {object} _data
	 */
	notifyMe: function (_data)
	{
		let self = this;
		let notification = egw.preference('notification', this.appname);
		if (notification && notification != 0)
		{
			egw.notification(this.egw.lang('Rocket.Chat'), {
					body: this.egw.lang('You have %1 unread messages from %2', _data.stat1, _data.fname),
					icon: egw.image('navbar', this.appname) ,
					onclick: function () {
						self.handle_actions({id:'message'}, [{id:_data.id}]);
					}
			});
		}
	},

	/**
	 * Close app tab, for unconfigured Rocket.Chat
	 *
	 * @param {string} _msg error-message
	 */
	close_app: function(_msg)
	{
		jQuery(framework.activeApp.tab.closeButton).trigger('click');
		et2_dialog.alert(_msg, 'Rocket.Chat', et2_dialog.ERROR_MESSAGE);
	},

	/**
	 * Trigger Rocket.Chat installation
	 */
	install: function()
	{
		var w = window;
		var self = this;
		this.install_info(function(){
			egw.loading_prompt('install-rocketchat', true, self.egw.lang('Please wait while your Rocket.Chat server is installed ...'));
			jQuery.ajax({
				url: '/rocketchat/',
				success: function(_data, _text, _xheader){
					egw.loading_prompt('install-rocketchat', false);
					if (_xheader.status == 200 || _xheader.stat == 302)
					{
						w.location.href = egw.link('/index.php', { menuaction: "rocketchat.EGroupware\\rocketchat\\Ui.index", "clear-cache": true});
					}
				},
				error: function(_xheader){
					egw.loading_prompt('install-rocketchat', false);
					egw.message(_xheader.responseText, 'error');
				}
			});
		});
	},

	install_info: function (_callback) {
		var callback = _callback;
		et2_dialog.show_dialog(function(_button){
			if (_button == et2_dialog.YES_BUTTON)
			{
				egw.openPopup(egw.link('/index.php', { menuaction: "rocketchat.EGroupware\\rocketchat\\Ui.install"}));
			}
			if (typeof callback == 'function') callback.call();
			return true;
		},"Would you like to see installation instructions?", "Instructions");
	},
	/**
	 * on logout clicked event
	 */
	onLogout: function() {
		sessionStorage.removeItem('Meteor.loginToken:/:/rocketchat');
		localStorage.removeItem('Meteor.loginToken:/:/rocketchat');
	},

	/**
	 * Check if rocketchat is already active
	 *
	 * @param {object} _action egw action object
	 * @param {array} _selected array of selected rows
	 *
	 * @returns {Boolean} return true if the rocketchat is active
	 */
	isRCActive: function (_action, _selected) {
		var data = _selected[0]['data'];
		return (data && typeof data.data.rocketchat != 'undefined');
	}
});
