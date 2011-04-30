<?php

if($_GET["install"] == "install") {
	file_put_contents("config.php", "<?php\n"
		."class UnhostedSettings {\n"
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
} else {
	$apacheModules = apache_get_modules();
	$missingModules = array();
	foreach(array('dav', 'dav_fs', 'headers') as $module) {
		if(!in_array("mod_$module", $apacheModules)) {
			$missingModules[] = $module;
		}
	}
	if(count($missingModules)) {
		echo "Welcome to your new unhosted website. This only works on Apache, so if you're on lighttpd or nginx or something else, then please help us port this install script! If you're on apache, then let's continue...<br>";
		echo "You're missing a few apache modules. So you need to ssh to your server as root, and activate them:<br><strong>";
		foreach($missingModules as $missingModule) {
			echo "a2enmod $missingModule<br>";
		}
		echo "/etc/init.d/apache2 restart</strong><br>After that, reload this page.";
	} else {
	?>

<html><head><script>
function checkDav(cb) {
	var xhr = new XMLHttpRequest();
	
}
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
						checkDav(cb);
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
<div id="cors" visibility="hidden">You did not install the correct CORS headers yet. Add the following directives into your apache config (it should also be possible to make this work with a .htaccess file, but i can't get that to work for some reason):<br><strong>
Header always set Access-Control-Max-Age "86400"<br>
Header always set Access-Control-Allow-Origin "*"<br>
Header always set Access-Control-Allow-Methods "GET"<br>
Header always set Access-Control-Allow-Headers "Content-Type, X-Requested-With, X-HTTP-Method-Override, Accept"<br>
</strong>
You can for instance put these into the /var/www/ Directory directive. Make sure you obey indentation. Then restart apache, clear your browser cache, and reload this page.</div>
<form method="GET" target="?">
<input type="submit" id="install" value="install" name="install" disabled=true>
</form>
</body></html>

	<?php
	}
}
?>
