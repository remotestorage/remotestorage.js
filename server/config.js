exports.config = {
  protocol: 'http',
  host: 'local.dev',
  defaultUserName: 'me',
  port: 443,
  ssl: {
   cert: '/etc/ssl/certs/ssl-cert-snakeoil.pem',
   key: '/etc/ssl/private/ssl-cert-snakeoil.key'
  },
  initialTokens: {
    '4eb4b398c36e62da87469133e2f0cb3f9574d5b3865051': [':rw']
  }
}
