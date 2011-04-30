THIS CODE MIGHT NOT CURRENTLY WORK. WE ARE WORKING ON IT RIGHT NOW IN irc://irc.freenode.net/unhosted
======================

* get a server with apache and php. For instance, you can get debian lenny server at rackspace, ssh to it as root, and run:
  * apt-get update
  * apt-get upgrade
  * apt-get install libapache2-mod-php5
* point a domain name (sub-domains are OK) to the server, which will be the domain of your unhosted web app.
* download this directory from https://github.com/michiel-unhosted/unhosted/tarball/master and unpack it ('tar -xzvf master') into the appropriate directory (for instance /var/www/my-unhosted-website/) on your server. So there should be /var/www/my-unhosted-website/www/, /var/www/my-unhosted-website/dav/, and some miscellaneous files.
* among the miscellaneous files there is an apache2.conf which should work for you if you edit it a little bit (we're still automating this).
* restart apache
* open the website in your browser.
* follow instructions from there.
* you still need to manually edit /.well-known/host-meta, /unhosted/config.js and /unhosted/config.php, to point to your own domain.

Please see [http://github.com/michiel-unhosted/myfavouritesandwich](http://github.com/michiel-unhosted/myfavouritesandwich) (client-side) and [http://github.com/michiel-unhosted/DemoRedlibreOrg](http://github.com/michiel-unhosted/DemoRedlibreOrg) (server-side) while we refurbish this repository to contain the latest version of App, The Data, and Everything.
