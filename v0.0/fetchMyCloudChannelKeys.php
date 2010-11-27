<?php
$POST=unserialize(file_get_contents('/tmp/tmp.txt'));
echo json_encode($POST);
