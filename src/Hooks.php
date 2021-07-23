<?php
/**
 * Hooks for Rocketchat app
 *
 * @link http://www.egroupware.org
 * @author Hadi Nategh <hn-At-egroupware.org>
 * @package Rocketchat
 * @copyright (c) 2018 by Hadi Nategh <hn-At-egroupware.org>
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 */

namespace EGroupware\Rocketchat;

use EGroupware\Api;
use EGroupware\Status;
use EGroupware\Rocketchat\Exception;
use EGroupware\Rocketchat\Api\Restapi;

class Hooks
{
	const APPNAME = 'rocketchat';

	/**
	 * Register Rocket.Chat host (websocket) for CSP policies frame-src and connect-src
	 *
	 * @param $location "connect-src" | "frame-src"
	 * @return array
	 */
	public static function csp_frame_src($location)
	{
		$config = Api\Config::read('rocketchat');
		$srcs = [];
		// dont add RC, if not configured
		if (!empty($config['server_url']))
		{
			$srcs[] = preg_replace('#^(https?://[^/]+)(/.*)?#', '$1', $config['server_url']);

			if ($location === 'csp-connect-src')
			{
				$srcs[] = preg_replace('#^(https?://)?#',
					(substr($config['server_url'], 0, 5) == 'https' ? 'wss://' : 'ws://'), $config['server_url']);
			}
			// to easy the update: register the connect-src manually, if there is no csp-connect-src hook (yet) registered
			// todo: remove after 20.1 release
			elseif (!Api\Hooks::exists('csp-connect-src', self::APPNAME))
			{
				Api\Header\ContentSecurityPolicy::add_connect_src(self::csp_frame_src('csp-connect-src'));
			}
		}
		return $srcs;
	}

	/**
	 * Runs after framework js are loaded and includes all dependencies
	 *
	 * @param array $data
	 */
	public static function framework_header ($data)
	{
		if(!$data['popup'] && $GLOBALS['egw_info']['user']['apps']['rocketchat'])
		{
			Api\Framework::includeJS('/rocketchat/js/app.js',null,self::APPNAME);
		}
	}

	/**
	 * sidebox
	 */
	public static function sidebox_menu($data)
	{
		$file = array (
			'My Account' =>  'javascript:app.rocketchat.myaccount();'
		);
		display_sidebox(self::APPNAME, lang('My Account'), $file);

		display_sidebox(self::APPNAME, lang('Help'),  [
			[
				'text'   => 'Documentation',
				'link'   => 'https://rocket.chat/docs/user-guides/',
				'target' => '_blank',
			],
			[
				'text'   => 'EGroupware Wiki',
				'link'   => 'https://github.com/EGroupware/egroupware/wiki/Rocketchat-Integration',
				'target' => '_blank',
			],
		]);

		if ($GLOBALS['egw_info']['user']['apps']['admin'])
		{
			$file = Array(
				'Site Configuration' => Api\Egw::link('/index.php','menuaction=admin.admin_config.index&appname=' . self::APPNAME.'&ajax=true'),
				'Install Information' => Api\Egw::link('/index.php', ['menuaction' => self::APPNAME.'.'.Ui::class.'.install', 'ajax' => 'true']),
			);
			if ($data['location'] == 'admin')
			{
				display_section(self::APPNAME,$file);
			}
			else
			{
				$file += array('Administration Panel' => 'javascript:app.rocketchat.administration();');
				display_sidebox(self::APPNAME,lang('Admin'),$file);
			}
		}
	}

	/**
	 * Settings for preferences
	 *
	 * @return array with settings
	 */
	static function settings()
	{
		$settings = [
			'notification' => array(
				'type'   => 'select',
				'label'  => 'Enable browser notification',
				'name'   => 'notification',
				'values' => [1 => lang('enabled'), 0 => lang('disabled')],
				'help'   => 'Enable/disable browser notification for unread messages',
				'xmlrpc' => True,
				'admin'  => False,
				'default'=> 1,
			)
		];

		return $settings;
	}

	/**
	 * Hook called by link-class
	 *
	 * @param array/string $location location and other parameters (not used)
	 * @return array with method-names
	 */
	static function search_link($location)
	{
		unset($location);	// not used, but required by function signature

		$links = array(
			'view' => array(
				'menuaction' => 'rocketchat.\\EGroupware\\Rocketchat\\Ui.chat',
				'width' => 500,
				'height' => 450
 			)
		);
		return $links;
	}

