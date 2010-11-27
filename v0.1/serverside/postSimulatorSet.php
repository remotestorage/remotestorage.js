<?php
function urlify($b64) {
	for($i = strlen($b64)-1;$b64[$i]=='='; $i--) {}
	return str_replace(array('/', '+'), array('_','-'), substr($b64, 0, $i+1));
}
function genKey() {
	$pri =  openssl_pkey_new();
	$keyDetails = openssl_pkey_get_details($pri);
	$RSAn = base64_encode($keyDetails['rsa']['n']);
	$RSAe = base64_encode($keyDetails['rsa']['e']);
	$RSAd = base64_encode($keyDetails['rsa']['d']);
	openssl_pkey_export($pri, $priE);
	return array(urlify($RSAn), urlify($RSAd), $priE);
}
//list($RSAn, $RSAd, $priE) =genKey();
//echo "\$RSAn = '$RSAn';\n\$RSAd = '$RSAd';\n\$priE = '$priE';\n";
//die();
$RSAn = '5XFDY9ZgrVRCTTXcugUigoheDJU0iBrSa9iZafygS8vtA4H6eUMw70GItFDJ5mTHosD3MWBHg78R6iofKXi2vlLT2zlhcM-w1W2JMAo6P4mxg--1f8vmYpYaX64BDE9A03TXE-WAW1_HtYrZ_q2qhxWQAL8-PhNdwZLSEcowsz8';
$RSAd = 'baZrZlMVcMBLz0pmah_6FhfFmo3TxRfMZ-3jo1sv4AldA8giQ8FwqWbQRhw14P1YytcdS2OPyc6OaTIoIlGmQvbFMxDovN17A7J6ln5-GyK9HFiML5oPOuNROxAMMmE1LpglfVTOUoMS28OeFpATZENaoBvjCC9JRnEs9p4s6IE';
$priE = '-----BEGIN RSA PRIVATE KEY-----
MIICXgIBAAKBgQDlcUNj1mCtVEJNNdy6BSKCiF4MlTSIGtJr2Jlp/KBLy+0Dgfp5
QzDvQYi0UMnmZMeiwPcxYEeDvxHqKh8peLa+UtPbOWFwz7DVbYkwCjo/ibGD77V/
y+ZilhpfrgEMT0DTdNcT5YBbX8e1itn+raqHFZAAvz4+E13BktIRyjCzPwIDAQAB
AoGAbaZrZlMVcMBLz0pmah/6FhfFmo3TxRfMZ+3jo1sv4AldA8giQ8FwqWbQRhw1
4P1YytcdS2OPyc6OaTIoIlGmQvbFMxDovN17A7J6ln5+GyK9HFiML5oPOuNROxAM
MmE1LpglfVTOUoMS28OeFpATZENaoBvjCC9JRnEs9p4s6IECQQD9Dyy9dXWFOdAw
n3bMB8q1RKAz86m8WXIGBkXEw3XJHwAhnFEMrg8G1oR/LjiRbH0MaOXgIxsNkoVO
XXRcUBmJAkEA6BvUr+AZUblhlqQ04r60HrSx3EBdGr3gQo7qfkT1CHUAqXHntTg+
/x5R4jLqjBub3VnRpbvUu3/cH/C52RZchwJBAKfj4XLw8r8o1A7uPQqwQLRyizbs
ebgUP6nvj2ozo3mDr7qc0sju0dlfiRg3uiABMhWBosFJiTE//GE5b3GvUsECQQCl
RVPfW5mLuI2FXy0NGy9UAeP3aZkh9nudyPetq1oyiGVNQf7z6bXpoGQ7xXd/BhWo
ulDuSt2CGNvbnmQm8KY3AkEAuI57ntvGTG/mvhWrGEMjr9CWdHgQ4x9bznjCWOXO
h4egcj3t5FlDGhrOXMQk1OHdapFIT4aOetOysLKzN+Ebew==
-----END RSA PRIVATE KEY-----
';

//unlike JS's JSON.stringify, this escapes the forward slash!!
//$cmd = json_encode(array(
//	'method' => 'SET',
//	'key' => "helloblog.com+$RSAn@demo.unhosted.org/myFirstUnhostedBlogPost",
//	'value' => 'DEADBEEF',
//	));
$cmd = '{"method":"SET","key":"helloblog.com+'.$RSAn.'@demo.unhosted.org/myFirstUnhostedBlogPost","value":"DEADBEEF"}';

openssl_sign($cmd, $sign, $priE);
//$PubSign = urlify(base64_encode($sign));
$PubSign = base64_encode($sign);

$_POST=array(
	'protocol' => 'UJ/0.1',
	'cmd' => $cmd,
	'PubSign' => $PubSign,
	);
if(!isset($_SERVER) || !isset($_SERVER['HTTP_REFERER'])) {
	$_SERVER=array('HTTP_REFERER'=>'http://helloblog.com/index.html');
}
//var_dump($_POST);
require_once 'unhosted.php';
