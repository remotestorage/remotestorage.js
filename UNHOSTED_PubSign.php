<?php

function genKeyTriplet() {
	$pkeyidWrite =  openssl_pkey_new();
	$keyDetails = openssl_pkey_get_details($pkeyidWrite);
	$pubkeyWriteAsc = $keyDetails['key'];
	$ses = bin2hex(openssl_random_pseudo_bytes(2));
	openssl_pkey_export($pkeyidWrite , $out);
	return array($out, makePubSer($pubkeyWriteAsc), $ses);
}

function makePubSer($pub) {
	return substr($pub, 27, 64)
		.substr($pub, 92, 64)
		.substr($pub, 157, 64)
		.substr($pub, 222, 24);
}

//echo "encrypt:\n";
$encr = openssl_encrypt($data, 'des-ecb', $ses);
while ($msg = openssl_error_string()) {
//    echo $msg . "\n";
}
function makeMessage($POST) {
	return json_encode(array(
		'cmd' => $POST['cmd'],
		'path' => $POST['path'],
		'revision' => $POST['revision'],
		'lastRevision' => $POST['lastRevision'],
		'payload' => $POST['payload'],
		));
	return $pubSign->parsePost($_POST, $backend);
}

function sign($pri, $message) {
	openssl_sign($message, $sign, $pri);
	return base64_encode($sign);
}


//main:
ini_set('display_errors', TRUE);

//keyset:
if(!isset($_POST['pri'])) {
	echo "Generating key triplet<br>";
	list($_POST['pri'], $_POST['channel'], $_POST['ses']) = genKeyTriplet();
	?>
		<table border="1">
			<tr><td>pri</td><td><?=$_POST['pri']?></td></tr>
			<tr><td>channel(pub)</td><td><?=$_POST['channel']?></td></tr>
			<tr><td>ses</td><td><?=$_POST['ses']?></td></tr>
		</table>

	<?php
}
//now we have at least pri, channel, ses in $_POST
while ($msg = openssl_error_string()) {
    echo $msg . "<br>\n";
}
//test form for making the PubSign packet:
?>
	<html>
		<form name="input" action="?" method="post">
			message <table border='1'>
				<tr><td>cmd</td><td><input type='textarea' name='cmd' value ='SET'/></td></tr>
				<tr><td>path</td><td><input type='textarea' name='path' value ='<?=$_POST['channel']?>+myApp@cloud.com/path/to/key'/></td></tr>
				<tr><td>revision</td><td><input type='textarea' name='revision' value ='1234567890'/></td></tr>
				<tr><td>lastRevision</td><td><input type='textarea' name='lastRevision' value ='1234567000'/></td></tr>
				<tr><td>payload</td><td><input type='textarea' name='payload' value ='{"What a happy cat!"}'/></td></tr>
			</table>
			<input type='submit' value='Test'/>
			<?foreach(array('pri', 'channel', 'ses') as $field) {//propagate these fields from already created channel ?>
				<input type='hidden' name='<?=$field?>' value ='<?=$_POST[$field]?>'/>
			<?}?>
		</form>
	</html>
<?php

//PubSign message:
if(!isset($_POST['message']) && isset($_POST['cmd'])) {//make UNHOSTED message into PubSign message:
	echo "Generating message.<br/>";
	$_POST['message'] = makeMessage($_POST);
} else {
	$_POST['message'] = '';
}
//now we have at least pri, pub, ses, message in $_POST

if(!isset($_POST['sign']) && isset($_POST['message']) && (strlen($_POST['message']) > 0)) {//sign the message
	echo "Signing message {$_POST['message']} with signature {$_POST['pri']}<br/>";
	$_POST['sign'] = sign($_POST['pri'], $_POST['message']);
} else {
	$_POST['sign'] = '';
}
//now we have at least pri, pub, ses, message, sign in $_POST

//echo "sign:\n";
while ($msg = openssl_error_string()) {
    echo $msg . "<br>\n";
}
//test form for sending the PubSign packet:
?>
	<html>
		<H2>myCloudSet:</H2>
		<form name="input" action="myCloudSet.php" method="post">
			channel <input type='textarea' name='channel' value='<?=$_POST['channel']?>'><br/>
			message <input type='textarea' name='message' value ='<?=$_POST['message']?>'/><br/>
			signature <input type='textarea' name='sign' value='<?=$_POST['sign']?>'/><br/>
			<input type='submit' value='Test'/>
		</form>
		<H2>myCloudGet:</H2>
		<form name="input" action="myCloudGet.php" method="post">
			path <input type='textarea' name='path' value ='<?=$_POST['channel']?>+myApp@cloud.com/path/to/key'/></td></tr>
			<input type='submit' value='Test'/>
		</form>
	</html>
<?php

echo '<br>';
while ($msg = openssl_error_string()) {
    echo $msg . "<br>\n";
}

