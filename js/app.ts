/**
 * EGroupware - Rocketchat
 *
 * @link: https://www.egroupware.org
 * @package Rocketchat
 * @author Hadi Nategh <hn-At-egroupware.org>
 * @copyright (c) 2019 by Hadi Nategh <hn-At-egroupware.org>
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 */

import { EgwApp } from '../../api/js/jsapi/egw_app';


import "./init.js";
import {rocketchat_realtime_api} from "./realtimeapi.js";
import {Et2Dialog} from "../../api/js/etemplate/Et2Dialog/Et2Dialog";
import type {statusApp} from "../../status/js/app";
// egw/app are ambient globals (declare global {} in egw_global.d.ts, unconditionally included
// via tsconfig's "**/*.d.ts") - no import needed or possible.

export class RocketchatApp extends EgwApp
{
	api : rocketchat_realtime_api;

	updateInterval : any = 10000;
	rocketchat : any = {};

	mainframe : any = {};

	chatbox : any = {};

	content : any = {};

	constructor()
	{
		super('rocketchat');

		this.messageHandler = this.messageHandler.bind(this);
	}

	/**
	 * Click handler for the "finish" button of the Rocket.Chat setup-wizard iframe, bound once and
	 * re-attached (after removing any previous binding) each time messageHandler() runs, the native
	 * equivalent of jQuery's .off().on('click', ...) idiom.
	 */
	private _setupWizardClickHandler = (e : MouseEvent) =>
	{
		const target = <HTMLElement>e.target;
		if (target.nodeName == "BUTTON" && target.className == "rc-button rc-button--primary js-finish")
		{
			this.postMessage('logout');
			Et2Dialog.alert("Your Rocket.Chat is installed, please once relogin to EGroupware.", "Rocket.Chat");
		}
	};

	destroy(_app)
	{
		super.destroy(_app);

		window.removeEventListener('message', this.messageHandler);
	}

	/**
	 * Get the real <iframe> DOM node for an iframe widget
	 *
	 * Et2Iframe (the webcomponent) keeps its actual <iframe> inside a shadow root -
	 * widget.getDOMNode() (inherited, unoverridden) returns the <et2-iframe> host element
	 * instead, which has neither a `load` event nor a `contentWindow`. __getIframeNode() is
	 * Et2Iframe's own accessor for the real node. Falls back to getDOMNode() for the legacy
	 * et2_iframe widget, where that already *is* the real iframe.
	 */
	private static realIframeNode(widget : any) : HTMLIFrameElement
	{
		if(!widget) return null;
		return (typeof widget.__getIframeNode === 'function' ? widget.__getIframeNode() : widget.getDOMNode()) || null;
	}

	et2_ready(et2,name)
	{
		// call parent
		super.et2_ready(et2, name);

		this.content = this.et2.getArrayMgr('content').data;
		switch (name)
		{
			case 'rocketchat.index':
				egw(window).loading_prompt('rocketchat-loading', true, this.egw.lang('Loading Rocket.Chat ...'), '#rocketchat-index');
				this.mainframe = RocketchatApp.realIframeNode(this.et2.getWidgetById('iframe'));
				this.mainframe.addEventListener('load', () =>
				{
					this.getUpdates();
					this._isRocketchatLoaded().then((_mode) =>
					{
						egw(window).loading_prompt('rocketchat-loading', false);
						if (this._shouldCallCustomOAuth(_mode))
						{
							this.postMessage('call-custom-oauth-login', {service:'egroupware'});
							egw(window).loading_prompt('rocketchat-login', true, this.egw.lang('Logging you into Rocket.Chat ...'), '#rocketchat-index');
							window.setTimeout(() =>
							{
								egw(window).loading_prompt('rocketchat-login', false);
							}, 4000); // disable the login prompt automatically after 4s
						}
					},
					() =>
					{
						this.mainframe.contentWindow.location.reload();
					});
				});
				break;

			case 'rocketchat.chat':
				this.chatbox = RocketchatApp.realIframeNode(this.et2.getWidgetById('chatbox'));
				this.chatbox.addEventListener('load', () =>
				{
					this._isRocketchatLoaded().then((_mode) =>
					{
						if (this._shouldCallCustomOAuth(_mode))
						{
							this.postMessage('call-custom-oauth-login', {service:'egroupware'});
						}
					});
				});
		}
		window.addEventListener('message', this.messageHandler);
	}

	/**
	 * Chech wheter custom call oauth relogin should be called
	 * @return {boolean}
	 * @private
	 */
	_shouldCallCustomOAuth(_mode)
	{
		return _mode !== "setup" && this.content['authentication'] === 'openid'
			&& !(sessionStorage.getItem('Meteor.loginToken:/:/rocketchat') || localStorage.getItem('Meteor.loginToken:/:/rocketchat'))
			&& !(sessionStorage.getItem('Meteor.loginToken') || localStorage.getItem('Meteor.loginToken'));
	}

