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

require_once 'UnhostedStorage.php';

//main:
class MockBackend implements PubSignBackend { function process($channel, $payload, $sign){return "'$payload' got through the PubSign check and reached the backend.";} }

function dispatch() {
	$pubSign = new PubSign();
	$backend= new MockBackend();
	return $pubSign->parsePost($_POST, $backend);
}

//test form:
$pubser = 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDUDvsSMyWan03u+B8HNqlM7mspFsJ6IlZw88zUbrmd4AsCny2KHh1LJFrAZzq6Pv+59xiSedwj2p7HxE8Gj3j1UO/lTVYu9PmDMKtkQq+yP3DdDWfbh6n1r5fB1Fcv5JpcXkU1MNcQVfSpKxoUgSeOV0FxNBMmmJ6FKOzOOkdXRwIDAQAB';
$sign = 'bhx3UAaP7YTetPKPDJhV5DKZlzaEnrLxLsXMTr0st7cYQYS2+AvltaGHeLGSzGrH7ZHPN38NSvJaQePCY9IafNYDNoKfe69sS300+51rNOFQ4vq3beo61lRp+VQH3X7WOLqGTzkeyxX+W7iHoM4nZh2pk+ma7FYC39g5bCt8NNU=';
$message = 'What a happy cat! http://img.example.com/cat_123.jpg';

?>
	<html>
		<form name="input" action="?" method="post">
			channel <input type='text' name='channel' value='<?=$pubser?>' size='100'/><br/>
			message <input type='text' name='message' value ='<?=$message?>' size='100'/><br/>
			signature <input type='text' name='sign' value='<?=$sign?>' size='100'/><br/>
			<input type='submit' value='Test'/> If the signature is not correct for the combination of message and channel, it will not get through.<br/>
		</form>
	</html>
<?php

ini_set('display_errors', TRUE);
$result = dispatch();
echo "$result<br>";
while ($msg = openssl_error_string()) {
    echo $msg . "<br>\n";
}

