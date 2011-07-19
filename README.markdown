Please log in to #unhosted on irc.freenode.net so we can help you get this working on your server.
======================

This code is published under the AGPL license. It's what's on https://myfavouritesandwich.org/

This code is still quite young, and should be considered 'alpha'. We welcome your suggestions
and improvements! It requires:

	sudo apt-get apache2 libapache2-mod-php5 php5-curl

Make ./wallet writable by the webserver, then point your vhost to ./www

Take care when debugging, instead of:

	vim index.html

use:

	vim index.html ; echo >> myfavouritesandwich.appcache

Then refresh *twice* in your browser before seeing your edits in the browser. It takes a bit of getting used to.
