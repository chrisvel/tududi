require 'minitest/autorun'
require 'rack/test'
require_relative '../app'

class AppTest < Minitest::Test
  include Rack::Test::Methods

  def app
    Sinatra::Application
  end

  def setup
    ActiveRecord::Base.logger.level = Logger::WARN
    User.create(email: 'test@example.com', password: 'password')
  end

  def test_get_home
    post '/login', { email: 'test@example.com', password: 'password' }
    get '/'
    assert last_response.ok?
  end

  def test_get_inbox
    post '/login', { email: 'test@example.com', password: 'password' }
    get '/inbox'
    assert last_response.ok?
  end
end
