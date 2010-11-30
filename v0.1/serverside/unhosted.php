<?php
class UnhostedJsonParser {
	function checkWriteCaps($chan, $pwd) {
		//hard coded read => write caps, for demo:
		$chans = array(//chan => pwdChW:
			'7db31' => '0249e',
			'140d9' => '0e09a',
			'b3108' => 'a13b4',
			'fabf8' => '32960',
			'f56b6' => '93541',
			'b569c' => '7a981',
			'cf2bb' => '7d2f0',
			'98617' => 'e1608',
			);
		return ($chans[$chan]==$pwd);
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
			if(!isset($cmd['chan'])) {
				throw new Exception('Please specify which channel you want to publish on');
			}
			if(!isset($_POST['pwdChW'])) {
				throw new Exception('The SET command requires a channel write password');
			}
			if(!$this->checkWriteCaps($cmd['chan'], $_POST['pwdChW'])) {
				throw new Exception('Channel password is incorrect.');
			}
			if(!isset($cmd['keyPath'])) {
				throw new Exception('Please specify which key path you\'re setting');
			}
			if(!isset($cmd['value'])) {
				throw new Exception('Please specify a value for the key you\'re setting');
			}
			if(!isset($_POST['PubSign'])) {
				throw new Exception('Please provide a PubSign so that your subscriber can check that this set command really comes from you');
			}
			$refererParsed = parse_url($_SERVER['HTTP_REFERER']);
			$app = $refererParsed['host'];

			return $backend->doSET($cmd['chan'], $app, $cmd['keyPath'], $cmd, $_POST['PubSign']);
		case 'GET':
			if(!isset($cmd['chan'])) {
				throw new Exception('Please specify which channel you want to get a (key, value)-pair from');
			}
			if(!isset($cmd['keyPath'])) {
				throw new Exception('Please specify which key path you\'re getting');
			}
			$refererParsed = parse_url($_SERVER['HTTP_REFERER']);
			$app = $refererParsed['host'];
			return $backend->doGET($cmd['chan'], $app, $cmd['keyPath']);
		default:
			throw new Exception('undefined method');
		}
	}
}

class StorageBackend {
	function makeFileName($chan, $app, $keyPath) {
		return "/tmp/unhosted_{$chan}_{$app}_{$keyPath}_";
	}
	function doSET($chan, $app, $keyPath, $cmd, $PubSign) {
		$fileName = $this->makeFileName($chan, $app, $keyPath);
		$save=json_encode(array(
			'cmd'=>$cmd,
			'PubSign'=>$PubSign
			));
		$res = file_put_contents($fileName, $save);
		if($res === false) {
			throw new Exception("Server error - could not write '$fileName'");
		}
	}
	function doGET($chan, $app, $keyPath) {
		$fileName = $this->makeFileName($chan, $app, $keyPath);
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
