#!/usr/bin/env ruby
# config/initializers/telegram_initializer.rb
require_relative '../../app/routes/telegram_poller'
require_relative '../../app/models/user'

# Create a method to be called after database connection is established
def initialize_telegram_polling
  if ENV['RACK_ENV'] != 'test' && ENV['DISABLE_TELEGRAM'] != 'true'
    puts "Initializing Telegram polling for configured users..."
    
    # Get singleton instance of the poller
    poller = TelegramPoller.instance
    
    # Make sure we have a database connection
    begin
      ActiveRecord::Base.connection_pool.with_connection do |connection|
        # Check if the users table exists
        if connection.table_exists?('users')
          begin
            # Find users with configured Telegram tokens
            users_with_telegram = User.where.not(telegram_bot_token: [nil, ''])
            
            if users_with_telegram.any?
              puts "Found #{users_with_telegram.count} users with Telegram configuration"
              
              # Add each user to the polling list
              users_with_telegram.each do |user|
                puts "Starting Telegram polling for user #{user.id}"
                poller.add_user(user)
              end
              
              puts "Telegram polling initialized successfully"
            else
              puts "No users with Telegram configuration found"
            end
          rescue => e
            puts "Error initializing Telegram polling: #{e.message}"
            puts e.backtrace.join("\n")
          end
        else
          puts "Users table doesn't exist yet, skipping Telegram initialization"
        end
      end
    rescue => e
      puts "Database connection not available for Telegram initialization: #{e.message}"
      puts "Telegram polling will be initialized later when the database is available."
    end
  end
end

# Don't run the initializer here - we'll hook it into the Sinatra app after ActiveRecord is initialized