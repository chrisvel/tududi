module Sinatra
  class Application
    get '/api/profile' do
      content_type :json
      user = current_user

      if user
        user.to_json(only: %i[id email appearance language timezone avatar_image telegram_bot_token telegram_chat_id])
      else
        halt 404, { error: 'Profile not found.' }.to_json
      end
    end

    patch '/api/profile' do
      content_type :json

      begin
        request_payload = JSON.parse(request.body.read)
      rescue JSON::ParserError
        halt 400, { error: 'Invalid JSON format.' }.to_json
      end

      user = current_user

      halt 404, { error: 'Profile not found.' }.to_json if user.nil?

      allowed_params = {}
      allowed_params[:appearance] = request_payload['appearance'] if request_payload.key?('appearance')
      allowed_params[:language] = request_payload['language'] if request_payload.key?('language')
      allowed_params[:timezone] = request_payload['timezone'] if request_payload.key?('timezone')
      allowed_params[:avatar_image] = request_payload['avatar_image'] if request_payload.key?('avatar_image')
      allowed_params[:telegram_bot_token] = request_payload['telegram_bot_token'] if request_payload.key?('telegram_bot_token')

      if user.update(allowed_params)
        user.to_json(only: %i[id email appearance language timezone avatar_image telegram_bot_token telegram_chat_id])
      else
        status 400
        { error: 'Failed to update profile.', details: user.errors.full_messages }.to_json
      end
    end
  end
end
