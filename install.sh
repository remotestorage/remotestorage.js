apt-get update
apt-get upgrade
wget --no-check-certificate https://github.com/michiel-unhosted/unhosted/tarball/master
tar -xzvf master
apt-get install libapache2-mod-php5
mv michiel-unhosted-unhosted-* /var/www/my-unhosted-website
cd /var/www/my-unhosted-website/
mv apache2.conf /etc/apache2/sites-available/dev.unhosted.org
cd /etc/apache2/sites-enabled/
rm 000-default 
ln -s ../sites-available/dev.unhosted.org 001-dev.unhosted.org
mkdir -p /var/www/my-unhosted-website/dav/dev.unhosted.org
chown -R www-data /var/www/my-unhosted-website/dav/
a2enmod mod_dav
a2enmod dav
a2enmod dav_fs
a2enmod headers
/etc/init.d/apache2 restart

