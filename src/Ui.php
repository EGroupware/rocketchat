<?php
/**
 * Ui for Rocketchat app
 *
 * @link http://www.egroupware.org
 * @author Hadi Nategh <hn-At-egroupware.org>
 * @package Rocketchat
 * @copyright (c) 2019 by Hadi Nategh <hn-At-egroupware.org>
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 */

namespace EGroupware\Rocketchat;

use EGroupware\Api;
use EGroupware\Api\Etemplate;
use EGroupware\Rocketchat\Api\Restapi;

/**
 * Description of Ui
 *
 * @author hadi
 */
class Ui
{
	const APPNAME = 'rocketchat';

	/**
	 * Public functions
	 * @var array
	 */
	public $public_functions = array (
		'index' => true,
		'chat' => true,
		'install' => true,
	);

	/**
	 * site-configs
	 * @var array
	 */
	var $config = array();

	function __construct()
	{
		$this->config = Api\Config::read('rocketchat');
	}

	/**
	 * Check if Rocket.Chat app is configured:
	 * 1. non-admin: tell admin needs to configure it first
	 * 2. admin:
	 * a) regular install without rocket.chat
	 * --> redirect admin to Rocket.Chat siteconfig
	 * b) hosting or egroupware_rocketchat container
	 * -->
	 *
	 * @param type $popup
	 */
	protected function check_configured($popup = false)
	{
		// Rocket.Chat not set up yet
		if (empty($this->config['server_url']) || $this->config['server_url'] === '/rocketchat/')
		{
			// regular user without admin rights
			if (empty($GLOBALS['egw_info']['user']['apps']['admin']))
			{
				$msg = lang('Sorry, Rocket.Chat app needs to be configured by an EGroupware administrator!');
				if (!$popup)
				{
					$reponse = Api\Json\Response::get();
					$reponse->call('app.rocketchat.close_app', $msg);
					exit;
				}
				else
				{
					Api\Framework::window_close($msg);
				}
			}
			if (isset($_GET['clear-cache']))
			{
				Api\Cache::unsetInstance(Api\Config::class, 'configs');
				Api\Config::init_static();
				$this->config = Api\Config::read('rocketchat');
				return true;
			}
			// admin and no app or hosting
			if (empty($this->config['server_url']))
			{
				$msg = lang('Sorry, Rocket.Chat app needs to be configured first!');
				$reponse = Api\Json\Response::get();
				$reponse->call('app.rocketchat.close_app', $msg);
				Api\Framework::redirect_link('/index.php', 'menuaction=admin.admin_config.index&appname=' . self::APPNAME.'&ajax=true', 'admin');
			}
			// admin and hosting or package
			if ($popup)
			{
				Api\Framework::index(self::APPNAME);
				Api\Framework::window_close(lang('Sorry, Rocket.Chat app needs to be configured first!'));
			}
			$tpl = new Api\Etemplate('rocketchat.install');
			$tpl->exec(self::APPNAME.'.'.self::class.'.index', []);
			return false;
		}
		return true;
	}

	/**
	 * Display install instructions without ability to install
	 */
	function install()
	{
		$tpl = new Api\Etemplate('rocketchat.install_info');
		$tpl->exec(self::APPNAME.'.'.self::class.'.install',[]);
	}

	/**
	 * Rocket.Chat index
	 *
	 * @param array $content
	 */
	function index($content = null)
	{
		if (!$this->check_configured(false)) return;

		$tpl = new Etemplate('rocketchat.index');
		$tpl->setElementAttribute('iframe', 'src', Hooks::getSiteUrl());
		$content['authentication'] = $this->config['authentication'];
		$tpl->exec('rocketchat.EGroupware\\Rocketchat\\Ui.index', $content, []);
	}

	function chat($content = null)
	{
		if (!$this->check_configured(true)) return;

		$tpl = new Etemplate('rocketchat.chat');
		$path = $_GET['path'];
		$tpl->setElementAttribute('chatbox', 'src', Hooks::getSiteUrl().$path);
		$content['authentication'] = $this->config['authentication'];
		$tpl->exec('rocketchat.EGroupware\\Rocketchat\\Ui.chat', $content, array());
	}

	/**
	 * restapi call handler
	 *
	 * @param type $_cmd
	 * @param type $_data
	 */
	public static function ajax_restapi_call ($_cmd, $_data)
	{
		$response = Api\Json\Response::get();
		try {
			$restapi = new Restapi();
			$resp = call_user_func_array(array($restapi, $_cmd), [$_data]);
			if ($resp)
			{
				$response->data($resp);
			}
			else
			{
				$response->data(['error' => lang("Rocketchat operation failed!")]);
			}
		}
		catch(Exception $ex) {
			$response->data(['error' => $ex->getMessage()]);
		}
	}
}
