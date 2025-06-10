module AuthenticationHelper
  def logged_in?
    !!session[:user_id]
  end

  def current_user
    @current_user ||= User.find(session[:user_id]) if session[:user_id]
  end

  def require_login
    return if ['/api/login', '/api/logout', '/api/current_user'].include?(request.path_info)

    return if logged_in?

    if request.xhr? || request.path_info.start_with?('/api/')
      halt 401, { error: 'You must be logged in' }.to_json
    else
      redirect '/login'
    end
  end
end
