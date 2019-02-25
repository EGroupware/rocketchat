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

/**
 * Description of Ui
 *
 * @author hadi
 */
class Ui {

	/**
	 * Public functions
	 * @var array
	 */
	public $public_functions = array (
		'index' => true,
		'chat' => true
	);

	/**
	 * site-configs
	 * @var array
	 */
	var $config = array();

	function __construct() {
		$this->config = Api\Config::read('rocketchat');
	}

	/**
	 * Rocket.Chat index
	 *
	 * @param array $content
	 */
	function index($content = null)
	{
		$tpl = new Api\Etemplate('rocketchat.index');
		$tpl->setElementAttribute('iframe', 'src', $this->config['server_url']);
		$tpl->exec('rocketchat.EGroupware\\Rocketchat\\Ui.index', array(), array());
	}

	function chat($content = null)
	{
		$tpl = new Api\Etemplate('rocketchat.chat');
		$path = $_GET['path'];
		$tpl->setElementAttribute('chatbox', 'src', $this->config['server_url'].$path);
		$tpl->exec('rocketchat.EGroupware\\Rocketchat\\Ui.chat', array(), array());
	}
}
