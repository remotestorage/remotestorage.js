<?php
class Encryptor {
	const KEY_DIR = '/path/to/';
	private $keyPair;
	private $pubKey;

	function createKeyPair($passphrase) {
		$keyPair = openssl_pkey_new(array('private_key_bits' => 1024, 'private_key_type' => OPENSSL_KEYTYPE_RSA));
		$pathToKey = 'asdf';//.substr($keyDetails['key'], 27, 20);
		openssl_pkey_export_to_file($keyPair, self::KEY_DIR.$pathToKey.'.pair', $passphrase);
		$keyDetails = openssl_pkey_get_details($keyPair);
		file_put_contents(self::KEY_DIR.$pathToKey.'.pub', $keyDetails['key']);
		$this->keyPair = $keyPair;
		$this->pubKey = $keyDetails['key'];
		return $pathToKey;
	}
	private function getPrivate($pathToKey, $passphrase) {
		var_dump(self::KEY_DIR.$pathToKey.'.pair');
		return openssl_pkey_get_private(self::KEY_DIR.$pathToKey.'.pair', $passphrase);
	}
	private function getPublic($pathToKey) {
		return file_get_contents(self::KEY_DIR.$pathToKey.'.pub');
	}
	function decrypt($pathToKey, $passphrase, $encryptedData) {
		$privateKey = $this->getPrivate($pathToKey, $passphrase);
var_dump($privateKey);//something's still going wrong here
		openssl_private_decrypt($encryptedData, $sensitiveData, $privateKey);
		return $sensitiveData;
	}
	function encrypt($pathToKey, $sensitiveData) {
		$pubKey = $this->getPublic($pathToKey);
		openssl_public_encrypt($sensitiveData, $encryptedData, $pubKey);
		return $encryptedData;
	}
}

class UnhostedProxy {
	private $encryptor;
	private $pwd;
	function __construct() {
		$this->encryptor = new Encryptor();
		$this->pwd = 'secret';
	}
	function createChannel() {
		return $this->encryptor->createKeyPair($this->pwd);
	}
	function send($ch, $key, $clearData) {
		$encrypted = base64_encode($this->encryptor->encrypt($ch, $clearData));
		var_dump($encrypted);
		echo ' urlencoded: ';
		$encrypted = urlencode($encrypted);
		var_dump($encrypted);
		while ($msg = openssl_error_string()) {
		    echo $msg . "<br />\n";
		}
		$cmd = "curl http://localhost/git/unhosted/untrustedStore.php?cmd=SET\&channel=$ch\&key=$key\&value=$encrypted";
		$ret = `$cmd`;
	}
	function receive($ch, $key) {
		$cmd = "curl http://localhost/git/unhosted/untrustedStore.php?cmd=GET\&channel=$ch\&key=$key";
		$ret = `$cmd`;
		echo ' en: ';
		var_dump($ret);
		return $this->encryptor->decrypt($ch, $this->pwd, base64_decode($ret));
	}
}

//openssl_pkcs7_sign("/path/to/msg.txt", "/path/to/signed.txt", "/path/to/mycert.pem",
//    array("file:///path/to/mycert.pem", "mypassphrase"),
//    array()
//    );
//die();
$unhostedProxy = new UnhostedProxy();
$ch = $unhostedProxy->createChannel();
$unhostedProxy->send($ch, 'status', 'hoestermee');
var_dump($unhostedProxy->receive($ch, 'status'));
