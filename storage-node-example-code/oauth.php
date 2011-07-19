<?php
if(isset($_GET['browserid-assertion'])) {
	$url= 'https://browserid.org/verify?assertion='
		.urlencode($_GET['browserid-assertion'])
		.'&audience=dav01.federoni.org';
	$ch = curl_init();
	curl_setopt($ch, CURLOPT_URL, $url);
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	$outputStr = curl_exec($ch);
	$output = json_decode($outputStr, true);
	curl_close($ch);
	if($output["status"] == "okay") {	
		header('Location: '.$_GET['redirect_uri'].'#access_token=MTY4NzAxOTE3MQ==');
		echo "Letting you in based on this assertion:";
		var_export($_GET['browserid-assertion']);
		die();
	} else {
		var_export($url);
		var_export($outputStr);
		die('Not okay. Go away.');
	}
}
?>
<html>
<head>
<script src="https://browserid.org/include.js"></script>
<script>
function allow() {
	navigator.id.getVerifiedEmail(function(assertion) {
		if(assertion) {
			window.location += "&browserid-assertion="+encodeURIComponent(assertion);
		}
	});
}
</script></head><body>
	<input type="submit" value="Allow (requires BrowserId)" onclick="allow();">
</body></html>
