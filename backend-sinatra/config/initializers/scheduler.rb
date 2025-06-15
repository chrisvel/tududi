# config/initializers/scheduler.rb
require 'rufus-scheduler'
require_relative '../../app/services/task_summary_service'

# Helper method to update user's summary tracking fields
def update_summary_tracking(user, next_time)
  user.update(
    task_summary_last_run: Time.now,
    task_summary_next_run: next_time
  )
end

# Don't schedule in test environment or when reloading in development
if ENV['RACK_ENV'] != 'test' && ENV['DISABLE_SCHEDULER'] != 'true'
  scheduler = Rufus::Scheduler.singleton
  
  # Daily schedule at 7 AM (for users with daily frequency)
  daily_job = scheduler.cron '0 7 * * *' do
    puts "Running scheduled task: Daily task summary"
    
    User.where.not(telegram_bot_token: [nil, ''])
        .where.not(telegram_chat_id: [nil, ''])
        .where(task_summary_enabled: true)
        .where(task_summary_frequency: 'daily')
        .each do |user|
      begin
        TaskSummaryService.send_summary_to_user(user.id)
        # Calculate next run time - tomorrow at 7 AM
        next_run = Time.now.tomorrow.change(hour: 7, min: 0, sec: 0)
        update_summary_tracking(user, next_run)
        puts "Sent daily summary to user #{user.id}"
      rescue => e
        puts "Error sending daily summary to user #{user.id}: #{e.message}"
      end
    end
  end
  
  # Weekdays schedule at 7 AM (Monday through Friday)
  weekday_job = scheduler.cron '0 7 * * 1-5' do
    puts "Running scheduled task: Weekday task summary"
    
    User.where.not(telegram_bot_token: [nil, ''])
        .where.not(telegram_chat_id: [nil, ''])
        .where(task_summary_enabled: true)
        .where(task_summary_frequency: 'weekdays')
        .each do |user|
      begin
        TaskSummaryService.send_summary_to_user(user.id)
        # Calculate next run time - next weekday at 7 AM
        current_day = Time.now.wday
        days_until_next_weekday = current_day == 5 ? 3 : 1 # If Friday, next is Monday (+3 days), otherwise next day
        next_run = Time.now.advance(days: days_until_next_weekday).change(hour: 7, min: 0, sec: 0)
        update_summary_tracking(user, next_run)
        puts "Sent weekday summary to user #{user.id}"
      rescue => e
        puts "Error sending weekday summary to user #{user.id}: #{e.message}"
      end
    end
  end
  
  # Weekly schedule at 7 AM on Monday
  weekly_job = scheduler.cron '0 7 * * 1' do
    puts "Running scheduled task: Weekly task summary"
    
    User.where.not(telegram_bot_token: [nil, ''])
        .where.not(telegram_chat_id: [nil, ''])
        .where(task_summary_enabled: true)
        .where(task_summary_frequency: 'weekly')
        .each do |user|
      begin
        TaskSummaryService.send_summary_to_user(user.id)
        # Calculate next run time - next Monday at 7 AM
        next_run = Time.now.advance(days: 7).change(hour: 7, min: 0, sec: 0)
        update_summary_tracking(user, next_run)
        puts "Sent weekly summary to user #{user.id}"
      rescue => e
        puts "Error sending weekly summary to user #{user.id}: #{e.message}"
      end
    end
  end
  
  # Hourly schedules for different intervals
  
  # Every 1 hour
  hourly_job = scheduler.every '1h' do
    puts "Running scheduled task: Hourly (1h) task summary"
    
    User.where.not(telegram_bot_token: [nil, ''])
        .where.not(telegram_chat_id: [nil, ''])
        .where(task_summary_enabled: true)
        .where(task_summary_frequency: '1h')
        .each do |user|
      begin
        TaskSummaryService.send_summary_to_user(user.id)
        next_run = Time.now + 1.hour
        update_summary_tracking(user, next_run)
        puts "Sent hourly summary to user #{user.id}"
      rescue => e
        puts "Error sending hourly summary to user #{user.id}: #{e.message}"
      end
    end
  end
  
  # Every 2 hours
  two_hourly_job = scheduler.every '2h' do
    puts "Running scheduled task: 2-hour task summary"
    
    User.where.not(telegram_bot_token: [nil, ''])
        .where.not(telegram_chat_id: [nil, ''])
        .where(task_summary_enabled: true)
        .where(task_summary_frequency: '2h')
        .each do |user|
      begin
        TaskSummaryService.send_summary_to_user(user.id)
        next_run = Time.now + 2.hours
        update_summary_tracking(user, next_run)
        puts "Sent 2-hour summary to user #{user.id}"
      rescue => e
        puts "Error sending 2-hour summary to user #{user.id}: #{e.message}"
      end
    end
  end
  
  # Every 4 hours
  four_hourly_job = scheduler.every '4h' do
    puts "Running scheduled task: 4-hour task summary"
    
    User.where.not(telegram_bot_token: [nil, ''])
        .where.not(telegram_chat_id: [nil, ''])
        .where(task_summary_enabled: true)
        .where(task_summary_frequency: '4h')
        .each do |user|
      begin
        TaskSummaryService.send_summary_to_user(user.id)
        next_run = Time.now + 4.hours
        update_summary_tracking(user, next_run)
        puts "Sent 4-hour summary to user #{user.id}"
      rescue => e
        puts "Error sending 4-hour summary to user #{user.id}: #{e.message}"
      end
    end
  end
  
  # Every 8 hours
  eight_hourly_job = scheduler.every '8h' do
    puts "Running scheduled task: 8-hour task summary"
    
    User.where.not(telegram_bot_token: [nil, ''])
        .where.not(telegram_chat_id: [nil, ''])
        .where(task_summary_enabled: true)
        .where(task_summary_frequency: '8h')
        .each do |user|
      begin
        TaskSummaryService.send_summary_to_user(user.id)
        next_run = Time.now + 8.hours
        update_summary_tracking(user, next_run)
        puts "Sent 8-hour summary to user #{user.id}"
      rescue => e
        puts "Error sending 8-hour summary to user #{user.id}: #{e.message}"
      end
    end
  end
  
  # Every 12 hours
  twelve_hourly_job = scheduler.every '12h' do
    puts "Running scheduled task: 12-hour task summary"
    
    User.where.not(telegram_bot_token: [nil, ''])
        .where.not(telegram_chat_id: [nil, ''])
        .where(task_summary_enabled: true)
        .where(task_summary_frequency: '12h')
        .each do |user|
      begin
        TaskSummaryService.send_summary_to_user(user.id)
        next_run = Time.now + 12.hours
        update_summary_tracking(user, next_run)
        puts "Sent 12-hour summary to user #{user.id}"
      rescue => e
        puts "Error sending 12-hour summary to user #{user.id}: #{e.message}"
      end
    end
  end
end

