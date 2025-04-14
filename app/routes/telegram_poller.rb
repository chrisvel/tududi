require 'net/http'
require 'uri'
require 'json'
require 'thread'

# A class to handle polling for Telegram updates
class TelegramPoller
  @@instance = nil
  @@mutex = Mutex.new
  
  attr_reader :running, :thread, :poll_interval, :last_update_id, :users_to_poll
  
  def initialize
    @running = false
    @thread = nil
    @poll_interval = 5 # seconds
    @last_update_id = 0
    @users_to_poll = []
    
    # Keep a record of which users have active polling
    @user_status = {}
  end
  
  def self.instance
    @@mutex.synchronize do
      @@instance ||= new
    end
    @@instance
  end
  
  # Start polling for a specific user
  def add_user(user)
    return false unless user && user.telegram_bot_token
    
    @users_to_poll << user unless @users_to_poll.any? { |u| u.id == user.id }
    
    # Start the polling thread if not already running
    start_polling if @users_to_poll.any? && !@running
    
    true
  end
  
  # Remove a user from polling
  def remove_user(user_id)
    @users_to_poll.reject! { |u| u.id == user_id }
    
    # Stop polling if no users left
    stop_polling if @users_to_poll.empty? && @running
    
    true
  end
  
  # Start the polling thread
  def start_polling
    return if @running
    
    @running = true
    @thread = Thread.new do
      while @running
        begin
          poll_updates
        rescue => e
          puts "Error polling Telegram: #{e.message}"
          puts e.backtrace.join("\n")
        end
        
        sleep @poll_interval
      end
    end
  end
  
  # Stop the polling thread
  def stop_polling
    return unless @running
    
    @running = false
    @thread.join if @thread
    @thread = nil
  end
  
  # Poll for updates from Telegram
  def poll_updates
    @users_to_poll.each do |user|
      token = user.telegram_bot_token
      next unless token
      
      begin
        # Get updates from Telegram
        uri = URI.parse("https://api.telegram.org/bot#{token}/getUpdates")
        
        params = {
          offset: @user_status[user.id]&.dig(:last_update_id).to_i + 1,
          timeout: 1 # Short timeout for quick polling
        }
        
        uri.query = URI.encode_www_form(params)
        
        http = Net::HTTP.new(uri.host, uri.port)
        http.use_ssl = true
        http.read_timeout = 5
        
        request = Net::HTTP::Get.new(uri.request_uri)
        response = http.request(request)
        
        if response.code == '200'
          data = JSON.parse(response.body)
          
          if data['ok'] && data['result'].is_a?(Array)
            process_updates(user, data['result'])
          end
        else
          puts "Error polling Telegram for user #{user.id}: #{response.code} #{response.message}"
        end
      rescue => e
        puts "Error getting updates for user #{user.id}: #{e.message}"
      end
    end
  end
  
  # Process updates received from Telegram
  def process_updates(user, updates)
    return if updates.empty?
    
    # Track the highest update_id to avoid processing the same update twice
    highest_update_id = updates.map { |u| u['update_id'].to_i }.max || 0
    
    # Save the last update ID for this user
    @user_status[user.id] ||= {}
    @user_status[user.id][:last_update_id] = highest_update_id if highest_update_id > (@user_status[user.id][:last_update_id] || 0)
    
    updates.each do |update|
      begin
        # Process message updates
        if update['message'] && update['message']['text']
          process_message(user, update)
        end
      rescue => e
        puts "Error processing update #{update['update_id']}: #{e.message}"
      end
    end
  end
  
  # Process a single message
  def process_message(user, update)
    message = update['message']
    text = message['text']
    chat_id = message['chat']['id'].to_s
    message_id = message['message_id']
    
    puts "Processing message from user #{user.id}: #{text}"
    
    # Save the chat_id if not already saved
    if user.telegram_chat_id.nil? || user.telegram_chat_id.empty?
      puts "Updating user's telegram_chat_id to #{chat_id}"
      user.update(telegram_chat_id: chat_id)
    end
    
    # Create an inbox item
    inbox_item = user.inbox_items.build(
      content: text,
      source: 'telegram'
    )
    
    if inbox_item.save
      puts "Created inbox item #{inbox_item.id} from Telegram message"
      
      # Send confirmation
      begin
        send_telegram_message(
          user.telegram_bot_token,
          chat_id,
          "✅ Added to Tududi inbox: \"#{text}\"",
          message_id
        )
      rescue => e
        puts "Error sending confirmation: #{e.message}"
      end
    else
      puts "Failed to create inbox item: #{inbox_item.errors.full_messages.join(', ')}"
      
      # Send error message
      begin
        send_telegram_message(
          user.telegram_bot_token,
          chat_id,
          "❌ Failed to add to inbox: #{inbox_item.errors.full_messages.join(', ')}",
          message_id
        )
      rescue => e
        puts "Error sending error message: #{e.message}"
      end
    end
  end
  
  # Send a message to Telegram
  def send_telegram_message(token, chat_id, text, reply_to_message_id = nil)
    uri = URI.parse("https://api.telegram.org/bot#{token}/sendMessage")
    
    # Prepare message parameters
    message_params = {
      chat_id: chat_id,
      text: text
    }
    
    # Add reply_to_message_id if provided
    message_params[:reply_to_message_id] = reply_to_message_id if reply_to_message_id
    
    # Send the request to Telegram API
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    request = Net::HTTP::Post.new(uri.request_uri, 'Content-Type' => 'application/json')
    request.body = message_params.to_json
    
    response = http.request(request)
    return JSON.parse(response.body)
  end
  
  # Get status of the poller
  def status
    {
      running: @running,
      users_count: @users_to_poll.size,
      poll_interval: @poll_interval,
      user_status: @user_status
    }
  end
end

# Initialize the poller when this file is loaded
TelegramPoller.instance