	/**
	 * get authToken
	 */
	public static function ajax_getAuthToken ()
	{
		$response = Api\Json\Response::get();
		$auth = Api\Cache::getSession(self::APPNAME, Restapi::AUTH_SESSION);
		$response->data(['token' => $auth['authToken']]);
	}

	/**
	 * Get server url
	 */
	public static function ajax_getServerUrl ()
	{
		$response = Api\Json\Response::get();
		$response->data(['server_url' => self::getSiteUrl()]);
	}

	/**
	 * get server_url from configs
	 * @return type
	 */
	public static function getSiteUrl ()
	{
		$config = Api\Config::read('rocketchat');
		// deal with just /rocketchat/ --> http(s)://domain.com/rocketchat/
		return !empty($config['server_url']) ?
			(substr($config['server_url'], -1) == '/' ? Api\Framework::getUrl($config['server_url']) :
			Api\Framework::getUrl($config['server_url']).'/') : null;
	}

	/**
	 * Get status
	 * @param array $data info regarding the running hook
	 *
	 * @return array return an array consist of online rocket chat users + their status
	 *
	 * @todo implementation
	 */
	public static function getStatus ($data)
	{
		if ($data['app'] != self::APPNAME) return [];
		$stat = [];
		try{
			$api = new Restapi();
			$logged_in = Api\Cache::getSession(self::APPNAME, 'logged_in', function() use ($api)
			{
				try {
					// Rocket.Chat is not configured --> bail out quitely
					if (empty($api->config['server_url']))
					{
						return false;
					}
					// check if Rocket.Chat instance is running / not powered off
					$info = $api->info();
					if (!empty($info['powered']) && $info['powered'] === 'off')
					{
						return false;	// if powered off --> noone is online, no need to power on now
					}
					$api->login($GLOBALS['egw_info']['user']['account_lid'], base64_decode(Api\Cache::getSession('phpgwapi', 'password')));
					return true;
				}
				catch (\Exception $ex) {
					Api\Framework::message($ex->getMessage());
					// it's important to return nothing here as false will block login attempt even though the server is
					// back from failure and running normal.
					return;
				}
			});
			if ($logged_in && ($onlineusers = $api->userslist(['query' => [
				'active'=>true,
				'type' => 'user'
			]])))
			{
				$status_app = \EGroupware\Status\Hooks::getStatus(['app'=>'status']);
				$rooms = $api->roomslist();
				foreach ($rooms as $r)
				{
					if ($r['t'] == 'p' || $r['t'] == 'c')
					{
						array_push($onlineusers, [
							'username' => $r['name'],
							'name' => $r['name'],
							'status' => 'room',
							'active' => true,
							'type' => $r['t'],
							'icon' => "avatar/@".$r["name"]
						]);
					}
				}

				foreach ($onlineusers as $user)
				{
					// Only report egw users not all rocketchat users
					if (!$status_app[$user['username']])
					{
						if ($user['username'] == $GLOBALS['egw_info']['user']['account_lid']) continue;
						$link = array_values(Api\Link::get_links(self::APPNAME,self::APPNAME.Status\Ui::ID_DELIMITER.$user['username']));
						$stat[$user['username']] = [
							'account_id' => self::APPNAME.Status\Ui::ID_DELIMITER.$user['username'],
							'id' => $user['username'],
							'stat' => [
								'rocketchat' => [
									'active' => $user['active'],
									'class' => ($user['status'] ? $user['status'] : 'offline'),
									'type' => $user['type'],
									'_id' => $user['_id']
								]
							],
							'hint' => $user['name'],
							'icon' => self::getSiteUrl().($user['icon'] ? $user['icon'] : 'api/v1/users.getAvatar?userId='.$user['_id']),
							'link_to' => $link[0],
							'class' => ($link[0]? ' linked' : ' unlinked')
						];
						//Add status state for groups and channels
						if (in_array($user['type'], array('c', 'p')))
						{
							$stat[$user['username']]['stat']['status']['active'] = $user['active'];
						}
					}
					else
					{
						$stat[$user['username']] = [
							'id' => $user['username'],
							'stat' => [
								'rocketchat' => [
									'active' => $user['active'],
									'class' => $user['status'] ? $user['status'] : 'offline',
									'type' => 'u',
									'_id' => $user['_id']
								]
							]
						];
					}
				}
			}
			return $stat;
		} catch (Exception\LoginFailure $ex) {
			Api\Framework::message($ex->getMessage());
		}
		return [];
	}

