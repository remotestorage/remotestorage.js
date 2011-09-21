<?php

require_once 'config.php';

class UnhostedAccount {
	private $userAddress, $userName, $userDomain, $pwd;
	function __construct($userAddress, $pwd) {
		$this->userAddress = $userAddress;
		list($this->userName, $this->userDomain) = explode('@', $userAddress);
		$this->pwd = $pwd;
	}
	private function createUserDir() {
		$userPwdDomainDir = UnhostedSettings::pwdDir . $this->userDomain . '/';
		$userPwdDir = $userPwdDomainDir . strtolower($this->userName);
		$userDavDomainDir = UnhostedSettings::davDir . $this->userDomain . '/';
		$userDavDir = $userDavDomainDir . strtolower($this->userName);
		if(is_dir($userDavDir)) {
			return false;
		}
		foreach(array($userPwdDomainDir, $userPwdDir, $userDavDomainDir, $userDavDir) as $dir) {
			if(!file_exists($dir)) {
				mkdir($dir, 0700);
			}
		}
		file_put_contents($userPwdDir."/.pwd", sha1($this->pwd));
		return true;
	}
	private function createDav($dataScope) {
		$token = base64_encode(mt_rand());
		$davDir = UnhostedSettings::davDir . "{$this->userDomain}/{$this->userName}/".$dataScope;
		if(!file_exists($davDir)) {
			mkdir($davDir, 0700);
		}
		file_put_contents($davDir.'/.htaccess',
			"AuthType Basic\n"
			."AuthName \"your unhosted data\"\n"
			."AuthUserFile $davDir/.htpasswd\n"
			."<LimitExcept OPTIONS GET>\n"
			."  Require valid-user\n"
			."</LimitExcept>\n"
			."SetEnvIf Origin \"(.+)\" ORIGIN=\$1\n"
			."Header always set Access-Control-Allow-Origin %{ORIGIN}e\n");
		file_put_contents($davDir.'/.htpasswd', $this->userAddress .':'. crypt($token, base64_encode($token))."\n");
		return $token;
	}
	private function createWallet($davProtocol, $davDomain, $davToken, $cryptoPwd, $dataScope) {
		$wallet = json_encode(array(
			"userAddress" => $this->userAddress,
			"davBaseUrl" => $davProtocol.'://'.$davDomain,
			"davToken" => $davToken,
			"davAuth" => base64_encode($this->userAddress .':'. $davToken),
			"cryptoPwd" => $cryptoPwd
			));
		$walletDomainDir = UnhostedSettings::walletDir . $this->userDomain ."/";
		$walletUserDir = $walletDomainDir . $this->userName . "/";
		$walletDir = $walletUserDir . $dataScope;
		if(!file_exists($walletDomainDir)) {
			mkdir($walletDomainDir, 0700);
		}
		if(!file_exists($walletUserDir)) {
			mkdir($walletUserDir, 0700);
		}
		if(!file_exists($walletDir)) {
			mkdir($walletDir, 0700);
		}
		file_put_contents($walletDir.'/'.sha1($this->pwd), $wallet);
		return $wallet;
	}
	public function getWallet($dataScope, $allowCreation) {
		$walletDir = UnhostedSettings::walletDir . "{$this->userDomain}/{$this->userName}/".$dataScope;
		if(file_exists($walletDir.'/'.sha1($this->pwd))) {
			return file_get_contents($walletDir.'/'.sha1($this->pwd));
		} else if($allowCreation) {
			$cryptoPwd = sha1(mt_rand());
			return $this->createWallet('', '', '', $cryptoPwd, $dataScope);
		} else {
			return false;
		}
	}
	public function registerLocal($dataScope) {
		if($this->createUserDir()) {
			$davToken = $this->createDav($dataScope);
			return $this->createWallet(UnhostedSettings::protocol, UnhostedSettings::domain . '/', $davToken, null, $dataScope);
		} else {
			return 'user exists';
		}
	}
	public function addApp($dataScope) {
		$pwdFile = UnhostedSettings::pwdDir . "{$this->userDomain}/{$this->userName}/.pwd";
		if(file_exists($pwdFile) && sha1($this->pwd)==file_get_contents($pwdFile)) {
			return $this->createDav($dataScope);
		}
		return null;
	}
}
