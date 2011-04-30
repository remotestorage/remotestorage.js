apt-get update
apt-get upgrade
apt-get install libapache2-mod-php5
mv apache2.conf /etc/apache2/sites-available/dev.unhosted.org
cd /etc/apache2/sites-enabled/
rm 000-default 
ln -s ../sites-available/dev.unhosted.org 001-dev.unhosted.org
a2enmod dav
a2enmod dav_fs
a2enmod headers
/etc/init.d/apache2 restart

