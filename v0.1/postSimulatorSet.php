<?php
//to generate a fresh key, uncomment these line instead of the explicit assignments below:
//$pri =  openssl_pkey_new();
//$keyDetails = openssl_pkey_get_details($pri);
//$pub = $keyDetails['key'];
//$pubser = str_replace(array('/','+'), array('_','-'), substr($pub, 27, 64).substr($pub, 92, 64).substr($pub, 157, 64).substr($pub, 222, 24));
//openssl_pkey_export($pri, $priE);
//var_dump($priE);
//var_dump($pubser);

$priE = "-----BEGIN RSA PRIVATE KEY-----\nMIICXAIBAAKBgQCVZl/hiNbNsypM6ktlgJl/jCrE4kl1abMmmXQhenAAFd0ISCW5\nUACgGwMg74fHe0OcbZQWJ5L2+YPwn7wbhmuyFUMdWFQ23LE08sYYSEqggp6n6MQL\ngfattzWipDGZ3x2CNyh8RwiH5+rq10Biam+AGj4LXQ7z6CaVB3gXIaJhNQIDAQAB\nAoGAFwKzldsrqncD9uDHSBTsj3aZR8XKpqjnDPTprBZdlcXIS3RBSy+FSSOf8byy\n3wifO0KtYlQqEJwRtEgGAv9LKuBXUtSt6kYjFouVJHu9PrqgCEVZhaTHKG9ku+jQ\nhwHXViGJ0auppcSovv50LEXufPHZZT8x6xT1GPq49IXxoWkCQQDGpfiiXD0dNerf\njLN1yiRK1heEMNuFb+EMDpkB+C0UVx/7Sk2a2Vnr/OthM+iKM/CGpq1P7rRq3cHM\nRXposDQrAkEAwIh4JoEoXHxwTapNUKhKgzCGHJqeWj4iEowlivtlH6BKkxzybTQQ\nQKWF8tlUIpwqk/0KI98CzV8yFpPEKYwwHwJAb/DpWn0GB2bx00XTf2YI648Xs2tg\n2SIBvKyhNoXmyVaLdC0b7E3dKWneLml0+iRov0g/1BJc4vfSFM12PHZG/wJBAIx3\nhGFjPdUsHKstIrdD8QkBr/bSf9GLH0S05vcdLswCICZwqhYuM+VWXgGtuYp+sTnD\nFVDSdbLsTxjVufouAzUCQBdk56XdIG/il9PgAImO1Ye0eOT9qlP0YHxRJwd9ZAHq\nQC3+w5IDOGOJ+HYH3MOgKH/oCdXMy6QZaGGmkaGS1fQ=\n-----END RSA PRIVATE KEY-----\n";
$pubser = "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCVZl_hiNbNsypM6ktlgJl_jCrE4kl1abMmmXQhenAAFd0ISCW5UACgGwMg74fHe0OcbZQWJ5L2-YPwn7wbhmuyFUMdWFQ23LE08sYYSEqggp6n6MQLgfattzWipDGZ3x2CNyh8RwiH5-rq10Biam-AGj4LXQ7z6CaVB3gXIaJhNQIDAQAB";

$cmd = json_encode(array(
	'method' => 'SET',
	'key' => "helloblog.com+$pubser@demo.unhosted.org/path",
	'value' => 'DEADBEEF',
	));

openssl_sign($cmd, $sign, $priE);
$PubSign = base64_encode($sign);

$_POST=array(
	'protocol' => 'UJ/0.1',
	'cmd' => $cmd,
	'PubSign' => $PubSign,
	);
$_SERVER=array('HTTP_REFERER'=>'helloblog.com');

require_once 'unhosted.php';
