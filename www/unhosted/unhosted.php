<?php
require_once('../../unhosted/init.php');

function registerScope($userAddress, $pwd, $scope) {
	list($userName, $userDomain) = explode("@", $userAddress);
	$pwdFile = UnhostedSettings::davDir . "$userDomain/$userName/.htpasswd";
	if(file_exists($pwdFile) && sha1($pwd)==file_get_contents($pwdFile)) {
		$token = base64_encode(mt_rand());
		$davDir = UnhostedSettings::davDir . "$userDomain/$userName/".$scope;
		`if [ ! -d $davDir ] ; then mkdir $davDir ; fi`;
		`echo "<LimitExcept OPTIONS HEAD GET>" > $davDir/.htaccess`;
		`echo "  AuthType Basic" >> $davDir/.htaccess`;
		`echo "  AuthName \"http://unhosted.org/spec/dav/0.1\"" >> $davDir/.htaccess`;
		`echo "  Require valid-user" >> $davDir/.htaccess`;
		`echo "  AuthUserFile $davDir/.htpasswd" >> $davDir/.htaccess`;
		`echo "</LimitExcept>" >> $davDir/.htaccess`;
		`htpasswd -bc $davDir/.htpasswd {$userAddress} $token`;
		return $token;
	}
	return null;
}
