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
use EGroupware\Rocketchat\Exception;
use EGroupware\Rocketchat\Api\Restapi;

class Hooks
{
	const APPNAME = 'rocketchat';

	/**
	 * Allow rocketchat host as frame-src
	 *
	 * @return array
	 */
	public static function csp_frame_src()
	{
		$config = Api\Config::read('rocketchat');
		$frm_srcs = array();
		if (!empty($config['server_url']))
		{
			$frm_srcs[] = preg_replace('#^(https?://)?#', (substr($config['server_url'], 0, 5) == 'https' ? 'wss://' : 'ws://'), $config['server_url']). 'websocket';
			$frm_srcs[] = preg_replace('#^(https?://[^/]+)(/.*)?#', '$1', $config['server_url']);
		}
		Api\Header\ContentSecurityPolicy::add_connect_src($frm_srcs);
		return $frm_srcs;
	}

	/**
	 * Runs after framework js are loaded and includes all dependencies
	 *
	 * @param array $data
	 */
	public static function framework_header ($data)
	{
		if(!$data['popup'])
		{
			Api\Framework::includeJS('/rocketchat/js/app.js',null,self::APPNAME);
		}
	}

	public static function session_created($location)
	{

	}

	/**
	 * sidebox
	 */
	public static function sidebox_menu($data)
	{
		if ($GLOBALS['egw_info']['user']['apps']['admin'])
		{
			$file = Array(
				'Site Configuration' => Api\Egw::link('/index.php','menuaction=admin.admin_config.index&appname=' . self::APPNAME.'&ajax=true')
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
		$file = array (
			'My Account' =>  'javascript:app.rocketchat.myaccount();'
		);
		display_sidebox(self::APPNAME, 'My Account', $file);
	}

	/**
	 * Settings for preferences
	 *
	 * @return array with settings
	 */
	static function settings()
	{
		$settings = [
			'audio' => array(
				'type'   => 'select',
				'label'  => 'Enable audio effects',
				'name'   => 'audio effects',
				'values' => [1 => lang('enabled'), 0 => lang('disabled')],
				'help'   => 'Enable/disable audio effects such as message notifications',
				'xmlrpc' => True,
				'admin'  => False,
				'default'=> 1,
			),
			'notification' => array(
				'type'   => 'select',
				'label'  => 'Enable browser notification',
				'name'   => 'notification',
				'values' => [1 => lang('enabled'), 0 => lang('disabled')],
				'help'   => 'Enable/disable browser notification for unread messages',
				'xmlrpc' => True,
				'admin'  => False,
				'default'=> 1,
			),
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
			'add' => array(
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
		$config = Api\Config::read('rocketchat');
		$response->data(['server_url' => $config['server_url']]);
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
					$api->login($GLOBALS['egw_info']['user']['account_lid'], $_POST['passwd']);
					return true;
				}
				catch (\Exception $ex) {
					Api\Framework::message($ex->getMessage());
					return false;
				}
			});
			if ($logged_in && ($onlineusers = $api->userslist(['query' => [
				'active'=>true,
				'type' => 'user'
			]])))
			{
				$status_app = \EGroupware\Status\Hooks::getStatus(['app'=>'status']);
				foreach ($onlineusers as $user)
				{
					// Only report egw users not all rocketchat users
					if (!$status_app[$user['username']]) continue;
					$stat[$user['username']] = [
						'id' => $user['username'],
						'stat' => [
							'rocketchat' => [
								'active' => $user['active'],
								'class' => $user['status'] ? $user['status'] : 'offline'
							]
						]
					];
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
				'default' => true,
				'allowOnMultiple' => false,
				'onExecute' => 'javaScript:app.rocketchat.handle_actions',
			]
		];
	}

	/**
	 * Check server url
	 *
	 * @param Array $data
	 */
	public static function config($data)
	{
		try
		{
			$api = new Restapi([
				'api_path' => $data['server_url'].Restapi::API_URL,
			]);
			$info = $api->info();
			if (empty($info) || !$info['success'])
			{
				$data['server_status_class'] = 'error';
				$data['server_status'] = lang('Unable to connect!');
			}
			else
			{
				$data['server_status_class'] = 'ok';
				$data['server_status'] = lang('Successful connected, Rocket.Chat version: %1.', $info['info']['version']);
			}
		}
		catch (\Exception $e)
		{
			$data['server_status'] = $e->getMessage();
			$data['server_status_class'] = 'error';
		}
		return $data;
	}

	/**
	 * Validate the configuration
	 *
	 * @param Array $data
	 */
	public static function validate($data)
	{
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
			]);
			$info = $api->info();
			if (empty($info) || !$info['success'])
			{
				$error = lang('Unable to connect!');
			}
		}
		catch (\Exception $ex) {
			$error = $ex->getMessage();
		}
		if (!empty($error))
		{
			Api\Etemplate::set_validation_error('server_url', $error, 'newsettings');
			$GLOBALS['config_error'] = $error;
		}
	}

	/**
	 * get authenticated user info and set avatar stat
	 * @return array
	 */
	public static function avatar_stat()
	{
		try{
			$api = new Restapi();
			$logged_in = Api\Cache::getSession(self::APPNAME, 'logged_in', function() use ($api)
			{
				try {
					$api->login($GLOBALS['egw_info']['user']['account_lid'], $_POST['passwd']);
					return true;
				}
				catch (\Exception $ex) {
					Api\Framework::message($ex->getMessage());
					return false;
				}
			});
			if ($logged_in)
			{
				$response = $api->me();
				$response['statusDefault'] = $response['statusDefault'] ?  $response['statusDefault'] : $response['status'];
			}
			return [
				'class' => $response['statusDefault'] != 'error' ? 'stat1 '.$response['statusDefault']: '',
				'body' => ''
			];
		} catch (\Exception $ex) {
			error_log(__METHOD__.'()'.$ex->getMessage());
		}
		return [];
	}
}