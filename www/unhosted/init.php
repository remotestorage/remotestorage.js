<?php

$unhostedIncludes = dirname(__FILE__);
function checkApacheModule($module)
if(!file_exists($unhostedIncludes . '/settings.php')) {
	$apacheModules = apache_get_modules();
	echo "Welcome to your new unhosted website. This only works on Apache, so if you're on lighttpd or nginx or something else, then please help us port this install script! If you're on apache, then let's continue by checking whether you have the necessary modules installed:<br>";
	foreach(array('dav', 'dav_fs', 'headers') as $module) {
		$missingModules = array();
		if(in_array("mod_$module", $apacheModules)) {
			echo "You have mod_$module installed. OK!<br>";
		} else {
			$missingModules[] = $module;
			echo "You don't seem to have mod_$module installed.<br>";
		}
	}
	if(count($missingModule)) {
		echo "You're missing a few apache modules. So you need to ssh to your server as root, and activate them:<br>";
		foreach($missingModules as $missingModule) {
			echo "a2enmod $missingModule<br>;
		}
		echo "/etc/init.d/apache2 restart"
	}
	echo "make sure .well-known/host-meta loads and has CORS on it."	
	die('Please create ' . $unhostedIncludes . '/settings.php before proceeding.');
}

require_once($unhostedIncludes . '/settings.php');
