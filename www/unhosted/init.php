<?php

if($_GET["install"] == "install") {
	$domain = $_SERVER["SERVER_NAME"];
	$scriptDir = dirname(__file__);
	$wwwDir = dirname($scriptDir);
	$virtualHostDir = dirname($wwwDir);
	file_put_contents("config.php", "<?php\n"
		."class UnhostedSettings {\n"
		."\tconst protocol = 'http';\n"
		."\tconst domain = '$domain';\n"
		."\tconst davDir = '$wwwDir/dav/';\n"
		."}\n");
	file_put_contents("config.js", "var appBaseUrl = 'http://$domain';\n"
		."\n"
		."\tvar config = {\n"
		."\tappUrl: appBaseUrl + '/',\n"
		."\tdoUrl: appBaseUrl + '/unhosted/do.php',\n"
		."\tloginUrl: appBaseUrl + '/unhosted/login.html',\n"
		."\tregisterUrl: appBaseUrl + '/unhosted/register.html',\n"
		."\tcallbackUrl: appBaseUrl+ '/unhosted/callback.html',\n"
		."\tappName: 'My Favourite Sandwich',\n"
		."\tdataScope: '$domain',\n"
		."\thomeDomain: '$domain'\n"
		."}\n");
	file_put_contents("../.well-known/host-meta", "<?xml version='1.0' encoding='UTF-8'?>\n"
		."<XRD xmlns='http://docs.oasis-open.org/ns/xri/xrd-1.0' \n"
 		."\t\txmlns:hm='http://host-meta.net/xrd/1.0'>\n"
 		."\t<hm:Host xmlns='http://host-meta.net/xrd/1.0'>dev.unhosted.org</hm:Host>\n"
 		."\t<Link rel='lrdd' \n"
 		."\t\ttemplate='http://$domain/unhosted/webfinger.php?q={uri}'>\n"
 		."\t\t<Title>Resource Descriptor</Title>\n"
 		."\t</Link>\n"
 		."\t<Link rel='register'\n" 
 		."\t\ttemplate='http://$domain/unhosted/register.php?user_name={uri}&redirect_url={redirect_url}'>\n"
 		."\t\t<Title>Resource Descriptor</Title>\n"
 		."\t</Link>\n"
		."</XRD>\n");

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
	//...
	cb();
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
