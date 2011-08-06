<?php

OC_APP::addSettingsPage(
	array(
		"id" => "unhosted_web_administration",
		"order" => 4,
		"href" => OC_HELPER::linkTo( "unhosted_web", "admin.php" ),
		"name" => "Unhosted Web",
		"icon" => OC_HELPER::imagePath( "unhosted_web", "island.png" )
	)
);


?>
