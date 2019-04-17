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

class Hooks {

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
			$frm_srcs[] = preg_replace('#^(https?://[^/]+)(/.*)?#', '$1', $config['server_url']);
		}
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
				'Site Configuration' => Api\Egw::link('/index.php','menuaction=admin.admin_config.index&appname=' . self::APPNAME,'&ajax=true')
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
	 * Method to construct notifications actions
	 *
	 * @param type $params
	 * @return type
	 */
	public static function notifications_actions ($params)
	{

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
					$api->login($GLOBALS['egw_info']['user']['account_email'], $_POST['passwd']);
					return true;
				}
				catch (\Exception $ex) {
					Api\Framework::message($ex->getMessage());
					return false;
				}
			});
			if ($logged_in && ($onlineusers = $api->userslist(['query' => [
				'active'=>true,
				'type' => 'user',
				'status' => 'online'
			]])))
			{
				foreach ($onlineusers as $user)
				{
					$stat[$user['username']] = [
						'id' => $user['username'],
						'stat' => [
							'rocketchat' => [
								'active' => $user['active'],
								'bg' => 'rocketchat/templates/default/images/navbar.svg'
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
			'rocketchat' => [
				'caption' => 'Rocketchat',
				'allowOnMultiple' => false,
				'children' => [
					'message' => [
						'caption' => 'Message',
						'allowOnMultiple' => false,
						'onExecute' => 'javaScript:app.rocketchat.handle_actions',
					]
				]
			]
		];
	}
}