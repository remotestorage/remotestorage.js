<?php
class UntrustedStore { 

	function checkSig($channel, $key, $value) {
		return TRUE;
		$expPre = 'ENCR'.$channel.':';
		return (substr($value, 0, strlen($expPre)) === $expPre);
	}
	function create($channel, $token) {
		return TRUE;
	}
	function get($channel, $key) {
		return file_get_contents('/home/michiel/unhostedStore/'.$channel.'/'.$key);
	}
	function set($channel, $key, $value) {
		if(!$this->checkSig($channel, $key, $value)) {
			error("signature check failed $channel $key $value");
			return FALSE;
		}
		file_put_contents('/home/michiel/unhostedStore/'.$channel.'/'.$key, $value);
		return TRUE;
	}
	function append($channel, $key, $value) {
		error('not implemented yet');
		return FALSE;
	}
}

function debug($str) {
//	echo $str;
}

function error($str) {
	echo 'ERROR:' . $str;
}
function dispatch($GET) {
	debug(var_export($GET, true));
	switch($GET['cmd']) {
	case 'CREATE':
		debug('CREATE ch:'.$GET['channel'].' k:'.$GET['token']);
		$store = new UntrustedStore();
		$store->create($GET['channel'], $GET['token']);
		return 'OK';
	case 'GET':
		debug('GET ch:'.$GET['channel'].' k:'.$GET['key']);
		$store = new UntrustedStore();
		return $store->get($GET['channel'], $GET['key']);
		break;
	case 'SET':
		debug('SET ch:'.$GET['channel'].' k:'.$GET['key'].' v:'.$GET['value']);
		$store = new UntrustedStore();
		$store->set($GET['channel'], $GET['key'], $GET['value']);
		return 'OK';
	case 'APPEND':
		debug('APPEND ch:'.$GET['channel'].' k:'.$GET['key'].' v:'.$GET['value']);
		$store = new UntrustedStore();
		$store->append($GET['channel'], $GET['key'], $GET['value']);
		return 'OK';
	default: 
		error('command "?cmd='.$GET['cmd'].'" not recognised');
		return 'ERR';
	}
}

//main:
ini_set('display_errors', TRUE);
echo dispatch($_GET);
