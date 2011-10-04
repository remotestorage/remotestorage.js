set up your own remoteStorage-compatible ownCloud instance on the indy web:
-----------------

1) do:
    apt-get update
    apt-get upgrade
    apt-get install git libapache2-mod-php5 php5-sqlite
    git clone git://gitorious.org/owncloud/owncloud.git
    rm -rf /var/www/
    mv owncloud/ /var/www
    chown -R www-data /var/www
    a2enmod rewrite

2) edit /etc/apache2/sites-enabled/000-default 
3) do:

    /etc/init.d/apache2 restart

4) visit http://yourremotestorage.com/
5) enable webfinger and remoteStorage apps
6) visit http://yourremotestorage.com/apps/user_webfinger/activate.php
7) test it on http://todo.jack-bowman.com/
