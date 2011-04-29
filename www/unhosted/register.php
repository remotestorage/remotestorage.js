<?php

require_once('unhosted.php');

function createUser($userName, $userDomain, $pwd) {
	$userDir = UnhostedSettings::davDir . $userDomain . '/' . strtolower($userName);
	if(is_dir($userDir)) {
		echo "user name taken";
	} else {//create the user
		mkdir($userDir);
		file_put_contents($userDir."/.htpasswd", sha1($pwd));
		$showForm = false;
		//install local app:
		$token = registerScope($userName, $userDomain, UnhostedSettings::domain);
		$davAuth = base64_encode($userName . '@' . $userDomain . ':' . $token);
		return json_encode(array(
			"userName" => $userName . '@' . $userDomain,
			"davBaseUrl" => UnhostedSettings::domain,
			"davAuth" => $davAuth,
			"cryptoPwd" => null
			));
	}
}

if($_GET["userAddress"]) {
	list($userName, $userDomain) = explode("@", $_GET["userAddress"]);
	echo(createUser($userName, $userDomain, $_GET["pwd"]));
}
