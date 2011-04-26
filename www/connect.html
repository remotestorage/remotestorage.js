<?php
if(count($_POST)) {
	list($userName, $userDomain) = explode("@", $_POST["user_name"]);
	$pwdFile = "/var/www/unhosted/dav/$userDomain/$userName/.htpasswd";
	if(file_exists($pwdFile) && sha1($_POST["pwd"])==file_get_contents($pwdFile)) {
		$token = base64_encode(mt_rand());
		$davDir = "/var/www/unhosted/dav/$userDomain/$userName/".$_POST["scope"];
		`if [ ! -d $davDir ] ; then mkdir $davDir ; fi`;
		`echo "<LimitExcept OPTIONS HEAD GET>" > $davDir/.htaccess`;
		`echo "  AuthType Basic" >> $davDir/.htaccess`;
		`echo "  AuthName \"http://unhosted.org/spec/dav/0.1\"" >> $davDir/.htaccess`;
		`echo "  Require valid-user" >> $davDir/.htaccess`;
		`echo "  AuthUserFile $davDir/.htpasswd" >> $davDir/.htaccess`;
		`echo "</LimitExcept>" >> $davDir/.htaccess`;
		`htpasswd -bc $davDir/.htpasswd {$_POST["user_name"]} $token`;
		header("Location:http://".$_POST["redirect_uri"]."?token=".$token);
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
		<h1><strong>dev.unhosted.org </strong>Unhosted storage node</h1>
	</header>
	<body>
		<div class="content">
			<h2>The app '<?=$_GET["client_id"] ?>' wants to read and write the <?=$_GET["scope"]?> data in your unhosted account</h2>
			<form method="post" action="">
				<label>Username:</label><span class="username"><?=$_GET["user_name"]?></span>	
				<label for="password">Password:</label>
				<div id="passAllow">
					<form method="POST" action="?">
					<input type="password" name="pwd" value="" />
					<input type="submit" name="submit" value="Allow" />
					<input type="hidden" value="<?=$_GET["user_name"]?>" name="user_name">
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
