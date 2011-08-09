This SDK is still under construction. You can help develop it.

It contains two parts: a node.js app, and an ownCloud app. Together, they make up https://myfavouritesandwich.org. You can install them yourself, so that you can control your own sandwich ingredient data. Before you can run the node.js app, you need to install node.js, and before you can run the ownCloud app you need to install ownCloud. Here's how you do both, on a Debian Squeeze:

#initialize debian squeeze with dependencies:
apt-get update
apt-get upgrade
apt-get install python libssl-dev g++ make curl git

#install node:
curl http://nodejs.org/dist/node-v0.4.1.tar.gz
tar -xzvf node-v0.4.1.tar.gz 
cd node-v0.4.1
./configure 
make

#install npm:
curl http://npmjs.org/install.sh | sh

#install redis:
npm install redis
wget http://redis.googlecode.com/files/redis-2.2.12.tar.gz
tar -xzvf redis-2.2.12.tar.gz 
cd redis-2.2.12
make
echo daemonize yes >> redis.conf
src/redis-server redis.conf

mkdir /root/ssl-cert/
#^ put your startssl cert in here (ssl.key, ssl.crt, and the intermediate pem)

#install apache-ssl on port 444:
apt-get install libapache2-mod-php5 mysql-server php5-mysql
#^ here, choose a mysql server password, and remember it.

vim /etc/apache2/ports.conf 
#^ here, comment out the lines for port 80, and change port 443 to 444 twice.

vim /etc/apache2/sites-available/default-ssl 
#^ here, change port 443 to 444 once, and link to the three files that you stored in /root/ssl-cert

a2dissite default
a2enmod ssl
/etc/init.d/apache2 restart
a2ensite default-ssl

#install ownCloud:
cd /var
rmdir www
git clone git://anongit.kde.org/owncloud
mv owncloud www
chown www-data www
chown www-data www/config

#now browse to https://yourdomain.com:444/ and fill in the following values on the install screen:
#admin account username and password -> pick something and remember. take care to type the password right the first time.
#mysql username: root, password: the one you set during mysql installation earlier.
#database name: owncloud

#if you mess up, do:
# mysql -u root -p -e "delete from user where User like 'oc_mysql_%'" mysql
# mysql -u root -p -e "drop database owncloud"
# rm /var/www/config/config.php
#

#start node:
cd /root/mfs
node server.js

