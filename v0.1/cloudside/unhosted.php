<?php
//ini_set('display_errors', TRUE);
class UnhostedJsonParser {
	function checkWriteCaps($chan, $WriteCaps) {
		//hard coded read => write caps, change these to codes that only you know!:
		$chans = array(//r => w:
			'7db31' => '0249e',
			'140d9' => '0e09a',
			'b3108' => 'a13b4',
			'fabf8' => '32960',
			'f56b6' => '93541',
			'b569c' => '7a981',
			'cf2bb' => '7d2f0',
			'98617' => 'e1608',
			);
		return ($WriteCaps==$chans[$chan]);
	}
	function checkFieldsPresent($arr, $fields) {
		foreach($fields as $fieldName => $exceptionText) {
			if(!isset($arr[$fieldName])) {
				throw new Exception($exceptionText);
			}
		}
	}
	function parseInput($backend, $POST, $referer) {
		$this->checkFieldsPresent($POST, array(
			'protocol' => 'please add a "protocol" key to your POST',
			'cmd' => 'please add "cmd" key to your POST',
			));
		if($POST['protocol'] != 'UJ/0.1') { 
			throw new Exception('please use "UJ/0.1" as the protocol');
		}
		try {
			$cmd = json_decode($POST['cmd'], TRUE);//in JSON, associative arrays are objects; ", TRUE" is for forcing cast from StdClass to assoc array.
		} catch(Exception $e) {
			throw new Exception('the "cmd" key in your POST does not seem to be valid JSON');
		}
		$this->checkFieldsPresent($cmd, array('method' => 'please define a method inside your command'));

		switch($cmd['method']) {
		case 'SET':
			$this->checkFieldsPresent($POST, array(
				'WriteCaps' => 'The SET command requires WriteCaps in the POST',
				'PubSign' => 'Please provide a PubSign so that your subscriber can check that this SET command really comes from you'
				));
			$this->checkFieldsPresent($cmd, array(
				'chan' => 'Please specify which channel you want to publish on',
				'keyPath' => 'Please specify which key path you\'re setting',
				'value' => 'Please specify a value for the key you\'re setting',
				));
			if(!$this->checkWriteCaps($cmd['chan'], $POST['WriteCaps'])) {
				throw new Exception('Channel password is incorrect.');
			}
			return $backend->doSET(
				$cmd['chan'], 
				$referer['host'], 
				$cmd['keyPath'], 
				json_encode(array('cmd'=>$cmd, 'PubSign'=>$POST['PubSign']))
				);
		case 'GET':
			$this->checkFieldsPresent($cmd, array(
				'chan' => 'Please specify which channel you want to get a (key, value)-pair from',
				'keyPath' => 'Please specify which key path you\'re getting',
				));
			return $backend->doGET(
				$cmd['chan'],
				$referer['host'],
				$cmd['keyPath']
				);
		case 'SEND':
			if(!isset($POST['PubSign'])) {
				$POST['PubSign'] = null;
			}				
			$this->checkFieldsPresent($cmd, array(
				'chan' => 'Please specify which channel you want to send your message to',
				'keyPath' => 'Please specify which key path you\'re setting',
				'value' => 'Please specify a value for the key you\'re setting',
				));
			return $backend->doSEND(
				$cmd['chan'],
				$referer['host'],
				$cmd['keyPath'],
				json_encode(array('cmd'=>$cmd, 'PubSign'=>$POST['PubSign']))
				);
		case 'RECEIVE':
			$this->checkFieldsPresent($POST, array(
				'WriteCaps' => 'The RECEIVE command requires WriteCaps in the POST',
				));
			$this->checkFieldsPresent($cmd, array(
				'chan' => 'Please specify which channel you want to retrieve messages from',
				'keyPath' => 'Please specify which key path you\'re getting',
				));
			if(!$this->checkWriteCaps($cmd['chan'], $POST['WriteCaps'])) {
				throw new Exception('Channel password is incorrect.');
			}
			return $backend->doRECEIVE(
				$cmd['chan'],
				$referer['host'],
				$cmd['keyPath']
				);
		default:
			throw new Exception('undefined method');
		}
	}
}

class StorageBackend {
	function makeFileName($chan, $app, $keyPath, $forMessages = FALSE) {
		return "/tmp/unhosted_{$chan}_{$app}_{$keyPath}_".($forMessages?'msg':'key');
	}
	function doSET($chan, $app, $keyPath, $save) {
		$fileName = $this->makeFileName($chan, $app, $keyPath);
		$res = file_put_contents($fileName, $save);
		if($res === false) {
			throw new Exception("Server error - could not write '$fileName'");
		}
		return '"OK"';
	}
	function doGET($chan, $app, $keyPath) {
		$fileName = $this->makeFileName($chan, $app, $keyPath);
		if(is_readable($fileName)) {
			return file_get_contents($fileName);
		} else {
			return 'null';
		}
	}
	function doSEND($chan, $app, $keyPath, $cmd, $save) {
		$fileName = $this->makeFileName($chan, $app, $keyPath, TRUE);
		$res = file_put_contents($fileName, $save, FILE_APPEND);
		if($res === false) {
			throw new Exception("Server error - could not write '$fileName'");
		}
	}
	function doRECEIVE($chan, $app, $keyPath) {
		$fileName = $this->makeFileName($chan, $app, $keyPath, TRUE);
		if(is_readable($fileName)) {
			return file_get_contents($fileName);//delete messages after reading them?
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
	$referer = parse_url($_SERVER['HTTP_REFERER']);
	$res = $unhostedJsonParser->parseInput($storageBackend, $_POST, $referer);
	echo $res;
} catch (Exception $e) {
	echo "ERROR:\n" . $e->getMessage() . "\n";
}
