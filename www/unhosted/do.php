<?php
require_once 'unhosted.php';

$unhostedAccount = new UnhostedAccount($_GET["userAddress"], $_GET["pwd"]);
switch($_GET["action"]) {
	case "get_wallet": echo $unhostedAccount->getWallet($_GET["scope"]);break;
	case "register_local": echo $unhostedAccount->registerHosted();break;
	case "register_wallet": echo $unhostedAccount->registerWallet($_GET["davBaseUrl"], $_GET["davToken"]); break;
	case "add_app": echo $unhostedAccount->addApp($_GET["scope"]);break;
}
