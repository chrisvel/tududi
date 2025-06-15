require 'net/http'
require 'uri'
require 'json'
require_relative 'telegram_poller'

module Sinatra
  class Application
    # Start polling for a user
    post '/api/telegram/start-polling' do
      content_type :json
      
      # Get the current user's Telegram token
      user = current_user
      halt 400, { error: 'Telegram bot token not set.' }.to_json unless user.telegram_bot_token
      
      # Add the user to the polling list
      if TelegramPoller.instance.add_user(user)
        { 
          success: true, 
          message: 'Telegram polling started',
          status: TelegramPoller.instance.status
        }.to_json
      else
        halt 500, { error: 'Failed to start Telegram polling.' }.to_json
      end
    end
    
    # Stop polling for a user
    post '/api/telegram/stop-polling' do
      content_type :json
      
      user = current_user
      
      # Remove the user from the polling list
      if TelegramPoller.instance.remove_user(user.id)
        { 
          success: true, 
          message: 'Telegram polling stopped',
          status: TelegramPoller.instance.status
        }.to_json
      else
        halt 500, { error: 'Failed to stop Telegram polling.' }.to_json
      end
    end
    
    # Get polling status
    get '/api/telegram/polling-status' do
      content_type :json
      
      {
        success: true,
        status: TelegramPoller.instance.status,
        is_polling: TelegramPoller.instance.users_to_poll.any? { |u| u.id == current_user.id }
      }.to_json
    end
    
    # Setup the Telegram bot for a user (save token and start polling)
    post '/api/telegram/setup' do
      content_type :json
      request_body = request.body.read
      
      begin
        setup_data = JSON.parse(request_body)
      rescue JSON::ParserError
        halt 400, { error: 'Invalid JSON format.' }.to_json
      end
      
      token = setup_data['token']
      halt 400, { error: 'Telegram bot token is required.' }.to_json unless token && !token.empty?
      
      # Validate the token by making a getMe request to Telegram
      begin
        uri = URI.parse("https://api.telegram.org/bot#{token}/getMe")
        http = Net::HTTP.new(uri.host, uri.port)
        http.use_ssl = true
        
        response = http.get(uri.request_uri)
        json_response = JSON.parse(response.body)
        
        if json_response['ok']
          # Token is valid, save it to the user
          bot_username = json_response['result']['username']
          current_user.update(telegram_bot_token: token)
          
          # Start polling for this user
          TelegramPoller.instance.add_user(current_user)
          
          # Return success with bot info
          { 
            success: true, 
            message: 'Telegram bot configured successfully and polling started!',
            bot: {
              username: bot_username,
              polling_status: TelegramPoller.instance.status,
              chat_url: "https://t.me/#{bot_username}"
            }
          }.to_json
        else
          halt 400, { error: 'Invalid Telegram bot token.', details: json_response['description'] }.to_json
        end
      rescue => e
        halt 500, { error: 'Error validating Telegram bot token.', details: e.message }.to_json
      end
    end
    
    # Test endpoint to simulate a Telegram message (for development)
    post '/api/telegram/test/:user_id' do
      content_type :json
      request_body = request.body.read
      
      begin
        message_data = JSON.parse(request_body)
      rescue JSON::ParserError
        halt 400, { error: 'Invalid JSON format.' }.to_json
      end
      
      user_id = params[:user_id]
      user = User.find_by(id: user_id)
      halt 404, { error: 'User not found.' }.to_json unless user
      halt 400, { error: 'User has no Telegram bot token configured.' }.to_json unless user.telegram_bot_token
      
      text = message_data['text'] || 'Test message from development environment'
      
      # Create an inbox item directly
      inbox_item = user.inbox_items.build(
        content: text,
        source: 'telegram'
      )
      
      if inbox_item.save
        # Send confirmation to Telegram if the user has a chat_id
        if user.telegram_chat_id
          begin
            # Use the TelegramPoller's send_message method
            response = TelegramPoller.instance.send_telegram_message(
              user.telegram_bot_token,
              user.telegram_chat_id,
              "✅ Added to Tududi inbox: \"#{text}\""
            )
            puts "Test message confirmation sent: #{response}"
          rescue => e
            puts "Error sending test confirmation: #{e.message}"
          end
        end
        
        { 
          success: true, 
          message: 'Test Telegram message processed successfully!',
          inbox_item_id: inbox_item.id
        }.to_json
      else
        { 
          success: false, 
          message: 'Failed to create inbox item from test message',
          errors: inbox_item.errors.full_messages
        }.to_json
      end
    end
  end
end