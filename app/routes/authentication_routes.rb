class Sinatra::Application
  get '/login' do
    erb :login
  end

  post '/login' do
    @user = User.find_by(email: params[:email])
    if @user&.authenticate(params[:password])
      session[:user_id] = @user.id
      redirect '/'
    else
      logger.warn "Invalid credentials for user with email #{params[:email]}"
      @errors = ['Invalid credentials']
      erb :login
    end
  end

  get '/logout' do
    session.clear
    redirect '/login'
  end
end