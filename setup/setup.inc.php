<?php
/**
 * EGroupware Rocketchat - setup
 *
 * @link http://www.egroupware.org
 * @author Hadi Nategh <hn-At-egroupware.org>
 * @package rocketchat
 * @copyright (c) 2019 by Hadi Nategh <hn-At-egroupware.org>
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 */


$setup_info['rocketchat']['name']    = 'rocketchat';
$setup_info['rocketchat']['title']   = 'Rocket.Chat';
$setup_info['rocketchat']['version'] = '23.1';
$setup_info['rocketchat']['app_order'] = 7;
$setup_info['rocketchat']['enable']  = 1;
$setup_info['rocketchat']['autoinstall'] = true;	// install automatically on update
$setup_info['rocketchat']['index'] = 'rocketchat.EGroupware\\Rocketchat\\Ui.index&ajax=true';
$setup_info['rocketchat']['author'] = 'Hadi Nategh';
$setup_info['rocketchat']['maintainer'] = array(
	'name'  => 'EGroupware GmbH',
	'url'   => 'http://www.egroupware.org',
);
$setup_info['rocketchat']['license']  = 'GPL';
$setup_info['rocketchat']['description'] = 'Rocket.Chat client';

/* The hooks this app includes, needed for hooks registration */
$setup_info['rocketchat']['hooks']['settings'] = 'EGroupware\Rocketchat\Hooks::settings';
$setup_info['rocketchat']['hooks']['admin'] = 'EGroupware\Rocketchat\Hooks::sidebox_menu';
$setup_info['rocketchat']['hooks']['sidebox_menu'] = 'EGroupware\Rocketchat\Hooks::sidebox_menu';
$setup_info['rocketchat']['hooks']['framework_header'] = 'EGroupware\Rocketchat\Hooks::framework_header';
$setup_info['rocketchat']['hooks']['csp-frame-src'] = 'EGroupware\Rocketchat\Hooks::csp_frame_src';
$setup_info['rocketchat']['hooks']['csp-connect-src'] = 'EGroupware\Rocketchat\Hooks::csp_frame_src';
$setup_info['rocketchat']['hooks']['notifications_actions'] = 'EGroupware\Rocketchat\Hooks::notifications_actions';
$setup_info['rocketchat']['hooks']['search_link'] = 'EGroupware\Rocketchat\Hooks::search_link';
$setup_info['rocketchat']['hooks']['status-getStatus'] = 'EGroupware\Rocketchat\Hooks::getStatus';
$setup_info['rocketchat']['hooks']['status-get_actions'] = 'EGroupware\Rocketchat\Hooks::get_status_actions';
$setup_info['rocketchat']['hooks']['config'] = 'EGroupware\Rocketchat\Hooks::config';
$setup_info['rocketchat']['hooks']['config_validate'] = 'EGroupware\Rocketchat\Hooks::validate';
$setup_info['rocketchat']['hooks']['config_after_save'] = 'EGroupware\Rocketchat\Hooks::config_after_save';
$setup_info['rocketchat']['hooks']['framework_avatar_stat'] = 'EGroupware\Rocketchat\Hooks::avatar_stat';
$setup_info['rocketchat']['hooks']['status-getSearchParticipants'] = 'EGroupware\Rocketchat\Hooks::getSearchParticipants';

/* Dependencies for this app to work */
$setup_info['rocketchat']['depends'][] = array(
	'appname' => 'api',
	'versions' => array('23.1')
);