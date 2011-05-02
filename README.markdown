Please log in to irc://irc.freenode.net/unhosted so we can help you get this working on your server.
======================

This code is published under the AGPL license. It is an unhosted website which you can change to turn it into your 
own unhosted web app. This code is still quite young, and should be considered 'alpha'. We welcome your suggestions
and improvements! Here's how you install it:

Get a server with apache and php. For instance, you can get debian lenny server at rackspace, ssh to it as root, and run:

	apt-get update
	apt-get upgrade
	apt-get install libapache2-mod-php5

Now point a domain name (sub-domains are OK) to the server, which will be the domain of your unhosted web app, and do the following (or equivalent):

	mkdir /var/www/my-unhosted-website
	cd /var/www/my-unhosted-website
	wget --no-check-certificate https://github.com/unhosted/unhosted/tarball/master
	tar -xzvf master
	mv michiel-unhosted-unhosted-*/www .
	mkdir dav
	mv michiel-unhosted-unhosted-*/apache2.conf /etc/apache2/sites-available/my-unhosted-website
	vim /etc/apache2/sites-available/my-unhosted-website
	a2ensite my-unhosted-website
	a2enmod dav
	a2enmod dav_fs
	a2enmod headers
	/etc/init.d/apache2 restart
	chown -R www-data /var/www/my-unhosted-website

After that, open the website in your browser and follow instructions from there.

Any bugs or problems, please report them straight into the irc channel and if it is during the daytime in either
Europe or the US while you read this, then we'll probably fix them right here and now.
The app should be easy to edit to do something more useful than store sandwich ingredients. The app code is on index.html 
and in the body onload event, it uses:

	var unhosted = Unhosted();
	unhosted.connect();
	unhosted.get("favSandwich");
	unhosted.getUserName();

If the user is not logged in, then the connect() command will resolve that by presenting the user with all the necessary login
and register screens. When you save the sandwich, it uses:

	unhosted.set("favSandwich", value);


and when you close the app, it uses:

	unhosted.close();
