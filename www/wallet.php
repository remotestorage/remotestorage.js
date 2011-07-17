<?php
//hard-coded for debugging:
echo json_encode(array(
	"storageType" => "http://unhosted.org/spec/dav/0.1",
	"davUrl" => "http://myfavouritesandwich.org/",
	"userAddress" => "mich@myfavouritesandwich.org",
	"dataScope" => "sandwiches",
	"davToken" => "Njg4OTk3MjQw"
	));
die();
require_once 'config.php';

function createWallet($walletPath, $userAddress, $dataScope, $cryptoPwd) {
	$wallet = json_encode(array(
		"userAddress" => $userAddress,
		"dataScope" => $dataScope,
		"cryptoPwd" => $cryptoPwd
		));
	file_put_contents($walletPath, $wallet); 
	return $wallet;
}
function getWallet($userAddress, $dataScope) {
	$walletPath = Config::walletDir . bin2hex($userAddress)."_".bin2hex($dataScope);
	if(file_exists($walletPath)) {
		return file_get_contents($walletPath);
	} else {
		$cryptoPwd = sha1(mt_rand());
		return createWallet($walletPath, $userAddress, $dataScope, $cryptoPwd);
	}
}
function verifyBrowserId($assertion){
	$url= 'https://browserid.org/verify?assertion='.urlencode($assertion).'&audience=example.com';
	// is cURL installed yet?
	if (!function_exists('curl_init')){
		die('Sorry cURL is not installed!');
	}
 
	$ch = curl_init();
	curl_setopt($ch, CURLOPT_URL, $url);
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	$output = json_decode(curl_exec($ch), true);
	curl_close($ch);
 	if($output["status"] == "okay") {
		return $output["email"];
	}
	return false;
}


if($verifiedEmail = verifyBrowserId($_POST["browserIdAssertion"])) {
	echo getWallet($verifiedEmail, $_POST["dataScope"]);
}