	/**
	 * Actions to show on status app
	 * @return array
	 */
	public static function get_status_actions()
	{
		return [
			'message' => [
				'caption' => 'Message',
				'icon' => 'rocketchat/navbar',
				'allowOnMultiple' => false,
				'onExecute' => 'javaScript:app.rocketchat.handle_actions',
				'enabled' => 'javaScript:app.rocketchat.isRCActive',
				'group' => 1,
			],
			'linkto' => [
				'caption' => 'Link to contact',
				'allowOnMultiple' => false,
				'icon' => 'link',
				'enableClass' => 'unlinked',
				'hideOnDisabled' => true,
				'onExecute' => 'javaScript:app.rocketchat.handle_actions',
				'group' => 1,
			],
			'unlinkto' => [
				'caption' => 'Unlink from contact',
				'allowOnMultiple' => false,
				'hideOnDisabled' => true,
				'enableClass' => 'linked',
				'onExecute' => 'javaScript:app.rocketchat.handle_actions',
				'group' => 1,
			]
		];
	}

	/**
	 * Check server url
	 *
	 * @param Array $data
	 * @return array with (changed) data
	 */
	public static function config($data)
	{
		// do we have an unconfigured Rocket.Chat --> try default url
		if (($unconfigured = empty($data['server_url'])))
		{
			// allow user to store empty url to unconfigure Rocket.Chat
			if ($data['initial-call'] === false)
			{
				Api\Framework::message(lang('Rocket.Chat container or egroupware-rocketchat package needs to be installed to use Rocket.Chat!'), 'info');
				return $data;
			}
			$data['server_url'] = Api\Framework::getUrl('/rocketchat/');
		}

		try
		{
			$api = new Restapi([
				'api_path' => $data['server_url'].Restapi::API_URL,
				'server_url' => $data['server_url']
			]);
			$info = $api->info();
			if (empty($info) || !$info['success'])
			{
				$data['server_status_class'] = 'error';
				$data['server_status'] = lang('Unable to connect!');
			}
			elseif (Api\Header\Http::schema() === 'https' && substr($data['server_url'], 0, 7) === 'http://')
			{
				$data['server_status_class'] = 'error';
				$data['server_status'] = lang('You can NOT use http for Rocket.Chat with EGroupware using https! Browser do not load mixed content.');
			}
			else
			{
				$data['server_status_class'] = 'ok';
				$data['server_status'] = lang('Successful connected, Rocket.Chat version: %1.', $info['response']['info']['version']);
			}
		}
		catch (\Exception $e)
		{
			$data['server_status'] = $e->getMessage();
			$data['server_status_class'] = 'error';
		}
		if ($unconfigured)
		{
			if ($data['server_status_class'] === 'error')
			{
				Api\Framework::message(lang('Rocket.Chat container or egroupware-rocketchat package needs to be installed to use Rocket.Chat!'), 'info');
			}
			else
			{
				Api\Framework::message(lang('Connection with default URL succeeded. You need to complete AND store the configuration now.'), 'info');
			}
		}
		return $data;
	}

	/**
	 * Validate the configuration
	 *
	 * @param Array $data
	 * @return string|null string with error or null on success
	 */
	public static function validate($data)
	{
		if (empty($data['server_url'])) return null;

		// check if we have a trailing slash
		if (substr($data['server_url'], -1) !== '/')
		{
			$error = lang('URL must end with %1', '/');
			Api\Etemplate::set_validation_error('server_url', $error, 'newsettings');
			$GLOBALS['config_error'] = $error;
			return;
		}

		try {
			$api = new Restapi([
				'api_path' => $data['server_url'].Restapi::API_URL,
				'server_url' => $data['server_url']
			]);
			$info = $api->info();
			if (empty($info) || !$info['success'])
			{
				$error = lang('Unable to connect!');
			}
			elseif (Api\Header\Http::schema() === 'https' && substr($data['server_url'], 0, 7) === 'http://')
			{
				$error = lang('You can NOT use http for Rocket.Chat with EGroupware using https! Browser do not load mixed content.');
			}
		}
		catch (\Exception $ex) {
			$error = $ex->getMessage();
		}
		if (!empty($error))
		{
			return $GLOBALS['config_error'] = $error;
		}
	}

