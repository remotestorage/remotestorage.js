<?php

if($_GET["install"] == "install") {
	file_put_contents("settings.php", "class UnhostedSettings {\n"
		."\tconst protocol = 'http';\n"
		."\tconst domain = 'dev.unhosted.org';\n"
		."\tconst davDir = '/var/www/my-unhosted-website/dav/';\n"
		."}\n");
	file_put_contents("config.js", "var appBaseUrl = 'http://dev.unhosted.org';\n"
		."\n"
		."\tvar config = {\n"
		."\t	appUrl: appBaseUrl + '/',\n"
		."\t	doUrl: appBaseUrl + '/unhosted/do.php',\n"
		."\t	loginUrl: appBaseUrl + '/unhosted/login.html',\n"
		."\t	registerUrl: appBaseUrl + '/unhosted/register.html',\n"
		."\t	callbackUrl: appBaseUrl+ '/unhosted/callback.html',\n"
		."\t	appName: 'My Favourite Sandwich',\n"
		."\t	dataScope: 'dev.unhosted.org',\n"
		."\t	homeDomain: 'dev.unhosted.org'\n"
		."}\n");
	unlink("init.php");
	header("Location: /");
	die();
}
?>

<html><head><script>
function checkHostMeta(cb) {
	var xhr = new XMLHttpRequest();
	xhr.open("GET", "/.well-known/host-meta", true);
	xhr.onreadystatechange = function() {
		if(xhr.readyState == 4) {
			if(xhr.status == 200) {
				cb();
			} else {
				alert('got a status '+xhr.status+' when trying to open /.well-known/host-meta. Please check the file is there and accessible.');
			}
		}
	}
	xhr.send();
}
</script></head><body>
<input type="submit" value="check" onclick="checkHostMeta(function(){document.getElementById('install').disabled=false;})">
<form method="GET" target="?">
<input type="submit" id="install" value="install" name="install" disabled=true>
</form>
</body></html>

<?php

$apacheModules = apache_get_modules();
echo "Welcome to your new unhosted website. This only works on Apache, so if you're on lighttpd or nginx or something else, then please help us port this install script! If you're on apache, then let's continue by checking whether you have the necessary modules installed:<br>";
foreach(array('dav', 'dav_fs', 'headers') as $module) {
	$missingModules = array();
	if(in_array("mod_$module", $apacheModules)) {
		echo "You have mod_$module installed. OK!<br>";
	} else {
		$missingModules[] = $module;
		echo "You don't seem to have mod_$module installed.<br>";
	}
}
if(count($missingModule)) {
	echo "You're missing a few apache modules. So you need to ssh to your server as root, and activate them:<br>";
	foreach($missingModules as $missingModule) {
		echo "a2enmod $missingModule<br>";
	}
	echo "/etc/init.d/apache2 restart<br>";
}
echo "make sure .well-known/host-meta loads and has CORS on it:<br>";
?>
