<?php
require_once 'unhosted.php';
function getString($paramName) {
        if(!isset($_GET[$paramName])) {
                die("Parameter $paramName not specified");
        }
        return $_GET[$paramName];
}
function getUrl($paramName) {
        $url = getString($paramName);
        if(!preg_match('|^http(s)?://[a-z0-9-]+(.[a-z0-9-]+)*(:[0-9]+)?(/.*)?$|i', $url)) {
                die("Parameter $paramName should be a valid URL");
        }
	return $url;
}
function getUserAddress($paramName) {
        $userAddress = getString($paramName);
        if(!preg_match('|^[a-z0-9-]+(.[a-z0-9-]+)*@[a-z0-9-]+(.[a-z0-9-]+)*$|i', $userAddress)) {
                die("Parameter $paramName should be a valid user address");
        }
	return $userAddress;
}

$unhostedAccount = new UnhostedAccount(getUserAddress("userAddress"), getString("pwd"));

switch(getString("action")) {
        case "getWallet":
                echo $unhostedAccount->getWallet(getUrl("dataScope"));
                break;
        case "registerLocal":
                echo $unhostedAccount->registerHosted();
                break;
        case "registerWallet":
                echo $unhostedAccount->registerWallet(getUrl("davBaseUrl"), getString("davToken"), getUrl("dataScope"));
                break;
        case "addApp":
                echo $unhostedAccount->addApp(getUrl("dataScope"));
                break;
}

