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

$apacheModules = apache_get_modules();
foreach(array('dav', 'dav_fs', 'headers') as $module) {
	$missingModules = array();
	if(!in_array("mod_$module", $apacheModules)) {
		$missingModules[] = $module;
		echo "You don't seem to have mod_$module installed.<br>";
	}
}
if(count($missingModule)) {
	echo "Welcome to your new unhosted website. This only works on Apache, so if you're on lighttpd or nginx or something else, then please help us port this install script! If you're on apache, then let's continue...<br>";
	echo "You're missing a few apache modules. So you need to ssh to your server as root, and activate them:<br><strong>";
	foreach($missingModules as $missingModule) {
		echo "a2enmod $missingModule<br>";
	}
	echo "/etc/init.d/apache2 restart</strong><br>After that, reload this page.";
	die();
}
?>

<html><head><script>
function checkHostMeta(cb) {
	document.getElementById('cors').style.visibility="hidden";
	var xhr = new XMLHttpRequest();
	xhr.open("GET", "/.well-known/host-meta", true);
	xhr.onreadystatechange = function() {
		if(xhr.readyState == 4) {
			if(xhr.status == 200) {
				var responseHeaders = xhr.getAllResponseHeaders().split("\r\n");
				var i;
				for(i=0; i < responseHeaders.length; i++) {
					if(responseHeaders[i] == "Access-Control-Allow-Origin: *") {
						document.getElementById('testing').style.visibility="hidden";
						cb();
						return;
					}
				}
				document.getElementById('testing').style.visibility="hidden";
				document.getElementById('cors').style.visibility="visible";
			} else {
				alert('got a status '+xhr.status+' when trying to open /.well-known/host-meta. Please check the file is there and accessible.');
			}
		}
	}
	xhr.send();
}
</script></head><body onload="checkHostMeta(function(){document.getElementById('install').disabled=false;})">
<H2>Great! You're running apache with all the necessary modules.</H2>
<div id="testing" visibility="hidden">Testing whether you are offering successfully offering host-meta with CORS...</div>
<div id="cors" visibility="hidden">You did not install the correct CORS headers</div>
<form method="GET" target="?">
<input type="submit" id="install" value="install" name="install" disabled=true>
</form>
</body></html>
