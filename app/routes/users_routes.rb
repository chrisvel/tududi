module Sinatra
  class Application
    get '/api/profile' do
      content_type :json
      user = current_user

      if user
        user.to_json(only: %i[id email appearance language timezone avatar_image telegram_bot_token telegram_chat_id task_summary_enabled task_summary_frequency])
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
    
    post '/api/profile/task-summary/toggle' do
      content_type :json
      
      user = current_user
      halt 404, { error: 'User not found.' }.to_json unless user
      
      # Toggle the task_summary_enabled flag
      enabled = !user.task_summary_enabled
      
      if user.update(task_summary_enabled: enabled)
        # If enabling, send a test summary to confirm it works
        if enabled && user.telegram_bot_token && user.telegram_chat_id
          begin
            success = TaskSummaryService.send_summary_to_user(user.id)
            
            if success
              { 
                success: true, 
                enabled: enabled,
                message: 'Task summary notifications have been enabled and a test message was sent to your Telegram.'
              }.to_json
            else
              user.update(task_summary_enabled: false)
              halt 400, { 
                error: 'Failed to send test message to Telegram. Please check your Telegram bot configuration.'
              }.to_json
            end
          rescue => e
            user.update(task_summary_enabled: false)
            halt 400, { 
              error: 'Error sending test message to Telegram.',
              details: e.message
            }.to_json
          end
        else
          { 
            success: true, 
            enabled: enabled,
            message: enabled ? 'Task summary notifications have been enabled.' : 'Task summary notifications have been disabled.'
          }.to_json
        end
      else
        halt 400, { 
          error: 'Failed to update task summary settings.',
          details: user.errors.full_messages
        }.to_json
      end
    end

    post '/api/profile/task-summary/frequency' do
      content_type :json
      
      begin
        request_payload = JSON.parse(request.body.read)
      rescue JSON::ParserError
        halt 400, { error: 'Invalid JSON format.' }.to_json
      end
      
      frequency = request_payload['frequency']
      halt 400, { error: 'Frequency is required.' }.to_json unless frequency
      
      # Validate frequency value
      valid_frequencies = User::TASK_SUMMARY_FREQUENCIES
      halt 400, { error: 'Invalid frequency value.' }.to_json unless valid_frequencies.include?(frequency)
      
      user = current_user
      halt 404, { error: 'User not found.' }.to_json unless user
      
      if user.update(task_summary_frequency: frequency)
        { 
          success: true, 
          frequency: frequency,
          message: "Task summary frequency has been set to #{frequency}."
        }.to_json
      else
        halt 400, { 
          error: 'Failed to update task summary frequency.',
          details: user.errors.full_messages
        }.to_json
      end
    end

    post '/api/profile/task-summary/send-now' do
      content_type :json
      
      user = current_user
      halt 404, { error: 'User not found.' }.to_json unless user
      
      if user.telegram_bot_token && user.telegram_chat_id
        begin
          success = TaskSummaryService.send_summary_to_user(user.id)
          
          if success
            { 
              success: true, 
              message: 'Task summary was sent to your Telegram.'
            }.to_json
          else
            halt 400, { error: 'Failed to send message to Telegram.' }.to_json
          end
        rescue => e
          halt 400, { 
            error: 'Error sending message to Telegram.',
            details: e.message
          }.to_json
        end
      else
        halt 400, { error: 'Telegram bot is not properly configured.' }.to_json
      end
    end
    
    get '/api/profile/task-summary/status' do
      content_type :json
      
      user = current_user
      halt 404, { error: 'User not found.' }.to_json unless user
      
      {
        success: true,
        enabled: user.task_summary_enabled,
        frequency: user.task_summary_frequency,
        last_run: user.task_summary_last_run,
        next_run: user.task_summary_next_run
      }.to_json
    end
  end
end
