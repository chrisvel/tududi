require 'sinatra'
require 'sinatra/activerecord'
require 'securerandom'

require './app/models/user'
require './app/models/area'
require './app/models/project'
require './app/models/task'

require './app/helpers/authentication_helper'

require './app/routes/authentication_routes'
require './app/routes/tasks_routes'
require './app/routes/projects_routes'
require './app/routes/areas_routes'

helpers AuthenticationHelper

use Rack::MethodOverride

set :database_file, './app/config/database.yml'
set :views, proc { File.join(root, 'app/views') }
set :public_folder, 'public'

configure do
  enable :sessions
  set :sessions, httponly: true, secure: production?, expire_after: 2_592_000
  set :session_secret, ENV.fetch('SESSION_SECRET') { SecureRandom.hex(64) }
  set :session_secret,
      '740cca863278d6cbacb64dbdd41cfdb1598e8208ce9b9d29b0a1e7c1e1367ca1241d8048849ee88784731d43879c94f5b9f0a639135828d590a447acb2d98e1c'
end

use Rack::Protection

before do
  require_login
end

helpers do
  def current_path
    request.path_info
  end

  def partial(page, options = {})
    erb page, options.merge!(layout: false)
  end

  def priority_class(task)
    return 'text-success' if task.completed

    case task.priority
    when 'Medium' then 'text-warning'
    when 'High' then 'text-danger'
    else 'text-secondary'
    end
  end

  def nav_link(path, query_params = {}, project_id = nil)
    current_uri = request.path_info
    current_query = request.query_string

    current_params = Rack::Utils.parse_nested_query(current_query)

    is_project_page = current_uri.include?('/project/') && path.include?('/project/')

    is_active = if is_project_page
                  current_uri == path && (!project_id || current_uri.end_with?("/#{project_id}"))
                elsif !query_params.empty?
                  current_uri == path && query_params.all? { |k, v| current_params[k] == v }
                else
                  current_uri == path && current_params.empty?
                end

    classes = 'nav-link py-1 px-3'
    classes += ' active bg-dark' if is_active
    classes += ' link-dark' unless is_active

    classes
  end
end

get '/' do
  redirect '/inbox' if logged_in?

  erb :inbox
end

get '/inbox' do
  erb :inbox
end