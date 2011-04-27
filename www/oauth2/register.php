<?php

require_once('unhosted_includes/init.php');

$showForm = true;
$errorMsg="";
if($_POST["user_name"]) {
	if($_POST["pwd"] && ($_POST["pwd"] == $_POST["pwd2"])) {
		if(!ctype_alnum($_POST["user_name"])) {
			$errorMsg = "please use only alphanumeric characters in your username";
		} else {
			$userDir = UnhostedSettings::davDir . UnhostedSettings::domain . '/' . strtolower($_POST["user_name"]);
			if(is_dir($userDir)) {
				$errorMsg = "user name taken";
			} else {//create the user
				mkdir($userDir);
				file_put_contents($userDir."/.htpasswd", sha1($_POST["pwd"]));
				$showForm = false;
			}
		}
	} else {
		$errorMsg="please enter the same password twice";
	}
}

$userName = '';
if(isset($_GET['user_name'])) {
	$userNameParts = explode('@', $_GET['user_name']);
	if((count($userNameParts) != 2) || ($userNameParts[1] != UnhostedSettings::domain)) {
		$errorMsg = 'Requested username '.$_GET['user_name'].' does not follow format <user>@' . UnhostedSettings::domain . ', please retry.';
	} else {
		$userName = $userNameParts[0];
	}
}
if($showForm) {
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta http-equiv="content-type" content="text/html; charset=utf-8" />

<script src="html5.js"></script><!-- this is the javascript allowing html5 to run in older browsers -->

<title>My Unhosted node</title>
<link rel="stylesheet" href="css/uncompressed/reset.css" />
<link rel="stylesheet" href="css/uncompressed/text.css" />
<link rel="stylesheet" href="general.css" />
<link rel="stylesheet" href="css/uncompressed/login.css" />
</head>
	<header>
		<h1><strong><?=UnhostedSettings::domain?> </strong>Unhosted storage node</h1>
	</header>
	<body>

	<H2>Welcome developer of unhosted web apps!</H2>
	You can register here for a free test account, so you can quickly test and debug your unhosted web app.
	<H3><strong><?= $errorMsg ?></strong></H3>
	<form method="POST" target="?">
	<table>
	<tr><td align="right">Nick:</td><td align="left">
		<input name="user_name" type="text" value="<?= $userName ?>">@<?=UnhostedSettings::domain?></td></tr>
	<tr><td align="right">Password:</td><td align="left">
		<input name="pwd" type="password"></td></tr>
	<tr><td align="right">Repeat:</td><td align="left">
		<input name="pwd2" type="password"></td></tr>
	<tr><td></td><td align="left">
	<input type="submit">
	<input type="hidden" name="redirect_url" value="<?=(isset($_GET['redirect_url'])?$_GET['redirect_url']:'')?>">
	<input type="hidden" name="scope" value="<?=(isset($_GET['scope'])?$_GET['scope']:'')?>">
	</td></tr>
	</table>
	</form>

<?php
} else if((isset($_POST['redirect_url'])) && (strlen($_POST['redirect_url']))) { 
	if((isset($_POST['scope'])) && (strlen($_POST['scope']))) {//have all the info to oauth you directly, so do that: 
		$userName = $_POST['user_name'];
		$userDomain = UnhostedSettings::domain;
		$token = base64_encode(mt_rand());
		$davDir = UnhostedSettings::davDir . "$userDomain/$userName/".$_POST["scope"];

		if(!file_exists($davDir)) {
			mkdir($davDir);
		}

		$htaccessContent = '<LimitExcept OPTIONS HEAD GET>
  AuthType Basic
  AuthName "http://unhosted.org/spec/dav/0.1"
  Require valid-user
  AuthUserFile /var/www/tabulatabs.com/dav/tabulatabs.com/343max/tabulatabs.com/.htpasswd
</LimitExcept>';

		file_put_contents($davDir . '/.htaccess', $htaccessContent);

		`htpasswd -bc $davDir/.htpasswd $userName $token`;
		header('Location:'.$_POST['redirect_uri'].'?token='.$token.'&user_name='.$userName.'@'.$userDomain);//giving the token and user name back this way is not part of the Unhosted WebDAV spec
		echo "redirecting you back to the application, already logged in.\n";
	} else { //redirect you back to the app so you can log in:
		header("Location:".$_POST["redirect_uri"].'?user_name='.$userName.'@'.$userDomain);//giving the user name back this way is not part of the Unhosted WebDAV spec
		echo "redirecting you back to the application, so you can log in.\n";
	}
} else {
?>
	<H2>Thank you!</H2>
	You now have an unhosted account at <?=$_POST["user_name"]?>@<?=UnhostedSettings::domain?>. <a onclick="window.location='<?=$_GET["redirect_url"]?>';">Click here to return to the app you were logging into.</a>

<?php
}
?>

	</body>
</html>
