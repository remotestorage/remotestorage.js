<?php
$pri =  openssl_pkey_new();
$keyDetails = openssl_pkey_get_details($pri);
$pub = $keyDetails['key'];
$pubser = str_replace(array('/','+'), array('_','-'), substr($pub, 27, 64).substr($pub, 92, 64).substr($pub, 157, 64).substr($pub, 222, 24));

$cmd = json_encode(array(
	'method' => 'SET',
	'key' => "hello+$pubser@demo.unhosted.org/path",
	'value' => 'DEADBEEF',
	));

openssl_sign($cmd, $sign, $pri);
$PubSign = base64_encode($sign);

$_POST=array(
	'protocol' => 'UJ/0.1',
	'cmd' => $cmd,
	'PubSign' => $PubSign,
	);
$_SERVER=array('HTTP_REFERER'=>'hello');

require_once 'unhosted.php';
