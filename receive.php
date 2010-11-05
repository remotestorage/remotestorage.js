<?php
require_once('msg.php');

echo "decrypting '$encr' with '$ses':\n";
$data2 = openssl_decrypt($encr, 'des-ecb', $ses);
while ($msg = openssl_error_string()) {
    echo $msg . "\n";
}
echo "got '$data2'\n";
echo "now verifying signature '$sign':\n";
// state whether signature is okay or not
$ok = openssl_verify($data2, base64_decode($sign), $pub);
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

