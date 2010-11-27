<?php
ini_set('display_errors', TRUE);
require_once 'UnhostedStorage.php';
$backend = new UnhostedStorage();
//echo $backend->get($_POST['path']);
echo "getting {$_POST['path']}<br/>";
var_dump($backend->get($_POST['path']));