	_isRocketchatLoaded() : Promise<string|void>
	{
		// was a plain function() expression before - since a Promise executor is invoked directly
		// (not as a method), its "this" was always undefined here, so this.chatbox/mainframe/
		// install_info() always threw and landed in the catch below, unconditionally resolving
		// "setup". Converting to an arrow (this = the RocketchatApp instance) restores the
		// evident intent of actually checking the iframe's DOM.
		return new Promise<string|void>((_resolve, _reject) =>
		{
			window.setTimeout(() =>
			{
				try {
					const frame = egw(window).is_popup() ? this.chatbox : this.mainframe;
					const doc = frame.contentWindow.document;
					if (doc.querySelectorAll('.setup-wizard').length > 0
							|| doc.querySelectorAll('[class*="SetupWizard"]').length > 0)
					{
						this.install_info();
						_resolve("setup");
					}
					else if (doc.querySelectorAll('body').length > 0)
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
	}

	/**
	 * Opens Administration panel
	 * @returns {undefined}
	 */
	administration()
	{
		this.postMessage('go', {path: '/admin'});
	}

	/**
	 * Opens My Account panel
	 * @returns {undefined}
	 */
	myaccount()
	{
		this.postMessage('go', {path:'/account'});
	}

	/**
	 * iframe post message handler
	 *
	 * @param {type} e message
	 */
	messageHandler(e)
	{
		const frame = egw(window).is_popup() ? this.chatbox : this.mainframe;
		try{
			// jQuery(selector, context) used to be truthy regardless of match-count - check for an
			// actual match instead, so the click handler is only (re-)attached while the setup
			// wizard is really showing
			if (frame && frame.contentWindow && frame.contentWindow.document.querySelector('.setup-wizard'))
			{
				const body = frame.contentWindow.document.body;
				body.removeEventListener('click', this._setupWizardClickHandler);
				body.addEventListener('click', this._setupWizardClickHandler);
			}
		}
		catch(e) {
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
					if (Object.keys((<RocketchatApp>app.rocketchat).chatbox).length > 0
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

	}

	/**
	 *
	 * @param {type} _id
	 * @param {type} _data
	 * @returns {Boolean}
	 */
	chatPopupLookup(_id, _data)
	{
		const params : any = egw.link_get_registry('rocketchat', 'view');
		params.path = _data.path;
		let popup = window.framework.popups.get(this.appname, {name:"^"+_id+"$"});
		if (!popup || popup.length == 0)
		{
			popup = egw.openPopup(egw.link('/index.php',params), params.width, params.height, _id, '', null, 'yes');
		}
		return popup;
	}

	/**
	 * Post message to rocketchat iframe
	 * @param {type} _cmd command
	 * @param {type} _params paramaeters to send with command
	 *
	 * @returns {Boolean} return ture if successful
	 */
	postMessage(_cmd, _params?)
	{
		const frame = egw(window).is_popup() ? this.chatbox : this.mainframe;
		if (frame)
		{
			frame.contentWindow.postMessage({externalCommand: _cmd, ..._params}, '*');
			return true;
		}
		egw.debug('error', 'No rocketchat frame found!');
	}

	/**
	 * Handle executed action on selected row
	 *
	 * @param {type} _action
	 * @param {type} _selected
	 * @TODO Implementing the response and error
	 */
	handle_actions(_action, _selected)
	{
		const user_id = _selected[0]['id'];
		const account_id = _selected[0]['data']['account_id'];
		const data = _selected[0]['data'];
		let base_path = '';
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

					this.chatPopupLookup(user_id, {path: base_path + '/' + user_id + '?layout=embedded'});
				}
				else
				{
					egw.message('You are not logged in Rocket.Chat app.', 'warning');
				}
				break;
			case 'linkto':
				const dialog = new Et2Dialog(this.egw);
				dialog.transformAttributes({
					// invoked via Et2Dialog's own callback.call(this, ...)/this.callback(...), so "this"
					// here is the dialog, not RocketchatApp - kept as a concise method (not an arrow) for
					// that reason, same documented exception as admin/status app.ts
					callback(button, value)
					{
						if (button == Et2Dialog.BUTTONS_YES_NO && value)
						{
							egw.request("EGroupware\\Api\\Etemplate\\Widget\\Link::ajax_link",
								['rocketchat', account_id, [{
									app: 'addressbook',
									id: value.link[0]
								}]]
							).then((_result) =>
							{
								if (_result)
								{
									(<statusApp>app.status).mergeContent([{
										id: user_id,
										class: data.class.replace('unlinked', 'linked'),
										"link_to": {
											app: 'addressbook',
											id: value.link[0]
										}
									}]);
								}
							});
						}
						return true;
					},
					title: 'link to contact',
					buttons: Et2Dialog.BUTTONS_YES_NO,
					type: Et2Dialog.PLAIN_MESSAGE,
					template: egw.webserverUrl + '/rocketchat/templates/default/link_to_contact.xet',
					value: {content: ''}
				});
				document.body.appendChild(dialog);
				break;
			case 'unlinkto':
				egw.request("EGroupware\\Api\\Etemplate\\Widget\\Link::ajax_delete",
					[data.link_to.link_id]
				).then((_result) =>
				{
					if (_result)
					{
						(<statusApp>app.status).mergeContent([{
							id: user_id,
							class: data.class.replace('linked', 'unlinked'),
							"link_to": null
						}]);
					}
				});
				break;
		}

	}

	/**
	 * Rest Api call handler
	 *
	 * @param {string} _cmd
	 * @param {object} _data
	 * @returns {Promise|Boolean}
	 */
	restapi_call(_cmd, _data)
	{
		const data = _data || {};
		const cmd = _cmd;
		if (!_cmd) {
			egw.debug('error', 'You forgot the command!');
			return false;
		}
		return new Promise ((_resolve, _reject) =>
		{
			// kept as egw.json(...).sendRequest() - egw.request() has no error-callback parameter at
			// all, and this call needs one to suppress the default error dialog (in favour of
			// egw.message()) and to reject this Promise, so there's no equivalent swap
			egw.json(
				"EGroupware\\Rocketchat\\Ui::ajax_restapi_call", [cmd, data],
				(_response) =>
				{
					if (typeof _resolve == 'function') _resolve(_response);
				}).sendRequest(true,'POST', (_err) =>
				{
						if (_err && _err.message) egw.message(_err.message);
						if (typeof _reject == 'function') _reject();
				});
		});
	}

	_subscriptionsInterval()
	{
		let latest = [];
		window.setInterval(() =>
		{
			this.api.getSubscriptions().then((_data) =>
			{
				if (_data && _data.msg === 'result' && _data.result.length > 0)
				{
					let data = [];
					let counter = 0;
					for (let i in _data.result)
					{
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
								this.notifyMe(entry);
							}
							data.push(entry);
						}
					}
					if (framework.notifyAppTab) framework.notifyAppTab('rocketchat', counter);
					if (data.length > 0)
					{
						latest = _data.result;
						if (app.status && app.status.et2) (<statusApp>app.status).mergeContent(data);
					}

				}
			});
		}, this.updateInterval);

		// use getSubscription once to make sure the api is ready to bind the sub
		this.api.getSubscriptions().then(_=>
		{
			this.api.subscribeToNotifyLogged('user-status', (_data) =>
			{
				if (_data) {
					let title = "";
					let data = [];
					for (let i in _data.fields.args)
					{
						data.push({
							id: _data.fields.args[i][1],
							class1: this._userStatusNum2String(_data.fields.args[i][2]),
							data: {rocketchat: {class: this._userStatusNum2String(_data.fields.args[i][2])}}
						});
						title = _data.fields.args[i][3] != "" ? _data.fields.args[i][3] : this._userStatusNum2String(_data.fields.args[i][2]);
						if (_data.fields.args[i][1] == egw.user('account_lid'))
						{
							document.querySelectorAll<HTMLElement>('#topmenu_info_user_avatar span.fw_avatar_stat').forEach((el) =>
							{
								el.className = 'fw_avatar_stat stat1 ' + this._userStatusNum2String(_data.fields.args[i][2]);
								el.title = title;
							});
							const status_select = <HTMLSelectElement>document.getElementById('rc_status_select');
							if (status_select)
							{
								status_select.value = this._userStatusNum2String(_data.fields.args[i][2]);
								status_select.dispatchEvent(new Event('liszt:updated'));
							}
							continue;
						}
						document.querySelectorAll<HTMLElement>('#egw_fw_sidebar_r tr#' + _data.fields.args[i][1] + ' span.stat1').forEach((el) =>
						{
							el.className = 'et2_label stat1 ' + this._userStatusNum2String(_data.fields.args[i][2]);
							el.title = title;
						});
					}
					if (app.status && app.status.et2) (<statusApp>app.status).mergeContent(data);
				}
			});
		});
	}

	/**
	 * Get latest updates regarding the subscribed channels/users
	 * and will set unread indications accordingly.
	 */
	getUpdates()
	{
		let url_timeout = 1000; // 1s
		let api_timeout = 1000; // 1s
		const BACKOFFMAX = 1024000; //1024s max timeout then stops requesting
		let init = null;
		egw.request("EGroupware\\Rocketchat\\Hooks::ajax_getServerUrl", []).then((response) =>
		{
			if (response && response.server_url)
			{
				const url = response.server_url;
				init = () =>
				{
					if (this.api) return;
					checkApi().then(() => {
						this._subscriptionsInterval();
					}, init);
				};
				const checkApi = (_resolve?, _reject?) =>
				{
					return new Promise<void>((_resolve, _reject) =>
					{
						// query Rocket.Chat /api/info first
						fetch(url + 'api/info').then((_response) =>
						{
							if (!_response.ok) throw _response;
							return _response.json();
						}).then((_response) =>
						{
							// only open websocket, if Rocket.Chat is not powered off
							if (!_response.powered || _response.powered !== 'off') {
								this.api = new rocketchat_realtime_api(
									url.replace(/^(https?:\/\/)?/, (url.substr(0, 5) == 'https' ? 'wss://' : 'ws://')) + 'websocket');
								_resolve();
							}
							else if(!this.api)
							{
								if (api_timeout <= BACKOFFMAX)
								{
									console.log("server is still booting! trying again in " + api_timeout/1000+"s")
									window.setTimeout(_reject, api_timeout);
									api_timeout *= 2; // 2s, 4s, 8s, 16s ... 1024s
								}
							}
						}).catch(() => {
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
		});
	}

	/**
	 * Conver numerical user-status code to string
	 * @param {int} _stat
	 * @returns {String}
	 */
	_userStatusNum2String(_stat)
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
	}

	/**
	 * Notify user about new incomming messages (sound and browser notifications)
	 *
	 * @param {object} _data
	 */
	notifyMe(_data)
	{
		let notification = egw.preference('notification', this.appname);
		if (notification)
		{
			egw.notification(this.egw.lang('Rocket.Chat'), {
					body: this.egw.lang('You have %1 unread messages from %2', _data.stat1, _data.fname),
					icon: egw.image('navbar', this.appname) ,
					// egw.notification() assigns this straight onto a real Notification instance's
					// .onclick, which would normally bind "this" to that instance when fired - but the
					// body only ever needs this.handle_actions(), never its own dynamic this, so an
					// arrow (same as status/app.ts's identical Notification.onclick precedent) is safe
					onclick: () =>
					{
						this.handle_actions({id:'message'}, [{id:_data.id}]);
					}
			});
		}
	}

	/**
	 * Close app tab, for unconfigured Rocket.Chat
	 *
	 * @param {string} _msg error-message
	 */
	close_app(_msg)
	{
		framework.activeApp.tab.closeButton.click();
		Et2Dialog.alert(_msg, 'Rocket.Chat', Et2Dialog.ERROR_MESSAGE);
	}

	/**
	 * Trigger Rocket.Chat installation
	 */
	install()
	{
		const w = window;
		// install_info() invokes this callback via a bare callback.call() (no thisArg), so a plain
		// function's own "this" would always be undefined here - an arrow uses install()'s own "this"
		// instead, regardless of how it's invoked
		this.install_info(() =>
		{
			egw.loading_prompt('install-rocketchat', true, this.egw.lang('Please wait while your Rocket.Chat server is installed ...'));
			fetch('/rocketchat/').then(async (_response) =>
			{
				egw.loading_prompt('install-rocketchat', false);
				if (_response.status == 200 || _response.status == 302)
				{
					w.location.href = egw.link('/index.php', { menuaction: "rocketchat.EGroupware\\rocketchat\\Ui.index", "clear-cache": true});
				}
				else
				{
					egw.message(await _response.text(), 'error');
				}
			}).catch(() =>
			{
				egw.loading_prompt('install-rocketchat', false);
			});
		});
	}

	install_info(_callback?)
	{
		const callback = _callback;
		Et2Dialog.show_dialog((_button) =>
		{
			if (_button == Et2Dialog.YES_BUTTON)
			{
				egw.openPopup(egw.link('/index.php', {menuaction: "rocketchat.EGroupware\\rocketchat\\Ui.install"}), 600, 600);
			}
			if (typeof callback == 'function')
			{
				callback.call();
			}
			return true;
		}, "Would you like to see installation instructions?", "Instructions");
	}
	/**
	 * on logout clicked event
	 */
	onLogout()
	{
		sessionStorage.removeItem('Meteor.loginToken:/:/rocketchat');
		localStorage.removeItem('Meteor.loginToken:/:/rocketchat');
	}

	/**
	 * Check if rocketchat is already active
	 *
	 * @param {object} _action egw action object
	 * @param {array} _selected array of selected rows
	 *
	 * @returns {Boolean} return true if the rocketchat is active
	 */
	isRCActive(_action, _selected)
	{
		const data = _selected[0]['data'];
		return data && typeof data.data?.rocketchat != 'undefined';
	}
}
app.classes.rocketchat = RocketchatApp;