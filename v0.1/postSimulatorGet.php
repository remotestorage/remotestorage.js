<?php
$pubser = "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCVZl_hiNbNsypM6ktlgJl_jCrE4kl1abMmmXQhenAAFd0ISCW5UACgGwMg74fHe0OcbZQWJ5L2-YPwn7wbhmuyFUMdWFQ23LE08sYYSEqggp6n6MQLgfattzWipDGZ3x2CNyh8RwiH5-rq10Biam-AGj4LXQ7z6CaVB3gXIaJhNQIDAQAB";
$_POST=array(
	'protocol' => 'UJ/0.1',
	'cmd' => json_encode(array(
		'method' => 'GET',
		'key' => "helloblog.com+$pubser@demo.unhosted.org/path",
		)),
	);
$_SERVER=array('HTTP_REFERER'=>'helloblog.com');

require_once 'unhosted.php';
