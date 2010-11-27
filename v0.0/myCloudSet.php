<?php
var_dump($_POST);
//main:
require_once 'PubSign.php';
require_once 'UnhostedStorage.php';

function dispatch() {
	$pubSign = new PubSign();
	$backend= new UnhostedStorage();
	return $pubSign->parsePost($_POST, $backend);
}

ini_set('display_errors', TRUE);
$result = dispatch();
echo "$result<br>";
while ($msg = openssl_error_string()) {
    echo $msg . "<br>\n";
}

