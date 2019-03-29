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
 */
app.classes.rocketchat = AppJS.extend(
{
	appname: 'rocketchat',

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

		switch (name)
		{
			case 'rocketchat.index':
				this.mainframe = this.et2.getWidgetById('iframe').getDOMNode();
				window.addEventListener('message', jQuery.proxy(this.messageHandler, this));
				break;
			case 'rocketchat.chat':
				this.chatbox = this.et2.getWidgetById('chatbox').getDOMNode();

		}
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
		if (e && e.type == 'message' && e.data && e.data.eventName)
		{
			switch(e.data.eventName)
			{
				case 'room-opened':

					break;
				case 'notification':
					this.chatPopupLookup(e.data.data.notification.payload.sender._id, {path: 'direct/'+e.data.data.notification.payload.sender.username+'?layout=embedded'});
					break;
				case 'new-message':
					if (typeof e.data.data.room !='undefined' && typeof e.data.data.room.name !='undefined')
					{
						this.chatPopupLookup(e.data.data._id, {path: 'group/'+e.data.data.room.name+'?layout=embedded'});
					}

					break;
				default:
					console.log(e)
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
		var params = jQuery.extend({}, egw.link_get_registry('rocketchat', 'add'));
		params.path = _data.path;
		var popup = window.framework.popups_get(this.appname, {name:"/^"+_id+"$/"});
		if (!popup || popup.length == 0)
		{
			popup = egw.openPopup(egw.link('/index.php',params), params.width, params.height, _id, 'rocketchat', null, true);

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
		if (this.mainframe)
		{
			this.mainframe.contentWindow.postMessage(jQuery.extend({externalCommand: _cmd}, _params), '*');
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
		var self = this;
		switch (_action.id)
		{
			case 'message':
				et2_createWidget("dialog",{
					callback: function (_button_id, _value) {
						if (_button_id === 'send' && _value && _value.text != '')
						{
							self.restapi_call('chat_postMessage', {channel:'@'+user_id, text:_value.text}).then(function(){}, function(){});
							return true;
						}
					},
					title: 'Direct message',
					buttons: [
						{id: 'send', text: egw.lang('send'), default:true, image:"check"},
						{id: 'cancel', text: egw.lang('cancel'), default:false, image:"cancel"}
					],
					type: et2_dialog.PLAIN_MESSAGE,
					template: egw.webserverUrl+'/rocketchat/templates/default/dialog_message.xet',
					value: {content: {}}
				});
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
	}

});