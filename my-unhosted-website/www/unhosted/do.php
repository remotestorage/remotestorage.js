<?php
require_once 'unhosted.php';
function getString($paramName) {
        if(!isset($_GET[$paramName])) {
                die("Parameter $paramName not specified");
        }
        return $_GET[$paramName];
}
function getDomain($paramName) {
        $domain = getString($paramName);
        if(!preg_match('|^[a-z0-9-]+(\.[a-z0-9-]+)*$|i', $domain)) {
                die("Parameter $paramName should be a valid domain");
        }
	return $domain;
}
function getUserAddress($paramName) {
        $userAddress = getString($paramName);
        if(!preg_match('|^[a-z0-9-]+(\.[a-z0-9-]+)*@[a-z0-9-]+(\.[a-z0-9-]+)*$|i', $userAddress)) {
                die("Parameter $paramName should be a valid user address");
        }
	return $userAddress;
}

$unhostedAccount = new UnhostedAccount(getUserAddress("userAddress"), getString("pwd"));

switch(getString("action")) {
        case "getWallet":
                echo $unhostedAccount->getWallet(getDomain("dataScope"), getString("pwd"), getString("allowCreation"));
                break;
        case "registerLocal":
                echo $unhostedAccount->registerLocal();
                break;
        case "addApp":
                echo $unhostedAccount->addApp(getDomain("dataScope"));
                break;
}

