<?php
/**
 * REST API for Rocketchat app
 *
 * @link http://www.egroupware.org
 * @author Hadi Nategh <hn-At-egroupware.org>
 * @package Rocketchat
 * @copyright (c) 2019 by Hadi Nategh <hn-At-egroupware.org>
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 */

namespace EGroupware\Rocketchat\Api;

use EGroupware\Api\Config;
use EGroupware\Api\Cache;
use EGroupware\Rocketchat\Exception;
use EGroupware\Rocketchat;
use EGroupware\OpenID\Token;

/**
 * Description of Connection
 *
 * @author hadi
 */
class Restapi {

	/**
	 * Default Server URL (rocketchat server url)
	 */
	const DEFAULT_SERVER_URL = 'https://rocketchat.egroupware.org/rocketchat/';

	/**
	 * Api URL
	 */
	const API_URL = 'api/v1/';

	/**
	 * Debug mode switch
	 */
	const DEBUG = false;

	/**
	 * auth session key
	 */
	const AUTH_SESSION = 'auth';

	/**
	 * OAuth scopes used for the access-token
	 */
	const OAUTH_SCOPES = 'openid profile email';

	/**
	 * Api data
	 * @var array
	 */
	private $data = [];

	/**
	 * User ID
	 * @var string
	 */
	private $userId;

	/**
	 * User auth token
	 * @var string
	 */
	private $authToken;

	/**
	 * Constructor
	 * @param array $_data
	 * @throws Exception\LoginFailure
	 */
	public function __construct($_data = [])
	{
		$config = Config::read('rocketchat');
		$this->data = array_merge([
			'api_path' => $config['server_url'] ? $config['server_url'].self::API_URL : self::DEFAULT_SERVER_URL.self::API_URL,
			'user' => $GLOBALS['egw_info']['user']['account_email'],
			'authentication' => $config['authentication'],
			'oauth_client_id' => $config['oauth_client_id'],
			'oauth_service_name' => $config['oauth_service_name'],
		], $_data);

		if (($auth = Cache::getSession(Rocketchat\Hooks::APPNAME, self::AUTH_SESSION)))
		{
			$this->userId = $auth['userId'];
			$this->authToken = $auth['authToken'];
			if (!$this->me())
			{
				// force a new login with next API call
				Api\Cache::unsetSession(self::APPNAME, 'logged_in');
			}
		}
	}

	/**
	 * Api call
	 *
	 * @param string $_api_path api url
	 * @param type $_method = GET
	 * @param type $_params = []
	 * @return array return an array of response
	 * @throws Exception
	 */
	private function api_call ($_api_path, $_method="GET", $_params=[])
	{
		$full_path = !empty($this->data['api_path']) ? $this->data['api_path'] : self::DEFAULT_SERVER_URL.self::API_URL;
		$full_path .= $_api_path;
		$header = [
			"X-Auth-Token: ".($_params['X-Auth-Token'] ? $_params['X-Auth-Token'] : $this->authToken),
			"X-User-Id: ".($_params['X-User-Id'] ? $_params['X-User-Id'] : $this->userId),
			"Content-Type: application/json"
		];
		// remove X-Auth-Token, if empty (eg. login via accessToken)
		if ($header[0] === "X-Auth-Token: ") unset($header[0]);

		// authToken and useId can be passed through params to setup the header
		// but do not include them in curl URL.
		unset($_params['X-User-Id'], $_params['X-Auth-Token']);
		$curl = curl_init();
		$curlOpts = [
			CURLOPT_HTTPHEADER => $header,
			CURLOPT_CUSTOMREQUEST => $_method,
			CURLOPT_RETURNTRANSFER => 1,
			CURLOPT_FOLLOWLOCATION => 1,
			//CURLOPT_VERBOSE => 1,
			CURLOPT_URL => $full_path,
		];
		if ($_method == "POST")
		{
			$curlOpts[CURLOPT_POSTFIELDS] = json_encode($_params);
		}
		else
		{
			$curlOpts[CURLOPT_URL] .= '?'. http_build_query($_params);
		}
		curl_setopt_array($curl, $curlOpts);
		if (!($json = curl_exec($curl)))
		{
			throw new \Exception("Error contacting Api server: $full_path");
		}
		curl_close($curl);
		if (self::DEBUG) error_log(__METHOD__."($_api_path, $_method) curlOpts=".array2string($curlOpts)." returned $json");
		return json_decode($json, true);
	}

