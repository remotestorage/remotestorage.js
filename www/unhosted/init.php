<?php

$unhostedIncludes = dirname(__FILE__);

if(!file_exists($unhostedIncludes . '/settings.php')) {
	die('Please create ' . $unhostedIncludes . '/settings.php before proceeding.');
}

require_once($unhostedIncludes . '/settings.php');
