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
			$frm_srcs[] = $config['server_url'];
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
}