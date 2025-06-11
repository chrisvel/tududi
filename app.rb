require 'sinatra'
require 'sinatra/activerecord'
require 'securerandom'
require 'byebug'

# Models
require './app/models/user'
require './app/models/area'
require './app/models/project'
require './app/models/task'
require './app/models/tag'
require './app/models/note'
require './app/models/inbox_item'

# Services
require './app/services/task_summary_service'
require './app/services/url_title_extractor_service'
require './config/initializers/scheduler'
require './config/initializers/telegram_initializer'

# Helpers
require './app/helpers/authentication_helper'
require './app/routes/authentication_routes'
require './app/routes/tasks_routes'
require './app/routes/projects_routes'
require './app/routes/areas_routes'
require './app/routes/notes_routes'
require './app/routes/tags_routes'
require './app/routes/users_routes'
require './app/routes/inbox_routes'
require './app/routes/telegram_poller'
require './app/routes/telegram_routes'
require './app/routes/url_routes'

require 'sinatra/cross_origin'

helpers AuthenticationHelper

use Rack::MethodOverride

set :database_file, './app/config/database.yml'
set :views, proc { File.join(root, 'app/views') }
set :public_folder, 'public'

configure do
  enable :cross_origin
  enable :sessions

  # Session configuration
  secure_flag = production? && ENV['TUDUDI_INTERNAL_SSL_ENABLED'] == 'true'
  set :sessions, httponly: true,
                 secure: secure_flag,
                 expire_after: 2_592_000,
                 same_site: secure_flag ? :none : :lax
  set :session_secret, ENV.fetch('TUDUDI_SESSION_SECRET') { SecureRandom.hex(64) }

  # CORS configuration
  set :allow_origin, ['http://localhost:8080', 'http://localhost:9292', 'http://127.0.0.1:8080', 'http://127.0.0.1:9292']
  set :allow_methods, %i[get post patch delete options]
  set :allow_credentials, true
  set :max_age, '1728000'
  set :expose_headers, ['Content-Type']
  set :allow_headers, %w[Authorization Content-Type Accept X-Requested-With]

  # Ensure ActiveRecord connection is established
  ActiveRecord::Base.establish_connection

  # Auto-create user if not exists
  if ENV['TUDUDI_USER_EMAIL'] && ENV['TUDUDI_USER_PASSWORD'] && ActiveRecord::Base.connection.table_exists?('users')
    user = User.find_or_initialize_by(email: ENV['TUDUDI_USER_EMAIL'])
    if user.new_record?
      user.password = ENV['TUDUDI_USER_PASSWORD']
      user.save
    end
  end

  # Initialize the Telegram polling after database is ready
  initialize_telegram_polling
end

# Rack Protection configuration - completely disable for development
if development?
  # Disable Rack::Protection completely in development to avoid CSRF issues
  set :protection, false
else
  use Rack::Protection,
      except: %i[remote_token session_hijacking remote_referrer],
      origin_whitelist: ['http://localhost:8080', 'http://localhost:9292', 'http://127.0.0.1:8080', 'http://127.0.0.1:9292']
end

before do
  # Handle CORS preflight requests
  if request.request_method == 'OPTIONS'
    response.headers['Access-Control-Allow-Methods'] = settings.allow_methods.map(&:to_s).join(', ')
    response.headers['Access-Control-Allow-Headers'] = settings.allow_headers.join(', ')
    response.headers['Access-Control-Max-Age'] = settings.max_age
    halt 200
  end

  # Set CORS headers for all requests
  if request.env['HTTP_ORIGIN'] && settings.allow_origin.include?(request.env['HTTP_ORIGIN'])
    response.headers['Access-Control-Allow-Origin'] = request.env['HTTP_ORIGIN']
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    response.headers['Access-Control-Expose-Headers'] = settings.expose_headers.join(', ')
  end

  # Authentication check
  require_login unless request.path_info == '/api/login'
end

helpers do
  def current_path
    request.path_info
  end

  def partial(page, options = {})
    erb page, options.merge!(layout: false)
  end

  def nav_link_active?(path, query_params = {}, project_id = nil)
    current_uri = request.path_info
    current_query = request.query_string
    current_params = Rack::Utils.parse_nested_query(current_query)
    is_project_page = current_uri.include?('/project/') && path.include?('/project/')

    if is_project_page
      current_uri == path && (!project_id || current_uri.end_with?("/#{project_id}"))
    elsif !query_params.empty?
      current_uri == path && query_params.all? { |k, v| current_params[k] == v }
    else
      current_uri == path && current_params.empty?
    end
  end

  def nav_link(path, query_params = {}, project_id = nil)
    is_active = nav_link_active?(path, query_params, project_id)

    classes = 'nav-link py-1 px-3'
    classes += ' active-link' if is_active

    classes
  end

  def update_query_params(key, value)
    uri = URI(request.url)
    params = Rack::Utils.parse_nested_query(uri.query)
    params[key] = value
    Rack::Utils.build_query(params)
  end

  def url_without_tag
    uri = URI(request.url)
    params = Rack::Utils.parse_nested_query(uri.query)
    params.delete('tag') # Remove the 'tag' parameter
    uri.query = Rack::Utils.build_query(params)
    uri.to_s
  end
end

get '/' do
  erb :index
end

# Catch-all route for non-API routes to serve the SPA
get '*' do
  pass if request.path_info.start_with?('/api/')
  erb :index
end

not_found do
  content_type :json
  status 404
  { error: 'Not Found', message: 'The requested resource could not be found.' }.to_json
end
