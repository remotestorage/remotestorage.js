<?php
define('CLOUD_NAME', 'demo.unhosted.org');

class UnhostedJsonParser {
	function checkPubSign($pub, $cmd, $PubSign) {
		$pubR = str_replace(array('_','-'), array('/','+'), $pub);
		$pubKey = "-----BEGIN PUBLIC KEY-----\n".chunk_split($pubR, 64, "\n")."-----END PUBLIC KEY-----\n";
		$ok = openssl_verify($cmd, base64_decode($PubSign), $pubKey);
		echo "\n\nchecking:\n$cmd\n$PubSign\n$pub\n";
		return ($ok == 1);//bool success
	}
	function parseKey($key) {
		$res = preg_match('/(?P<app>\w+)\+(?P<pub>[\w_-]+)@(?P<cloud>[\w\.]+)\/(?P<path>\w+)/', $key, $matches);
		if(!$res) { // zero (no match) or false (error)
			throw new Exception("key '$key' not parsable in format app+pub@cloud/path");
		}
		return array(
			$matches['app'],
			$matches['pub'],
			$matches['cloud'],
			$matches['path'],
			);
	}
	function parseInput($backend) {
		if(!isset($_POST['protocol'])) {
			throw new Exception('please add a "protocol" key to your POST');
		}
		if($_POST['protocol'] != 'UJ/0.1') {
			throw new Exception('please use "UJ/0.1" as the protocol');
		}
		if(!isset($_POST['cmd'])) {
			throw new Exception('please add "cmd" key to your POST');
		}
		try {
			$cmd = json_decode($_POST['cmd'], TRUE);//in JSON, associative arrays are objects; ", TRUE" is for forcing cast from StdClass to assoc array.
		} catch(Exception $e) {
			throw new Exception('the "cmd" key in your POST does not seem to be valid JSON');
		}
		if(!isset($cmd['method'])) {
			throw new Exception('please define a method inside your command');
		}
		switch($cmd['method']) {
		case 'SET':
			if(!isset($_POST['PubSign'])) {
				throw new Exception('The SET command requires a PubSign');
			}
			if(!isset($cmd['key'])) {
				throw new Exception('Please specify which key you\'re setting');
			}
			list($app, $pub, $cloud, $path) = $this->parseKey($cmd['key']);
			if(!isset($cmd['value'])) {
				throw new Exception('Please specify a value for the key you\'re setting');
			}
			if($app != $_SERVER['HTTP_REFERER']) {
				throw new Exception('You seem to be trying to set a key for a different app than what your document.domain is set to.');
			}
			if($cloud != CLOUD_NAME) {
				throw new Exception('You seem to be trying to set a key for a different cloud than this one. Relaying denied.');
			}
			if(!$this->checkPubSign($pub, $_POST['cmd'], $_POST['PubSign'])) {
				throw new Exception('Your PubSign does not correctly sign this command with this pub.');
			}
			return $backend->doSET($app, $pub, $path, $cmd['value']);
		case 'GET':
			if(!isset($cmd['key'])) {
				throw new Exception('Please specify which key you\'re getting');
			}
			list($app, $pub, $cloud, $path) = $this->parseKey($cmd['key']);
			if($app != $_SERVER['HTTP_REFERER']) {
				throw new Exception('You seem to be trying to get a key for a different app than what your document.domain is set to.');
			}
			if($cloud != CLOUD_NAME) {
				throw new Exception('You seem to be trying to set a key for a different cloud than this one. Relaying denied.');
			}
			return $backend->doGET($app, $pub, $path);
		default:
			throw new Exception('undefined method');
		}
	}
}

class StorageBackend {
	function makeFileName($app, $pub, $path) {
		return "/tmp/$app.$pub.$path";
	}
	function doSET($app, $pub, $path, $value) {
		file_put_contents($this->makeFileName($app, $pub, $path), $value);
	}
	function doGET($app, $pub, $path) {
		return file_get_contents($this->makeFileName($app, $pub, $path));
	}
}
$unhostedJsonParser = new UnhostedJsonParser();
$storageBackend = new StorageBackend();
try {
	$res = $unhostedJsonParser->parseInput($storageBackend);
	echo "OK\n" . $res . "\n";
} catch (Exception $e) {
	echo "ERROR\n" . $e->getMessage() . "\n";
}
