if ENV['TUDUDI_INTERNAL_SSL_ENABLED'] == 'true'
  ssl_bind '0.0.0.0', '9292', {
    key: 'certs/server.key',
    cert: 'certs/server.crt',
    verify_mode: 'none'
  }
else
  bind 'tcp://0.0.0.0:9292'
end
