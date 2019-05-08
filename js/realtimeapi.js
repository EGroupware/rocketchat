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
	if (this._resolveResponse(_response).msg == 'ping')
	{
		this._send({
			msg: 'pong'
		});
	}
	if (typeof this.onmessage_callback == 'function' && this._resolveResponse(_response).msg == 'result') {
		this.onmessage_callback.call(this, this._resolveResponse(_response));
	}
};

/**
 * Get subscribed channels
 * @returns {Promise}
 */
rocketchat_realtime_api.prototype.getSubscriptions = function () {
	var self = this;
	return new Promise (function(_resolve, _reject){
		self.onmessage_callback = function (_result) {
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
