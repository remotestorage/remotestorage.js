<?php
$_POST=array(
	'protocol' => 'UJ/0.1',
	'cmd' => json_encode(array(
		'method' => 'GET',
		'key' => 'hello+pub@demo.unhosted.org/path',
		)),
	);
$_SERVER=array('HTTP_REFERER'=>'hello');

require_once 'unhosted.php';
