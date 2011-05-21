<?php
if(file_exists("config.js") && file_exists("config.php") && file_exists("../.well-known/host-meta")) {
	die("Looks like the installation was already successfully completed");
}
if($_POST["install"] == "install") {
	$domain = $_POST["domain"];
	$protocol = $_POST["protocol"];
	$installationType = $_POST["installationType"];
	if($installationType == "hive") {
		@unlink("base64.js");
		@unlink("callback.html"); 
		@unlink("login.html");
		@unlink("register.html");
		@unlink("sjcl/sjcl.js");
		@rmdir("sjcl");
		@unlink("unhosted.js");
		@unlink("wallet.js");
		@unlink("webfinger.js");
		@file_put_contents("../index.html", "This the unhosted hive for $protocol://$domain. Please contact superman@$domain for more info about your unhosted account.");
	}
	$scriptDir = dirname(__file__);
	$wwwDir = dirname($scriptDir);
	$virtualHostDir = dirname($wwwDir);
	file_put_contents("config.php", "<?php\n"
		."class UnhostedSettings {\n"
		."\tconst installationType = '$installationType';\n"
		."\tconst protocol = '$protocol';\n"
		."\tconst domain = '$domain';\n"
		."\tconst davDir = '$virtualHostDir/dav/';\n"
		."\tconst pwdDir = '$virtualHostDir/pwd/';\n"
		."\tconst walletDir = '$virtualHostDir/wallet/';\n"
		."}\n");
	file_put_contents("config.js", 
		"var appBaseUrl = '$protocol://$domain';\n"
		."var installationType = '$installationType';\n"
		."\n"
		."var config = {\n"
		."\tappUrl: appBaseUrl + '/',\n"
		."\tdoUrl: appBaseUrl + '/unhosted/do.php',\n"
		."\tloginUrl: appBaseUrl + '/unhosted/login.html',\n"
		."\tregisterUrl: appBaseUrl + '/unhosted/register.html',\n"
		."\tcallbackUrl: appBaseUrl + '/unhosted/callback.html',\n"
		."\tclientId: '$domain',\n"
		."\tdataScope: '$domain',\n"
		."\thomeDomain: '$domain'\n"
		."}\n");
	file_put_contents("../.well-known/host-meta", "<?xml version='1.0' encoding='UTF-8'?>\n"
		."<XRD xmlns='http://docs.oasis-open.org/ns/xri/xrd-1.0' \n"
 		."\t\txmlns:hm='http://host-meta.net/xrd/1.0'>\n"
 		."\t<hm:Host xmlns='http://host-meta.net/xrd/1.0'>$domain</hm:Host>\n"
 		."\t<Link rel='lrdd' \n"
 		."\t\ttemplate='http://$domain/unhosted/webfinger.php?q={uri}'>\n"
 		."\t\t<Title>Resource Descriptor</Title>\n"
 		."\t</Link>\n"
 		."\t<Link rel='register'\n" 
 		."\t\ttemplate='http://$domain/unhosted/register.php?user_name={uri}&amp;redirect_url={redirect_url}'>\n"
 		."\t\t<Title>Resource Descriptor</Title>\n"
 		."\t</Link>\n"
		."</XRD>\n");
	file_put_contents("../../dav/.htaccess",
		"AuthType Basic\n"
		."AuthName \"choose a subdir please\"\n"
		."AuthUserFile /home/mich/Code/unhosted/my-unhosted-website/dav/.htpasswd\n"
		."require valid-user\n"
		."Header always set Access-Control-Allow-Methods \"GET, POST, DELETE, OPTIONS, PUT\"\n"
		."Header always set Access-Control-Allow-Headers \"Content-Type, X-Requested-With, X-HTTP-Method-Override, Accept, Authorization\"\n"
		."Header always set Access-Control-Allow-Credentials \"true\"\n"
		."Header always set Cache-Control \"max-age=0\"\n"
		."Header always set Access-Control-Allow-Origin \"http://%{FAVOURITE}e\"\n");
	header("Location: /?refresh");
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
	document.getElementById("installationType").value = "flower";
	document.getElementById("domain").value = window.location.host;
	document.getElementById("protocol").value = window.location.protocol.substring(0, window.location.protocol.length-1);
	document.getElementById("installationDetails").style.visibility="hidden";
	document.getElementById("cors").style.visibility="hidden";
	var xhr = new XMLHttpRequest();
	xhr.open("POST", "/.well-known/host-meta", true);
	xhr.onreadystatechange = function() {
		if(xhr.readyState == 4) {
			if(xhr.status == 200) {
				var responseHeaders = xhr.getAllResponseHeaders().split("\n");
				var i;
				for(i=0; i < responseHeaders.length; i++) {
					if ((responseHeaders[i].length > 1) && (responseHeaders[i][ responseHeaders[i].length-1 ] == "\r")) {
						responseHeaders[i] = responseHeaders[i].slice (0,-1); // remove \r if any
					}
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
Header always set Access-Control-Allow-Methods "POST"<br>
Header always set Access-Control-Allow-Headers "Content-Type, X-Requested-With, X-HTTP-Method-Override, Accept"<br>
</strong>
You can for instance put these into the /var/www/ Directory directive. Make sure you obey indentation. Then restart apache, clear your browser cache, and reload this page.</div>
<form method="POST" target="?">
<input type="submit" id="install" value="install" name="install" disabled=true>
<div id="installationDetails">
	<br>Domain: 
	<input type="text" id="domain" name="domain">
	(the domain that will appear behind the @ symbol in all unhosted accounts created here. At the same time, the URL the app will be served from)
	<br>Protocol: 
	<input type="text" id="protocol" name="protocol">
	('https' is the preferred option! you can always remove /var/www/my-unhosted-website/www/unhosted/config.js to correct this later)
	<br>Installation type: 
	<input type="text" id="installationType" name="installationType">
	(leave as 'flower' if you will be offering an app on this domain. If the domain is only to be used as a storage node, then fill in 'hive' here)
</div>
</form>
</body></html>

	<?php
	}
}
?>
