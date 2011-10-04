apt-get update
apt-get upgrade
apt-get install git libapache2-mod-php5 php5-sqlite
git clone git://gitorious.org/owncloud/owncloud.git
rm -rf /var/www/
mv owncloud/ /var/www
chown -R www-data /var/www
a2enmod rewrite
vim /etc/apache2/sites-enabled/000-default 
/etc/init.d/apache2 restart
