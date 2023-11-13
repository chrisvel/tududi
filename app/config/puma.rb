ssl_bind '0.0.0.0', '9292', {
  key: 'certs/server.key',
  cert: 'certs/server.crt',
  verify_mode: 'none'
}
