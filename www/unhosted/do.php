<?php
require_once 'unhosted.php';
$unhostedAccount = new UnhostedAccount($_GET["userAddress"], $_GET["pwd"]);
switch($_GET["action"]) {
	case "getWallet": echo $unhostedAccount->getWallet($_GET["dataScope"]);break;
	case "registerLocal": echo $unhostedAccount->registerHosted();break;
	case "registerWallet": echo $unhostedAccount->registerWallet($_GET["davBaseUrl"], $_GET["davToken"]); break;
	case "addApp": echo $unhostedAccount->addApp($_GET["dataScope"]);break;
}
