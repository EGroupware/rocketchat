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
	 * Admin sidebox
	 */
	public static function admin_sidebox($data)
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