<?php
require_once('../../unhosted/unhosted.php');

function getString($paramName) {
        if(!isset($_POST[$paramName])) {
                die("Parameter $paramName not specified");
        }
        return $_POST[$paramName];
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
                die("Parameter $paramName is '$userAddress' but should be a valid user address");
        }
	return $userAddress;
}


if(count($_POST)) {
	$unhostedAccount = new UnhostedAccount(getUserAddress("user_address"), getString("pwd"));
	$token = $unhostedAccount->addAPP(getDomain("scope"));
	if($token) {
		header("Location:".$_POST["redirect_uri"]."?token=".$token);
		echo "redirecting you back to the application.\n";
	} else {
		echo "Wrong password!";
	}
} else {
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta http-equiv="content-type" content="text/html; charset=utf-8" />

<script src="/html5.js"></script><!-- this is the javascript allowing html5 to run in older browsers -->

<title>My Unhosted node</title>
<link rel="stylesheet" href="/css/uncompressed/reset.css" />
<link rel="stylesheet" href="/css/uncompressed/text.css" />
<link rel="stylesheet" href="/general.css" />
<link rel="stylesheet" href="/css/uncompressed/login.css" />
</head>
	<header>
		<h1><strong><?php echo UnhostedSettings::domain ?> </strong>Unhosted storage node</h1>
	</header>
	<body>
		<div class="content">
			<h2>The app '<?=$_GET["client_id"] ?>' wants to read and write the <?=$_GET["scope"]?> data in your unhosted account</h2>
			<form method="post" action="">
				<label>User address:</label><span class="username"><?=$_GET["user_address"]?></span>	
				<label for="password">Password:</label>
				<div id="passAllow">
					<form method="POST" action="?">
					<input type="password" name="pwd" value="" />
					<input type="submit" name="submit" value="Allow" />
					<input type="hidden" value="<?=$_GET["user_address"]?>" name="user_address">
					<input type="hidden" value="<?=$_GET["scope"]?>" name="scope">
					<input type="hidden" value="<?=$_GET["redirect_uri"]?>" name="redirect_uri">
					</form>
				</div>
			</form>	
		</div>
	</body>
</html>
<?
}
?>
