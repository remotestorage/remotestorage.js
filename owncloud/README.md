set up your own remoteStorage-compatible ownCloud instance on the indy web:
-----------------

Current time record for this setup: [6 minutes 21 seconds](screencast.mpeg) (if you practice a little bit). ;)

1. get a debian server
2. do:

   * apt-get update
   * apt-get upgrade
   * apt-get install git libapache2-mod-php5 php5-sqlite
   * git clone git://gitorious.org/owncloud/owncloud.git
   * rm -rf /var/www/
   * mv owncloud/ /var/www
   * chown -R www-data /var/www
   * a2enmod rewrite

3. edit /etc/apache2/sites-enabled/000-default to set 'AllowOverride All' on /var/www
4. do:

   * /etc/init.d/apache2 restart

5. visit http://yourremotestorage.com/
6. enable webfinger and remoteStorage apps
7. visit http://yourremotestorage.com/apps/user_webfinger/activate.php
8. test it on http://unhosted.org/demo
