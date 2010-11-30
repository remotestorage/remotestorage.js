<?php
define('CLOUD_NAME', 'demo.unhosted.org');

//$tokens = array('7db31' => FALSE,
//		'0249e' => FALSE,
//		'140d9' => FALSE,
//		'0e09a' => FALSE,
//		'b3108' => FALSE,
//		'a13b4' => FALSE,
//		'fabf8' => FALSE,
//		'32960' => FALSE,
//		'f56b6' => FALSE,
//		'93541' => FALSE,
//		'b569c' => FALSE,
//		'7a981' => FALSE,
//		'cf2bb' => FALSE,
//		'7d2f0' => FALSE,
//		'98617' => FALSE,
//		'e1608' => FALSE,
//		'189a1' => FALSE,
//		);
//file_put_contents('/tmp/unhosted_tokens.txt', serialize($tokens));
//$chans = array('helloblog.com+7db310249e140d90e09ab3108a13b4fabf89e9996ef98f43a147dbc312a66a9cf3863ee23d532960f56b693541b569c7a981cf2bb7d2f098617e1608189a1051' => TRUE);
//file_put_contents('/tmp/unhosted_chans.txt', serialize($chans));

class openSslWrapper {
	private function makeLengthStr($length) {
		if($length < 128) {
			return chr($length);
		} else if($length < 256) {
			return chr(129).chr($length);
		} else {
			die('TODO: implement lengths >256');
		}
	}
	private function makeDER($type, $rawSeq) {
		return chr($type).$this->makeLengthStr(strlen($rawSeq)).$rawSeq;
	}
	private function makeASN1($ASNn, $ASNe) {
		return 	$this->makeDER(48, 
				$this->makeDER(48, 
					$this->makeDER(6, 
						chr(42).chr(134).chr(72).chr(134).chr(247).chr(13).chr(1).chr(1).chr(1)
					)
					.$this->makeDER(5, 
						''
					)
				)
				.$this->makeDER(3, 
					chr(0)
					.$this->makeDER(48, 
						$this->makeDER(2, 
							chr(0)
							.base64_decode($ASNn)
						)
						.$this->makeDER(2, 
							base64_decode($ASNe)
						)
					)
				)
			);
	}
	private function makePCKS_1($ASNn, $ASNe) {
		$pubR = base64_encode($this->makeASN1($ASNn, $ASNe));
		return "-----BEGIN PUBLIC KEY-----\n".chunk_split($pubR, 64, "\n")."-----END PUBLIC KEY-----\n";
	}
	private function deUrlify($str) {
		$ret = str_replace(array('_','-'), array('/','+'), $str);
		while(strlen($ret) % 4 != 0) {
			$ret .= '=';
		}
		return $ret;
	}
	public function checkPubSign($pub, $cmd, $PubSign) {
		$ASNn = $this->deUrlify($pub);
		$signature = base64_decode($this->deUrlify($PubSign));
		$ASNe = 'AQAB';
		$pcks_1 = $this->makePCKS_1($ASNn, $ASNe);
		$ok = openssl_verify($cmd, $signature, $pcks_1);
		//echo "\n\nchecking:\n$cmd\n$PubSign\n$pub\n";
		return ($ok == 1);//bool success
	}
}
class UnhostedJsonParser {
	function isPubAllowed($app, $pub) {
		$chans = unserialize(file_get_contents('/tmp/unhosted_chans.txt'));
//		var_dump($chans[$app.'+'.$pub]));
		return (isset($chans[$app.'+'.$pub]));
	}

	function parseKey($key) {
		$res = preg_match('/(?P<app>[\w.]+)\+(?P<pub>[\w-_]+)@(?P<cloud>[\w\.]+)\/(?P<path>\w+)/', $key, $matches);
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
			if(!$this->isPubAllowed($app, $pub)) {
				throw new Exception('Please add your pub to the PubCrawl before publishing to it.');
			}

			//MOVING PubSign CHECKING TO THE BROWSER. IN THE END WE WILL ALSO NEED IT HERE, THOUGH, TO PREVENT ROLLBACK ATTACKS BY THIRD PARTIES:
			//$openSslWrapper = new OpenSslWrapper();
			//if(!$openSslWrapper->checkPubSign($pub, $_POST['cmd'], $_POST['PubSign'])) {
			//	throw new Exception('Your PubSign does not correctly sign this command with this pub.');
			//}

			return $backend->doSET($app, $pub, $path, $cmd, $_POST['PubSign']);
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
		case 'CREATE':
			if(!isset($cmd['token'])) {
				throw new Exception('Please provide a token for creating a new pub');
			}
			if(!isset($cmd['app'])) {
				throw new Exception('Please specify the app you want to create a new pub for');
			}
			if(!isset($cmd['pub'])) {
				throw new Exception('Please specify the pub you want to create for app '.$cmd['app']);
			}
			$tokens = unserialize(file_get_contents('/tmp/unhosted_tokens.txt'));
			if(!isset($tokens[$cmd['token']])) {
				throw new Exception('Token '.$cmd['token'].' is not a valid channel creation token.');
			}
			if($tokens[$cmd['token']] != FALSE) {
				throw new Exception('Token '.$cmd['token'].' is already in use.');
			}
			$chans = unserialize(file_get_contents('/tmp/unhosted_chans.txt'));
			$tokens[$cmd['token']] = $cmd['app'].'+'.$cmd['pub'];
			$chans[$cmd['app'].'+'.$cmd['pub']] = TRUE;
			file_put_contents('/tmp/unhosted_chans.txt', serialize($chans));
			file_put_contents('/tmp/unhosted_tokens.txt', serialize($tokens));
			break;
		default:
			throw new Exception('undefined method');
		}
	}
}

class StorageBackend {
	function makeFileName($app, $pub, $path) {
		return "/tmp/unhosted_$app.$pub.$path";
	}
	function doSET($app, $pub, $path, $cmd, $PubSign) {
		$fileName = $this->makeFileName($app, $pub, $path);
		$save=json_encode(array(
			'cmd'=>$cmd,
			'PubSign'=>$PubSign
			));
		$res = file_put_contents($fileName, $save);
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
