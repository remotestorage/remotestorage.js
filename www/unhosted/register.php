<?php

require_once('unhosted.php');

function createUser($userName, $pwd) {
	$userDir = UnhostedSettings::davDir . UnhostedSettings::domain . '/' . strtolower();
	if(is_dir($userDir)) {
		$errorMsg = "user name taken";
	} else {//create the user
		mkdir($userDir);
		file_put_contents($userDir."/.htpasswd", sha1($pwd));
		$showForm = false;
		//install local app:
		$token = createScope($userName, UnhostedSettings::domain, UnhostedSettings::domain);
		$davAuth = base64_encode($userName.':'.$token);
		return json_encode(array(
			"userName" => $userName . '@' . UnhostedSettings::domain,
			"davBaseUrl" => UnhostedSettings::domain,
			"davAuth" => $davAuth,
			"cryptoPwd" => null
			), true);		
	}
}

$showForm = true;
$errorMsg="";
if($_POST["user_name"]) {
	if($_POST["pwd"] && ($_POST["pwd"] == $_POST["pwd2"])) {
		if(!ctype_alnum($_POST["user_name"])) {
			$errorMsg = "please use only alphanumeric characters in your username";
		} else {
			echo(createUser($_POST["user_name"], $_POST["pwd"]));
			exit();
		}
	} else {
		$errorMsg="please enter the same password twice";
	}
}
