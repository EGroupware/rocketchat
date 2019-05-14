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

	updateInterval: 2000,
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

					break;
				case 'new-message':

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
		var popup = window.framework.popups_get(this.appname, {name:"^"+_id+"$"});
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
				this.chatPopupLookup(user_id, {path:'direct/'+user_id+'?layout=embedded'});
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

	/**
	 * Get latest updates regarding the subscribed channels/users
	 * and will set unread indications accordingly.
	 */
	getUpdates: function ()
	{
		var self = this;
		egw.json("EGroupware\\Rocketchat\\Hooks::ajax_getServerUrl", [], function (response){
			if (response && response.server_url != '')
			{
				var url = response.server_url.replace(/^(https?:\/\/)?/, (response.server_url.substr(0,5) == 'https' ? 'wss://' : 'ws://'))+'websocket';
				var api = new rocketchat_realtime_api(url);
				var latest = [];
				window.setInterval(function(){
					api.getSubscriptions().then(function(_data){
						if (_data && _data.msg === 'result' && _data.result.length > 0)
						{
							var data = [];
							for (var i in _data.result)
							{
								var updateIt = true;
								var entry = {id: _data.result[i]['name'], stat1:_data.result[i]['unread']};
								for (var j in latest)
								{
									if (latest[j] && latest[j]['name'] ==_data.result[i]['name'] && latest[j]['_updatedAt'].$date == _data.result[i]['_updatedAt'].$date)
									{
										updateIt = false;
									}
								}
								if (updateIt)
								{
									data.push(entry);
								}
							}
							if (data.length > 0)
							{
								latest = _data.result;
								app.status.mergeContent(data);
							}

						}
					}, function(_error){console.log(_error)});
				}, self.updateInterval);
			}
		}).sendRequest();
	}

});