module AuthenticationHelper
  def logged_in?
    !!session[:user_id]
  end

  def current_user
    @current_user ||= User.find(session[:user_id]) if session[:user_id]
  end

  def require_login
    return if ['/login', '/logout'].include? request.path

    redirect '/login' unless logged_in?
  end
end
