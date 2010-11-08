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
function dispatch() {
	$pubSign = new PubSign();
	$backend= new UnhostedStorage();
	$_POST['message']=json_encode(array(
		'cmd' => $_POST['cmd'],
		'path' => $_POST['path'],
		'revision' => $_POST['revision'],
		'lastRevision' => $_POST['lastRevision'],
		'payload' => $_POST['payload'],
		));
	return $pubSign->parsePost($_POST, $backend);
}

//test form:
$pub = 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC1WItEtjgjP6l7Ri7lD93ybJYh1NHeoDYReVtcQpORq27bC+059z9UxkUlcZDf3nk+34oIXHECPBT76GSdK+XbV+1d0HBE+H7j52T7zPqIi08AcYyX2lPOBwPfCnWSvThLseSHd28iIvq8XKFhV1ofSy62nzfHHs9B+Vl52t3EBQIDAQAB';
$sign = 'Cn8aAmR6H7/DlfOfh6G2+KsH85GEm+1ZhLH5toESzYVhSMk6umSo4Ec3Djp6CYbCU2BRw9a5JFJc6TGLhLLfwfPwDWVL/0INpOAr+3isB6lo+Fzi+g1C5JR1QyBAC1G7MA4Ql1m7A5CMftZrIrHWbPSSd3x+mEjtYt6C5qhdJyk=';

?>
	<html>
		<form name="input" action="?" method="post">
			channel <input type='textarea' name='channel' value='<?=$pub?>'><br>
			message <table border='1'>
				<tr><td>cmd</td><td><input type='textarea' name='cmd' value ='SET'/></td></tr>
				<tr><td>path</td><td><input type='textarea' name='path' value ='channel+app@cloud.com/path/to/key'/></td></tr>
				<tr><td>revision</td><td><input type='textarea' name='revision' value ='1234567890'/></td></tr>
				<tr><td>lastRevision</td><td><input type='textarea' name='lastRevision' value ='1234567000'/></td></tr>
				<tr><td>payload</td><td><input type='textarea' name='payload' value ='{"hello world!"}'/></td></tr>
			</table>
			signature <input type='textarea' name='sign' value='<?=$sign?>'/><br>
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

