Please log in to #unhosted on irc.freenode.net so we can help you get this working on your server.
======================

This code is published under the AGPL license. It's what you need to build your own unhosted website, which means it consists of two halves:

* a 'hello world' unhosted web app which you can change to turn it into your own unhosted web app.
* an unhosted storage node: any user accounts you create on here automatically become usable as unhosted accounts on other 
people's unhosted websites.

This code is still quite young, and should be considered 'alpha'. We welcome your suggestions
and improvements! Here's how you install it:

Get a server with apache and php. For instance, you can get a debian lenny server at rackspace, ssh to it as root, and run (hitting enter to pick default options where necessary):

	apt-get update
	apt-get upgrade
	apt-get install libapache2-mod-php5
	a2dissite default

Disabling the default site should not be necessary, but I've found that it is. Now point a domain name (sub-domains are OK) to the server, which will be the domain of your unhosted web app, and put the contents of this tar ball on your server as a directory under the web root, owned by www-data. For instance like this (when ssh'ed into your server as root):

	wget --no-check-certificate -qO- https://github.com/unhosted/unhosted/tarball/devel | tar -xz
	mv unhosted-unhosted-* /var/www/my-unhosted-website
	chown -R www-data /var/www/my-unhosted-website

Edit line 3 of /var/www/my-unhosted-website/apache2.conf to replace 'www.example.com' with your own domain name.

Now configure apache:

	mv /var/www/my-unhosted-website/apache2.conf /etc/apache2/sites-available/my-unhosted-website
	a2ensite my-unhosted-website
	a2enmod dav_fs
	a2enmod headers
	/etc/init.d/apache2 restart

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
