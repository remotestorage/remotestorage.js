<?php

require_once('../unhosted_includes/init.php');

if(isset($_GET['q'])) {
	header('Content-Type: application/xml+xrd');
	//header('Content-Type: text/xml');

	echo "<?xml version='1.0' encoding='UTF-8'?>\n";
	echo "<XRD xmlns='http://docs.oasis-open.org/ns/xri/xrd-1.0'\n"; 
	echo "      xmlns:hm='http://host-meta.net/xrd/1.0'>\n";
	echo "  <hm:Host xmlns='http://host-meta.net/xrd/1.0'>" . UnhostedSettings::domain . "</hm:Host>\n";
	echo "  <Link rel='http://unhosted.org/spec/dav/0.1'\n";
	echo "      href='http://" . UnhostedSettings::domain . "/'>\n";
	echo "  </Link>\n";
	echo "</XRD>\n";
}
