require 'json'

class Sinatra::Application
  # Serve the login page (if needed for non-React or fallback)
  # get '/login' do
  #   erb :login
  # end

  # Handle login requests (now accepting JSON)
  get '/api/current_user' do
    content_type :json

    if logged_in?
      { user: { email: current_user.email, id: current_user.id } }.to_json
    else
      { user: nil }.to_json
    end
  end

  post '/login' do
    content_type :json
    request_payload = begin
      JSON.parse(request.body.read)
    rescue StandardError
      nil
    end

    if request_payload
      email = request_payload['email']
      password = request_payload['password']
    else
      halt 400, { error: 'Invalid login parameters.' }.to_json
    end

    user = User.find_by(email: email)
    if user&.authenticate(password)
      session[:user_id] = user.id
      status 200
      { user: { email: user.email, id: user.id } }.to_json
    else
      halt 401, { errors: ['Invalid credentials'] }.to_json
    end
  end

  # Handle logout
  get '/logout' do
    session.clear
    redirect '/login'
  end
end
