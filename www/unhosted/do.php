<?php
require_once 'unhosted.php';

$unhostedAccount = new UnhostedAccount($_GET["user_address"], $_GET["pwd"]);
switch($_GET["action"]) {
	case "register_hosted": echo $unhostedAccount->registerHosted();break;
	case "register_wallet": echo $unhostedAccount->registerWallet($_GET["dav_base_url"], $_GET["dav_token"]); break;
	case "add_app": echo $unhostedAccount->addApp($_GET["scope"]);break;
	case "get_wallet": echo $unhostedAccount->getWallet($_GET["scope"]);break;
}
