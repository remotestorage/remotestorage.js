<?php
function genKeyPair() {
	$pkeyid =  openssl_pkey_new();
	$keyDetails = openssl_pkey_get_details($pkeyid);
	$pubkeyAsc = $keyDetails['key'];
	return array($pkeyid, $pubkeyAsc);
}


$data = "the data to be signed";
list($pkeyid, $pubkeyAsc) = genKeyPair();

echo "sign:\n";
openssl_sign($data, $signature, $pkeyid);
while ($msg = openssl_error_string()) {
    echo $msg . "\n";
}

echo "now verify:\n";
// state whether signature is okay or not
$ok = openssl_verify($data, $signature, $pubkeyAsc);
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
openssl_free_key($pkeyid);
while ($msg = openssl_error_string()) {
    echo $msg . "\n";
}

?>
