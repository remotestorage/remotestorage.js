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
