# app/controllers/user_routes.rb

module Sinatra
  class Application
    # GET /api/profile - Fetch the current user's profile
    get '/api/profile' do
      content_type :json
      user = current_user

      if user
        user.to_json(only: %i[id email appearance language timezone avatar_image])
      else
        halt 404, { error: 'Profile not found.' }.to_json
      end
    end

    # PATCH /api/profile - Update the current user's profile
    patch '/api/profile' do
      content_type :json

      begin
        request_payload = JSON.parse(request.body.read)
      rescue JSON::ParserError
        halt 400, { error: 'Invalid JSON format.' }.to_json
      end

      user = current_user

      halt 404, { error: 'Profile not found.' }.to_json if user.nil?

      # Permit only allowed parameters
      allowed_params = {}
      allowed_params[:appearance] = request_payload['appearance'] if request_payload.key?('appearance')
      allowed_params[:language] = request_payload['language'] if request_payload.key?('language')
      allowed_params[:timezone] = request_payload['timezone'] if request_payload.key?('timezone')
      allowed_params[:avatar_image] = request_payload['avatar_image'] if request_payload.key?('avatar_image')

      # Handle avatar image upload if using Active Storage
      # Uncomment if using Active Storage
      # if request_payload['avatar_image']
      #   begin
      #     decoded_image = Base64.decode64(request_payload['avatar_image'].split(',')[1])
      #     user.avatar_image.attach(io: StringIO.new(decoded_image), filename: "avatar_#{Time.now.to_i}.png", content_type: 'image/png')
      #   rescue => e
      #     halt 400, { error: 'Invalid avatar image format.' }.to_json
      #   end
      # end

      if user.update(allowed_params)
        # If handling tags on user profile, implement here
        # For now, we're not associating tags with user profiles
        user.to_json(only: %i[id email appearance language timezone avatar_image])
      else
        status 400
        { error: 'Failed to update profile.', details: user.errors.full_messages }.to_json
      end
    end
  end
end