	/**
	 * Hook called after successful save of site-config --> redirect to rocketchat app
	 *
	 * @param array $_content
	 */
	public function config_after_save(array $_content)
	{
		// if url has been successful saved --> redirect to rocketchat app
		// we force a full redirect on client-side to fix evtl. necessary CSP
		if (!empty($_content['newsettings']['server_url']))
		{
			Api\Json\Response::get()->redirect(Api\Framework::link('/index.php',
				'menuaction='.$GLOBALS['egw_info']['apps']['rocketchat']['index'], 'rocketchat'), true);
		}
	}

	/**
	 * get authenticated user info and set avatar stat
	 * @return array
	 */
	public static function avatar_stat()
	{
		try{
			if (empty(self::getSiteUrl())) throw new \Exception('Rocketchat is not configured!');
			$api = new Restapi();
			// check if Rocket.Chat instance is running / not powered off
			$info = $api->info();
			if (!empty($info['powered']) && $info['powered'] === 'off')
			{
				// if powered off --> noone is online, no need to power on now
				return [
					'class' => 'stat1 offline',
					'title' => lang('Offline'),
					'body'  => '',
				];
			}
			$logged_in = Api\Cache::getSession(self::APPNAME, 'logged_in', function() use ($api)
			{
				try {
					$api->login($GLOBALS['egw_info']['user']['account_lid'], base64_decode(Api\Cache::getSession('phpgwapi', 'password')));
					return true;
				}
				catch (\Exception $ex) {
					Api\Framework::message($ex->getMessage());
					// it's important to return nothing here as false will block login attempt even though the server is
					// back from failure and running normal.
					return;
				}
			});
			if ($logged_in)
			{
				if(($response = $api->me()) && $response['success']);
				{
					$response['statusDefault'] = $response['statusDefault'] ?  $response['statusDefault'] : $response['status'];
				}
			}
			$status = !$response['statusDefault'] ? 'noconnection' :  $response['statusDefault'];
			switch ($status)
			{
				case 'error':
				case 'noconnection':
					$title = lang("Connection error to Rocket.Chat server!");
					break;
				default:
					$title = $response['statusText'] != "" ? $response['statusText'] : lang($status);
			}
			return [
				'class' => $response['statusDefault'] != 'error' ? 'stat1 '.$status : 'noconnection',
				'title' =>  lang($title),
				'body' => ''
			];
		} catch (\Exception $ex) {
			error_log(__METHOD__.'()'.$ex->getMessage());
		}
		return [];
	}

	/**
	 * Get none EGW rocketchat users
	 *
	 * @param type $data
	 * @return array
	 */
	public static function getSearchParticipants($data)
	{
		if ($data['app'] != self::APPNAME) return [];
		$api = new Restapi();
		$result = [];
		$logged_in = Api\Cache::getSession(self::APPNAME, 'logged_in', function() use ($api)
		{
			try {
				$api->login($GLOBALS['egw_info']['user']['account_lid'], '');
				return true;
			}
			catch (\Exception $ex) {
				Api\Framework::message($ex->getMessage());
				// it's important to return nothing here as false will block login attempt even though the server is
				// back from failure and running normal.
				return;
			}
		});
		if ($logged_in)
		{
			$users = $api->userslist(['query' => [
				'active'=>true,
				'type' => 'user'
			]]);
			$status_users = array_column(Status\Hooks::getUsers(), 'account_lid');

			$rooms = $api->roomslist();
			foreach ($rooms as $r)
			{
				if ($r['t'] == 'p' || $r['t'] == 'c')
				{
					array_push($users, [
						'username' => $r['name'],
						'name' => $r['name'],
						'status' => 'room',
						'active' => true,
						'type' => $r['t'],
						'icon' => "avatar/@".$r["name"]
					]);
				}
			}

			foreach($users as $user)
			{
				if (!in_array($user['username'], $status_users))
				{
					$result[] = [
						'id' => self::APPNAME.Status\Ui::ID_DELIMITER.$user['username'],
						'label' => $user['name'],
						'icon' => self::getSiteUrl().'api/v1/users.getAvatar?userId='.$user['_id']
					];
				}
			}
		}
		return $result;
	}

}