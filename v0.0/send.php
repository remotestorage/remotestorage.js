<?php

function genKeyTriplet() {
	$pkeyidWrite =  openssl_pkey_new();
	$keyDetails = openssl_pkey_get_details($pkeyidWrite);
	$pubkeyWriteAsc = $keyDetails['key'];
	$ses = bin2hex(openssl_random_pseudo_bytes(2));
	return array($pkeyidWrite, $pubkeyWriteAsc, $ses);
}

list($pri, $pub, $ses) = genKeyTriplet();
$pubser = substr($pub, 27, 64)
	.substr($pub, 92, 64)
	.substr($pub, 157, 64)
	.substr($pub, 222, 24);
//$data = '{"cmd":"SET","path":"'.$pubser.'+app@cloud.com\/path\/to\/key","revision":"1234567890","lastRevision":"1234567000","payload":"{\"hello world!\"}"}';
$data = 'What a happy cat! http://img.example.com/cat_123.jpg';

//echo "sign:\n";
openssl_sign($data, $sign, $pri);
while ($msg = openssl_error_string()) {
//    echo $msg . "\n";
}

//echo "encrypt:\n";
$encr = openssl_encrypt($data, 'des-ecb', $ses);
while ($msg = openssl_error_string()) {
//    echo $msg . "\n";
}
echo "<?php\n";
echo "\$pub = '$pub';\n";
echo "\$ses = '$ses';\n";
echo "\$pubser = '$pubser';\n";
echo "\$sign = '".base64_encode($sign)."';\n";
echo "\$encr = '$encr';\n";
echo "\$message = '$data';\n";
die();

echo "decrypt:\n";
$data2 = openssl_decrypt($encr, 'des-ecb', 'glop');
while ($msg = openssl_error_string()) {
    echo $msg . "\n";
}

echo "now verify:\n";
// state whether signature is okay or not
$ok = openssl_verify($data2, $signature, $pubkeyWriteAsc);
while ($msg = openssl_error_string()) {
    echo $msg . "\n";
}

if ($ok == 1) {
    echo "\n\tgood\n";
} elseif ($ok == 0) {
    echo "\n\tbad\n";
} else {
    echo "\n\tugly, error checking signature\n";
}

echo "free the key from memory:\n";
openssl_free_key($pkeyidWrite);
while ($msg = openssl_error_string()) {
    echo $msg . "\n";
}

?>
