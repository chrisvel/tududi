module AuthenticationHelper
  def logged_in?
    !!session[:user_id]
  end

  def current_user
    @current_user ||= User.find(session[:user_id]) if session[:user_id]
  end

  def require_login
    # Allow requests to '/login' and '/logout' without checking for login
    return if ['/login', '/logout', '/api/current_user'].include? request.path

    # If the user is not logged in and the request is not an API request, redirect to login
    return if logged_in?

    if request.xhr? || request.path.start_with?('/api/')
      halt 401, { error: 'You must be logged in' }.to_json # For API calls, return a 401 status
    else
      redirect '/login' # For non-API calls, redirect to login page
    end
  end
end
