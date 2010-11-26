<?php
define('CLOUD_NAME', 'demo.unhosted.org');
define('PUB_DEMO_1', 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCVZl_hiNbNsypM6ktlgJl_jCrE4kl1abMmmXQhenAAFd0ISCW5UACgGwMg74fHe0OcbZQWJ5L2-YPwn7wbhmuyFUMdWFQ23LE08sYYSEqggp6n6MQLgfattzWipDGZ3x2CNyh8RwiH5-rq10Biam-AGj4LXQ7z6CaVB3gXIaJhNQIDAQAB');

class UnhostedJsonParser {
	function isPubAllowed($pub) {
		$pubCrawl = array(
			PUB_DEMO_1,
			);
		return (in_array($pub, $pubCrawl));
	}
	function checkPubSign($pub, $cmd, $PubSign) {
		$pubR = str_replace(array('_','-'), array('/','+'), $pub);
		$pubKey = "-----BEGIN PUBLIC KEY-----\n".chunk_split($pubR, 64, "\n")."-----END PUBLIC KEY-----\n";
		$ok = openssl_verify($cmd, base64_decode($PubSign), $pubKey);
		//echo "\n\nchecking:\n$cmd\n$PubSign\n$pub\n";
		return ($ok == 1);//bool success
	}
	function parseKey($key) {
		$res = preg_match('/(?P<app>[\w.]+)\+(?P<pub>[\w_-]+)@(?P<cloud>[\w\.]+)\/(?P<path>\w+)/', $key, $matches);
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
			$refererParsed = parse_url($_SERVER['HTTP_REFERER']);
			$refererDomain = $refererParsed['host'];
			if($app != $refererDomain) {
				throw new Exception("You seem to be trying to set a key for a different app ($app) than what your document.domain is set to ($refererDomain)");
			}
			if($cloud != CLOUD_NAME) {
				throw new Exception("You seem to be trying to set a key for a different cloud ($cloud) than this one (".CLOUD_NAME."). Relaying denied.");
			}
			if(!$this->isPubAllowed($pub)) {
				throw new Exception('Please add your pub to the PubCrawl before publishing to it.');
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
			$refererParsed = parse_url($_SERVER['HTTP_REFERER']);
			$refererDomain = $refererParsed['host'];
			if($app != $refererDomain) {
				throw new Exception("You seem to be trying to set a key for a different app ($app) than what your document.domain is set to ($refererDomain)");
			}
			if($cloud != CLOUD_NAME) {
				throw new Exception("You seem to be trying to set a key for a different cloud ($cloud) than this one (".CLOUD_NAME."). Relaying denied.");
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
		$fileName = $this->makeFileName($app, $pub, $path);
		$res = file_put_contents($fileName, $value);
		if($res === false) {
			throw new Exception("Server error - could not write '$fileName'");
		}
	}
	function doGET($app, $pub, $path) {
		$fileName = $this->makeFileName($app, $pub, $path);
		if(is_readable($fileName)) {
			return file_get_contents($fileName);
		} else {
			return 'null';
		}
	}
}


//MAIN:
header('Content-Type: text/html');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Max-Age: 86400');
$unhostedJsonParser = new UnhostedJsonParser();
$storageBackend = new StorageBackend();
try {
	$res = $unhostedJsonParser->parseInput($storageBackend);
	echo $res;
} catch (Exception $e) {
	echo "ERROR\n" . $e->getMessage() . "\n";
}
