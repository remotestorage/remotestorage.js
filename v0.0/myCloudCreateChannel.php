<?php
file_put_contents('/tmp/tmp.txt', serialize($_POST));
var_dump($_POST);
