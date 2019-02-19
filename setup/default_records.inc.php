<?php
/**
 * EGroupware Rocket.Chat - setup
 *
 * @link www.egroupware.org
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 * @author Hadi Nategh <hn@egroupware.org>
 * @copyright (c) 2019 by Hadi Nategh <hn@egroupware.org>
 * @package rocketchat
 */

//use EGroupware\Api;

// give Default and Admins group rights for policy
foreach(array('Default' => 'Default','Admins' => 'Admin') as $account_lid => $name)
{
	$account_id = $GLOBALS['egw_setup']->add_account($account_lid, $name, 'Group', False, False);
	$GLOBALS['egw_setup']->add_acl('rocketchat', 'run', $account_id);
}
