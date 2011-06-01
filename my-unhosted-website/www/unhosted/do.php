<?php
require_once 'unhosted.php';
function getString($paramName) {
        if(!isset($_POST[$paramName])) {
                die("Parameter $paramName not specified");
        }
        return strtolower($_POST[$paramName]);
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
        case "getwallet":
                $wallet = $unhostedAccount->getWallet(getDomain("dataScope"), getString("allowCreation")=="true");
                if($wallet === false) {	
			header("HTTP/1.0 404 Not Found");
		} else {
			echo $wallet;
		}
		break;
        case "registerlocal":
                echo $unhostedAccount->registerLocal(getDomain("dataScope"));
                break;
        case "addapp":
                echo $unhostedAccount->addApp(getDomain("dataScope"));
                break;
}

