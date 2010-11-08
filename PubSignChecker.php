<?php
interface PubSignBackend {
	function process($channel, $payload, $sign);
}
class PubSign {
	function checkSignature($channel, $message, $sign) {
		$pubKey = "-----BEGIN PUBLIC KEY-----\n".chunk_split($channel, 64, "\n")."-----END PUBLIC KEY-----\n";
		$ok = openssl_verify($message, base64_decode($sign), $pubKey);
		return ($ok == 1);//bool success
	}
	function parsePost($POST, PubSignBackend $backend) {
		foreach(array('channel', 'message', 'sign') as $key) {
			if(!isset($POST[$key])) {
				return false;//failure
			}
		}
		if(!$this->checkSignature($POST['channel'], $POST['message'], $POST['sign'])) {
			return false;//failure
		}
		return $backend->process($POST['channel'], $POST['message'], $POST['sign']);
	}
}

class UnhostedStorage implements PubSignBackend {
	function process($channel, $payload, $sign){
		return TRUE;//success
	}
}

//main:
function dispatch() {
	$pubSign = new PubSign();
	$backend= new UnhostedStorage();
	return $pubSign->parsePost($_POST, $backend);
}

//test form:
?>
	<html>
		<form name="input" action="?" method="post">
			channel <input type='textarea' name='channel' value='MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCdtXVjKxVgosoa/bLOhC7qXD8wco3GX6toDDv8UGp1AihclfU8j6KVIeiKIq0SHKr3IJClgumxw9S1RUmzv1nYZfu43My36+0BXKxtBiA9wsfyG8pulPxs5No2rJcPnIgSgjMI7yqhxrZ17miiNZFE0ehBH0CTmFbdcWsauL08MwIDAQAB'/><br>
			message <input type='textarea' name='message' value ='the data to be signed'/><br>
			signature <input type='textarea' name='sign' value='jrTJOFWYOPdfcC8ojbOWcz11QFT4InWRDmH/RUhVy4CuqLJiAJMGVos83uCmfyzOc6Oesouk4mLdvfYG+cG4UIsgQV1Uw2WjomQv22y4392+NuvCJAkfoVFmHq74cz2e+Q5KcCBg4VRpg+1FOY50/TkmgaOiFYHUwsWrXitF5Ks='/><br>
			<input type='submit' value='Test'/>
		</form>
	</html>
<?php

ini_set('display_errors', TRUE);
var_dump(dispatch());
echo '<br>';
while ($msg = openssl_error_string()) {
    echo $msg . "<br>\n";
}

