/**
 * EGroupware Rocketchat RealtimeApi
 *
 * @package Rocketchat
 * @author Hadi Nategh <hn-At-egroupware.org>
 * @copyright 2018 by Hadi Nategh <hn-At-egroupware.org>
 * @description Realtime Api
 */
export const ROCKETCHAT_REALTIME_API_MAXTRY = 5;
/**
 * Realtime Api constructor
 *
 * @param {type} _url websocket url
 */
export function rocketchat_realtime_api (_url)
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
			this.socket.onclose = jQuery.proxy(this._onclose, this);
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
	}).sendRequest(false,'POST');
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
	else if (this.socket.readyState == 3)
	{
		console.log("Socket connection is not ready or it's closed already");
		rocketchat_realtime_api.prototype._reconnect.call(this);
	}
};


/**
 * On close event, happens when the connection is getting closed from server
 */
rocketchat_realtime_api.prototype._close = function (_request) {
	console.log("Socket connection is not ready or it's closed already");
	rocketchat_realtime_api.prototype._reconnect.call(this);
};

rocketchat_realtime_api.prototype._reconnect = function()
{
	// do not try to reconnect if the connection is already there
	if (this.socket.readyState == 1) return this._failed = 0;
	let self = this;
	this._failed = typeof this._failed == 'undefined' ? 1 : this._failed;
	// try to reconnect x5 with exponetially delay of 5s, 10s, 15s, 20s, 25s between each try
	if (this._failed <= ROCKETCHAT_REALTIME_API_MAXTRY && !this._tryTimeout)
	{
			this._tryTimeout = true;
			window.setTimeout(function(){
				if (self.socket.readyState == 1) return self._failed = 0;;
				rocketchat_realtime_api.call(self, self.url);
				console.log("Attempt ("+self._failed +") to reconnect to socket server in "+self._failed*5+"s");
				self._failed++;
				self._tryTimeout= false;
			}, 5000*self._failed);
	}
	else if(this._failed > ROCKETCHAT_REALTIME_API_MAXTRY)
	{
		console.log("Too many attempt to connect to the rocketchat server, the server might be not reachable!");
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
				 this.onmessage_callback.getSubscriptions.call(this, response);
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
		self.onmessage_callback.getSubscriptions = function (_result) {
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
 */
rocketchat_realtime_api.prototype.subscribeToNotifyLogged = function (_event, _callback) {
	this.onmessage_callback[_event] = _callback;

	this._send({
		"msg": "sub",
		"id": self.id,
		"name": "stream-notify-logged",
		"params":[_event, true]
	});
};



/**
 * Set user presence
 * @param {string} _stat
 *		online
 *		offline
 *		away
 *		busy
 */
rocketchat_realtime_api.prototype.setUserPresence = function (_stat) {
	this._send({
		msg: "method",
		method: "UserPresence:setDefaultStatus",
		id: this.id,
		params: [_stat]
	});
};

