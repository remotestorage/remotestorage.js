<?php

function genKeyTriplet() {
	$pkeyidWrite =  openssl_pkey_new();
	$keyDetails = openssl_pkey_get_details($pkeyidWrite);
	$pubkeyWriteAsc = $keyDetails['key'];
	$ses = bin2hex(openssl_random_pseudo_bytes(2));
	return array($pkeyidWrite, $pubkeyWriteAsc, $ses);
}

$data = "the data to be signed";
list($pri, $pub, $ses) = genKeyTriplet();

echo "sign:\n";
openssl_sign($data, $signature, $pri);
while ($msg = openssl_error_string()) {
    echo $msg . "\n";
}

echo "encrypt:\n";
$encr = openssl_encrypt($data, 'des-ecb', $ses);
while ($msg = openssl_error_string()) {
    echo $msg . "\n";
}
var_dump($encr);

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
