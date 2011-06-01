<?php
require_once('../../unhosted/unhosted.php');

function getString($paramName, $from) {
        if(!isset($from[$paramName])) {
                die("Parameter $paramName not specified");
        }
        return $from[$paramName];
}
function getDomain($paramName, $from) {
        $domain = getString($paramName, $from);
        if(!preg_match('|^[a-z0-9-]+(\.[a-z0-9-]+)*$|i', $domain)) {
                die("Parameter $paramName should be a valid domain, '$domain' given");
        }
	return $domain;
}
function getUri($paramName, $from) {
        $uri = getString($paramName, $from);
        if(!preg_match('|^[a-z0-9-]+\:\/\/[a-z0-9-]+(\.[a-z0-9-\/]+)*$|i', $uri)) {
                die("Parameter $paramName should be a valid uri");
        }
	return $uri;
}
function getUserAddress($paramName, $from) {
        $userAddress = getString($paramName, $from);
        if(!preg_match('|^[a-z0-9-]+(\.[a-z0-9-]+)*@[a-z0-9-]+(\.[a-z0-9-]+)*$|i', $userAddress)) {
                die("Parameter $paramName is '$userAddress' but should be a valid user address");
        }
	return $userAddress;
}

if(count($_POST)) {
	$unhostedAccount = new UnhostedAccount(getUserAddress("user_address", $_POST), getString("pwd", $_POST));
	$token = $unhostedAccount->addAPP(getDomain("scope", $_POST));
	if($token) {
		header("Location:".getUri("redirect_uri", $_POST)."?token=".$token);
		echo "redirecting you back to the application.\n";
	} else {
		echo "Wrong password!";
	}
} else {
	$userAddress = getUserAddress('user_address', $_GET);
	$clientId = getDomain('client_id', $_GET);
	$dataScope = getDomain('scope', $_GET);
	$redirectUri = getUri('redirect_uri', $_GET);
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta http-equiv="content-type" content="text/html; charset=utf-8" />

<script src="/jQuery/jquery-1.6.1.min.js"></script>
<script src="/css/html5.js"></script><!-- this is the javascript allowing html5 to run in older browsers -->

<title>My Unhosted node</title>
<link rel="stylesheet" href="/css/uncompressed/reset.css" />
<link rel="stylesheet" href="/css/uncompressed/text.css" />
<link rel="stylesheet" href="/css/general.css" />
<link rel="stylesheet" href="/css/uncompressed/login.css" />
</head>
	<header>
		<h1><strong><?php echo UnhostedSettings::domain ?> </strong>Unhosted storage node</h1>
	</header>
	<body>
		<div class="content">
			<h2>The app '<?=$clientId ?>' wants to read and write the <?=$dataScope ?> data in your unhosted account</h2>
			<form method="post" action="">
				<label>User address:</label><span class="username"><?=$userAddress ?></span>	
				<label for="password">Password:</label>
				<div id="passAllow">
					<form method="POST" action="?">
					<input type="password" name="pwd" value="" />
					<input type="submit" name="submit" value="Allow" />
					<input type="hidden" value="<?=$userAddress ?>" name="user_address">
					<input type="hidden" value="<?=$dataScope ?>" name="scope">
					<input type="hidden" value="<?=$redirectUri ?>" name="redirect_uri">
					</form>
				</div>
			</form>	
		</div>
	</body>
</html>
<?
}
?>
