<?php
require_once 'config.php';

function createWallet($walletPath, $userAddress, $dataScope, $cryptoPwd) {
	$wallet = json_encode(array(
		"userAddress" => $userAddress,
		"dataScope" => $dataScope,
		"cryptoPwd" => $cryptoPwd,
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
	$url= 'https://browserid.org/verify?assertion='.urlencode($assertion).'&audience=myfavouritesandwich.org';
	// is cURL installed yet?
	if (!function_exists('curl_init')){
		die('Sorry cURL is not installed!');
	}
 
	$ch = curl_init();
	curl_setopt($ch, CURLOPT_URL, $url);
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	$outputStr = curl_exec($ch);
	$output = json_decode($outputStr, true);
	curl_close($ch);
 	if($output["status"] == "okay") {
		return $output["email"];
	} else {
		var_export($outputStr);
		var_export($output);
		var_export($output["status"]);
	}
	return false;
}


if($verifiedEmail = verifyBrowserId($_POST["browserIdAssertion"])) {
	echo getWallet($verifiedEmail, $_POST["dataScope"]);
} else {
	echo "fail";	
}
