exports.config = {
  backends: { statics: 80 },
  redirect: {
    "unhosted.nodejitsu.com": "unhost.it"
  },
  domainsDir: 'files/'
};
