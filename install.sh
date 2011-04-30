wget --no-check-certificate https://github.com/michiel-unhosted/unhosted/tarball/master
tar -xzvf master
mv michiel-unhosted-unhosted-* /var/www/my-unhosted-website
cd /var/www/my-unhosted-website/
mkdir -p /var/www/my-unhosted-website/dav/
chown -R www-data /var/www/my-unhosted-website/dav/
