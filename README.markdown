THIS CODE MIGHT NOT CURRENTLY WORK.
======================

PLEASE LOG INTO irc://irc.freenode.net/unhosted SO WE CAN HELP YOU TO GET IT WORKING ON YOUR SERVER

* get a server with apache and php. For instance, you can get debian lenny server at rackspace, ssh to it as root, and run:
  * apt-get update
  * apt-get upgrade
  * apt-get install libapache2-mod-php5
* point a domain name (sub-domains are OK) to the server, which will be the domain of your unhosted web app.
* do the following, or equivalent:
  * mkdir /var/www/my-unhosted-website
  * cd /var/www/my-unhosted-website
  * wget --no-check-certificate https://github.com/michiel-unhosted/unhosted/tarball/master
  * tar -xzvf master
  * mv michiel-unhosted-unhosted-*/www .
  * mkdir dav
  * mv michiel-unhosted-unhosted-*/apache2.conf /etc/apache2/sites-available/my-unhosted-website
  * vim /etc/apache2/sites-available/my-unhosted-website
  * a2ensite my-unhosted-website
  * a2enmod dav
  * a2enmod dav_fs
  * a2enmod headers
  * /etc/init.d/apache2 restart
  * chown -R www-data /var/www/my-unhosted-website
* open the website in your browser.
* follow instructions from there.

Any bugs or problems, please report them straight into the irc channel and we'll fix them right here and now.
The app should be easy to edit to do something more useful than store sandwich ingredients. It is on index.html 
and on load, uses:

	var unhosted = Unhosted();
	unhosted.connect();
	unhosted.get("favSandwich");
	unhosted.getUserName();

When you save the sandwich, it uses:

	unhosted.set("favSandwich", value);


and when you close the app, it uses:

	unhosted.close();
