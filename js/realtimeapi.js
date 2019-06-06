/**
 * EGroupware Rocketchat RealtimeApi
 *
 * @package Rocketchat
 * @author Hadi Nategh <hn-At-egroupware.org>
 * @copyright 2018 by Hadi Nategh <hn-At-egroupware.org>
 * @description Realtime Api
 */

/**
 * Realtime Api constructor
 *
 * @param {type} _url websocket url
 */
function rocketchat_realtime_api (_url)
{
	this.url = _url || '';
	this.onmessage_callback = {};
	this.id = egw.user('account_lid');
	this._resolveResponse = function (_response) {
		return JSON.parse (_response.data ? _response.data : '{}');
	};
	try {
		this.socket = new WebSocket (this.url);
		if (this.socket)
		{
			this.socket.onopen = jQuery.proxy(this._onopen, this);
			this.socket.onmessage = jQuery.proxy(this._onmessage, this);
		}
	} catch (e) {
		console.log(e);
	}
}

/**
 * Make a sockect connection and authenticate with authToken
 */
rocketchat_realtime_api.prototype._connect = function () {
	var connectRequest = {
				"msg": "connect",
				"version": "1",
				"support": ["1", "pre2", "pre1"]
			};
	this._send(connectRequest);
	var self = this;
	egw.json("EGroupware\\Rocketchat\\Hooks::ajax_getAuthToken", [], function(_data){
		var loginRequest = {
			"msg": "method",
			"method": "login",
			"id": self.id,
			"params": [
				{ "resume": _data.token }
			  ]
		};
		self._send(loginRequest);
	}).sendRequest();
};

/**
 * send request to the socket
 * @param {object} _request
 */
rocketchat_realtime_api.prototype._send = function (_request) {
	if (this.socket.readyState == 1)
	{
		this.socket.send(JSON.stringify(_request));
	}
	else
	{
		console.log("Socket connection is not ready or it's closed already");
	}
};

/**
 * socket onopen event
 * @param {object} _response
 */
rocketchat_realtime_api.prototype._onopen = function (_response) {
	if (this.socket.readyState && _response.type == 'open')
	{
		this._connect();
	}
};

/**
 * socket on message event
 * @param {object} _response
 */
rocketchat_realtime_api.prototype._onmessage = function (_response) {
	var response = this._resolveResponse(_response);

	if (response.msg == 'ping')
	{
		this._send({
			msg: 'pong'
		});
	}
	switch (response.msg)
	{
		case 'changed':
			if (this.onmessage_callback && response.collection == 'stream-notify-logged' && response.fields.eventName)
			{
				this.onmessage_callback[response.fields.eventName].call(this, response);
			}
			break;
		case 'result':
			 if (this.onmessage_callback && typeof this.onmessage_callback.getSubscriptions == 'function')
			 {
				 this.onmessage_callback.getSubscriptios.call(this, response);
			 }
			break;
	}
};

/**
 * Get subscribed channels
 * @returns {Promise}
 */
rocketchat_realtime_api.prototype.getSubscriptions = function () {
	var self = this;
	return new Promise (function(_resolve, _reject){
		self.onmessage_callback.getSubscriptios = function (_result) {
			if (_result.error)
			{
				_reject(_result.error);
			}
			else
			{
				_resolve(_result);
			}
		};
		self._send({
			msg: "method",
			method: "subscriptions/get",
			id: self.id
		});
	});
};

/**
 * subscribe to Notify logged users
 *
 * @param {string} _event
 *		Users:NameChanged
 *		Users:Deleted
 *		updateAvatar
 *		updateEmojiCustom
 *		deleteEmojiCustom
 *		roles-change
 *		user-status
 *
 * @returns {Promise}
 */
rocketchat_realtime_api.prototype.subscribeToNotifyLogged = function (_event) {
	var self = this;
	return new Promise (function(_resolve, _reject){
		self.onmessage_callback[_event] = function (_result) {
			if (_result.error)
			{
				_reject(_result.error);
			}
			else
			{
				_resolve(_result);
			}
		};

		self._send({
			"msg": "sub",
			"id": self.id,
			"name": "stream-notify-logged",
			"params":[_event, true]
		});
	});
};



/**
 * Set user presence
 * @param {string} _stat
 *		online
 *		offline
 *		away
 *		busy
 *
 * @returns {Promise}
 */
rocketchat_realtime_api.prototype.setUserPresence = function (_stat) {
	var self = this;
	var stat = _stat;
	return new Promise (function(_resolve, _reject){
		self.onmessage_callback.setUserPresence = function (_result) {
			if (_result.error)
			{
				_reject(_result.error);
			}
			else
			{
				_resolve(_result);
			}
		};
		self._send({
			msg: "method",
			method: "UserPresence:setDefaultStatus",
			id: self.id,
			params: [stat]
		});
	});
};

