<?php

require_once 'config.php';

class UnhostedAccount {
	private $userAddress, $userName, $userDomain, $pwd;
	function __construct($userAddress, $pwd) {
		$this->userAddress = $userAddress;
		list($this->userName, $this->userDomain) = explode("@", $userAddress);
		if((!strlen($this->userName)) || (!strlen($this->userDomain))) {
			die("'$userAddress' not a valid user address");
		}
		$this->pwd = $pwd;
	}
	private function createUserDir() {
		$userDomainDir = UnhostedSettings::davDir . $this->userDomain . '/';
		$userDir = $userDomainDir . strtolower($this->userName);
		if(is_dir($userDir)) {
			return false;
		}
		if(!file_exists($userDomainDir)) {
			mkdir($userDomainDir);
		}
		if(!file_exists($userDir)) {
			mkdir($userDir);
		}
		file_put_contents($userDir."/.htpasswd", sha1($this->pwd));
		return true;
	}
	private function createDav($scope) {
		$scope = ereg_replace("[^A-Za-z0-9\.]", "", $scope);
		if($scope[0] == '.') {
				return "invalid-scope";
		}
		$token = base64_encode(mt_rand());
		$davDir = UnhostedSettings::davDir . "{$this->userDomain}/{$this->userName}/".$scope;
		if(!file_exists($davDir)) {
			mkdir($davDir, 0600);
		}
		file_put_contents("<LimitExcept OPTIONS HEAD GET>\n"
			."  AuthType Basic"
			."  AuthName \"http://unhosted.org/spec/dav/0.1\""
			."  Require valid-user"
			."  AuthUserFile $davDir/.htpasswd"
			."</LimitExcept>"
			."Header always set Access-Control-Allow-Origin \"http://$scope\"", $davDir/.htaccess);
		$htpasswd = $this->userAddress .':'. crypt($token, base64_encode($token));
		file_put_contents($htpasswd, $davDir/.htpasswd);
		return $token;
	}
	private function createWallet($davBaseUrl, $davToken, $cryptoPwd, $dataScope) {
		$wallet = json_encode(array(
			"userAddress" => $userAddress,
			"davBaseUrl" => $davBaseUrl,
			"davAuth" => base64_encode($userAddress .':'. $davToken),
			"cryptoPwd" => $cryptoPwd
			));
		$walletDomainDir = UnhostedSettings::walletDir . $this->userDomain ."/";
		$walletUserDir = $walletDomainDir . $this->userName . "/";
		$walletDir = $walletUserDir . $dataScope;
		if(!file_exists($walletDomainDir)) {
			mkdir($walletDomainDir);
		}
		if(!file_exists($walletUserDir)) {
			mkdir($walletUserDir);
		}
		if(!file_exists($walletDir)) {
			mkdir($walletDir);
		}
		file_put_contents($walletDir.'/'.sha1($this->pwd), $wallet);
		return $wallet;
	}
	public function getWallet($dataScope) {
		$walletDir = UnhostedSettings::walletDir . "{$this->userDomain}/{$this->userName}/".$dataScope;
		if(file_exists($walletDir.'/'.sha1($this->pwd))) {
			return file_get_contents($walletDir.'/'.sha1($this->pwd));
		} else {
			return false;
		}
	}
	public function registerHosted() {
		$this->createUserDir();
		$davToken = $this->createDav(UnhostedSettings::protocol . '://' . UnhostedSettings::domain . '/');
		return $this->createWallet(UnhostedSettings::protocol . '://' . UnhostedSettings::domain . '/', $davToken, null, UnhostedSettings::domain);
	}
	public function registerWallet($davBaseUrl, $davToken, $dataScope) {
		$cryptoPwd = sha1(mt_rand());
		return $this->createWallet($davBaseUrl, $davToken, $cryptoPwd, $dataScope);
	}
	public function addApp($dataScope) {
		$pwdFile = UnhostedSettings::davDir . "{$this->userDomain}/{$this->userName}/.htpasswd";
		if(file_exists($pwdFile) && sha1($this->pwd)==file_get_contents($pwdFile)) {
			return $this->createDav($dataScope);
		}
		return null;
	}
}
