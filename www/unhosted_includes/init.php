<?php

$unhostedIncludes = dirname(__FILE__);

if(!file_exists($unhostedIncludes . '/settings.php')) {
	die('Please create ' . $unhostedIncludes . ' before proceding.');
}

require_once($unhostedIncludes . '/settings.php');