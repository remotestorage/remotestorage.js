<?php
class Encryptor {
	private $keyPair;
	private $pubKey;

	function createKeyPair($passphrase) {
		$keyPair = openssl_pkey_new(array('private_key_bits' => 1024, 'private_key_type' => OPENSSL_KEYTYPE_RSA));
		$pathToKey = 'asdf';//.substr($keyDetails['key'], 27, 20);
		openssl_pkey_export_to_file($keyPair, $pathToKey.'.pair', $passphrase);
		$keyDetails = openssl_pkey_get_details($keyPair);
		file_put_contents($pathToKey.'.pub', $keyDetails['key']);
		$this->keyPair = $keyPair;
		$this->pubKey = $keyDetails['key'];
		return $pathToKey;
	}
	private function getPrivate($pathToKey, $passphrase) {
		echo 'getting private:';
		var_dump(file_get_contents($pathToKey.'.pair'));
		return openssl_pkey_get_private($pathToKey.'.pair', $passphrase);
	}
	private function getPublic($pathToKey) {
		echo 'getting public:';
		var_dump(file_get_contents($pathToKey.'.pub'));
		return openssl_pkey_get_public($pathToKey.'.pub');
	}
	function decrypt($pathToKey, $passphrase, $encryptedData) {
		$privateKey = $this->getPrivate($pathToKey, $passphrase);
		openssl_private_decrypt($encryptedData, $sensitiveData, $privateKey);
		return $sensitiveData;
	}
	function encrypt($pathToKey, $sensitiveData) {
		$pubKey = $this->getPublic($pathToKey);
var_dump($pubKey);
		openssl_public_encrypt($sensitiveData, $encryptedData, $pubKey);
var_dump($encryptedData);
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
		$encrypted = $this->encryptor->encrypt($keyPair, $clearData);
		$cmd = "curl http://localhost/untrustedStore.php?cmd=SET&channel=$ch&key=$key&value=$encrypted";
		var_dump($cmd);
		$ret = `$cmd`;
		var_dump($ret);
	}
	function receive($ch, $key) {
		$cmd = "curl http://localhost/untrustedStore.php?cmd=GET&channel=$ch&key=$key";
		var_dump($cmd);
		$ret = `$cmd`;
		var_dump($ret);
		return $this->encryptor->decrypt($keyPair, $this->pwd, $ret);
	}
}

$unhostedProxy = new UnhostedProxy();
$ch = $unhostedProxy->createChannel();
$unhostedProxy->send($ch, 'status', 'hoestermee');
var_dump($unhostedProxy->receive($ch, 'status'));