	/**
	 * Login
	 * https://rocket.chat/docs/developer-guides/rest-api/authentication/login/
	 *
	 * @param string $_user
	 * @param string $_pass
	 * @return boolean
	 * @throws Exception\LoginFailure
	 */
	public function login ($_user, $_pass)
	{
		switch($this->data['authentication'])
		{
			case 'credentials':
				$response = self::_responseHandler($this->api_call('login', 'POST', ['user' => $_user, 'password' => $_pass]), 'status');
				break;

			case 'openid':	// own OpenID Connect / OAuth server
				$tokenFactory = new Token();
				$token = $tokenFactory->accessToken($this->data['oauth_client_id'], explode(' ', self::OAUTH_SCOPES));
				$response = self::_responseHandler($this->api_call('login', 'POST', [
					'serviceName' => $this->data['oauth_service_name'],
					'X-User-Id' => $this->data['user'],
					'accessToken' => $token,
					'expiresIn' => 3600,	// default TTL of access-token
				]), 'status');
				break;
		}
		if (!$response['success'] || !$response) {
			if (self::DEBUG) error_log(__METHOD__. 'Command login failed because of'.$response['message']);
			throw new Exception\LoginFailure($response['message']);
		}
		$this->userId = $response['response']['data']['userId'];
		$this->authToken = $response['response']['data']['authToken'];
		if ($this->userId && $this->authToken)
		{
			Cache::setSession('rocketchat', 'auth', ['userId'=>$this->userId, 'authToken' => $this->authToken]);
		}
		return true;
	}

	/**
	 * Quick information about the authenticated user.
	 *
	 * @return array
	 */
	public function me ()
	{
		$response = self::_responseHandler($this->api_call('me', 'GET', ['userId' => $this->userId]));
		if (!$response['success'])
		{
			if (self::DEBUG) error_log(__METHOD__. 'Command me failed because of'.$response['message']);
			return false;
		}
		return $response['response'];
	}

	/**
	 * User info
	 * Retrieves information about a user, the result is only limited to what
	 * the callee has access to view. It supports Fields Query Parameter with
	 * the userRooms field, that returns the rooms that the user is part of.
	 * https://rocket.chat/docs/developer-guides/rest-api/users/info/
	 *
	 * @param string $_args userId or username
	 *
	 * @return array return user's info
	 */
	public function usersinfo ($_args=[])
	{
		if (empty($_args['userId']) && empty($_args['username'])) $_args['userId'] = $this->userId;
		$response = self::_responseHandler($this->api_call('users.info', 'GET', $_args));
		if (!$response['success'])
		{
			if (self::DEBUG) error_log(__METHOD__. 'Command usersinfo failed because of'.$response['message']);
			return false;
		}
		return $response['response']['user'];
	}

	/**
	 * Users list
	 *
	 * Gets all of the users in the system and their information,
	 * the result is only limited to what the callee has access to view.
	 * It supports the Offset, Count, and Sort Query Parameters along with
	 * Query and Fields Query Parameter.
	 * https://rocket.chat/docs/developer-guides/rest-api/users/list/
	 *
	 * @param array $_args
	 *		fields => [name => 1, email => 0] Field include hash (value of 1 to include, 0 to exclude).
	 * 		query => [active => true, type => [$in => ['user', 'bot']]] Query filter hash.
	 *
	 * @return array returns list of users
	 */
	public function userslist ($_args=[])
	{
		$args = array_map('json_encode', $_args);
		$response = self::_responseHandler($this->api_call('users.list', 'GET', $args));
		if (!$response['success'])
		{
			if (self::DEBUG) error_log(__METHOD__.'Command userslist failed because of'.$response['message']);
			return false;
		}
		return $response['response']['users'];
	}

	/**
	 * Chat postMessage
	 *
	 * @param type $_args
	 * @return array|boolean
	 */
	public function chat_PostMessage ($_args=[])
	{
		$args = array_map('json_encode', $_args);
		$response = self::_responseHandler($this->api_call('chat.postMessage', 'POST', $args));
		if (!$response['success'])
		{
			if (self::DEBUG) error_log(__METHOD__.'Command chat.postMessage failed because of'.$response['message']);
			return false;
		}
		return $response['response'];
	}


	/**
	 * Response error handler
	 *
	 * @param array $response
	 * @return array
	 */
	private static function _responseHandler ($response)
	{
		if (is_array($response))
		{
			$result = [
				'response' => $response,
				'message' => $response['message'],
				'success' => true
			];
			if ($response['error'])
			{
				$result['success'] = false;
			}
			elseif (isset($response['success']) && $response['success'] == true
					|| isset ($response['status']) && $response['status'] == 'success')
			{
				$result['success'] = true;
			}
		}
		return $result;
	}
}
