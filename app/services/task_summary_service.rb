# app/services/task_summary_service.rb
require 'yaml'

class TaskSummaryService
  # Helper method to escape special characters for MarkdownV2
  def self.escape_markdown(text)
    # Characters that need to be escaped in MarkdownV2: _*[]()~`>#+-=|{}.!
    text.to_s.gsub(/([_*\[\]()~`>#+\-=|{}.!])/, '\\\\\1')
  end

  def self.generate_summary_for_user(user_id)
    user = User.find_by(id: user_id)
    return nil unless user

    # Get today's tasks, in progress tasks, etc.
    tasks = user.tasks

    today = Date.today
    due_today = tasks.where('DATE(due_date) = ?', today).where.not(status: 'done')
    in_progress = tasks.where(status: 'in_progress')
    completed_today = tasks.where(status: 'done').where('DATE(updated_at) = ?', today)

    # Generate summary message
    message = "📋 *Today's Task Summary*\n\n"

    # Add a header divider
    message += "━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

    # Start Today's Plan section
    message += "✏️ *Today's Plan*\n\n"

    # Add due today tasks to Today's Plan
    # Add due today tasks to Today's Plan
    if due_today.any?
      message += "🚀 *Tasks Due Today:*\n"
      due_today.order(:name).each_with_index do |task, index|
        priority_emoji =
          case task.priority
          when 'high' then '🔴'
          when 'medium' then '🟠'
          when 'low' then '🟢'
          else '⚪'
          end

        # Escape special characters in task name and project name
        task_name = escape_markdown(task.name)
        project_info = task.project ? " \\[#{escape_markdown(task.project.name)}\\]" : ''

        message += "#{index + 1}\\. #{priority_emoji} #{task_name}#{project_info}\n"
      end
      message += "\n"
    end
    # Add in progress tasks to Today's Plan
    if in_progress.any?
      message += "⚙️ *In Progress Tasks:*\n"
      in_progress.order(:name).each_with_index do |task, index|
        priority_emoji =
          case task.priority
          when 'high' then '🔴'
          when 'medium' then '🟠'
          when 'low' then '🟢'
          else '⚪'
          end

        # Escape special characters in task name and project name
        task_name = escape_markdown(task.name)
        project_info = task.project ? " \\[#{escape_markdown(task.project.name)}\\]" : ''

        message += "#{index + 1}\\. #{priority_emoji} #{task_name}#{project_info}\n"
      end
      message += "\n"
    end
    # Add suggested tasks (not done, not in due today or in progress)
    suggested_task_ids = due_today.pluck(:id) + in_progress.pluck(:id)

    # Get tasks in expiring projects - same logic as Task.compute_metrics
    tasks_in_expiring_projects = tasks
                                 .where.not(status: 'done')
                                 .where.not(id: suggested_task_ids)
                                 .joins(:project)
                                 .where('projects.due_date_at >= ?', today)
                                 .where(projects: { active: true }) # Only active projects
                                 .order(Arel.sql('projects.due_date_at ASC, tasks.priority DESC'))

    # Get tasks not assigned to projects - same logic as Task.compute_metrics
    tasks_without_projects = tasks
                             .where.not(status: 'done')
                             .where.not(id: suggested_task_ids)
                             .where(project_id: nil, status: 'not_started')
                             .order(priority: :desc)

    # Combine both sets of tasks
    combined_tasks = (tasks_in_expiring_projects + tasks_without_projects)

    # Sort using same logic as Task.sort_suggested_tasks
    suggested_tasks = combined_tasks.sort_by do |task|
      # Parse or default the task due date
      task_due_date = if task.due_date.is_a?(String)
                        Date.parse(task.due_date)
                      else
                        task.due_date || Date.new(9999, 12, 31)
                      end

      # Parse or default the project due date
      project_due_date = if task.project&.due_date_at.is_a?(String)
                           Date.parse(task&.project&.due_date_at)
                         else
                           task.project&.due_date_at || Date.new(9999, 12, 31)
                         end

      # Priority in descending order (sorted values should be negative for sort_by)
      priority_value = -Task.priorities.fetch(task.priority, -1)

      # Determine sorting flags based on various criteria
      is_high_priority_proj_with_due_date = task.priority == 'high' && task.project&.due_date_at ? 0 : 1
      is_high_priority_with_due_date = task.priority == 'high' && task.due_date ? 0 : 1
      is_high_priority = task.priority == 'high' && !task.due_date && !task.project&.due_date_at ? 0 : 1

      is_medium_priority_proj_with_due_date = task.priority == 'medium' && task.project&.due_date_at ? 0 : 1
      is_medium_priority_with_due_date = task.priority == 'medium' && task.due_date ? 0 : 1
      is_medium_priority = task.priority == 'medium' && !task.due_date && !task.project&.due_date_at ? 0 : 1

      is_low_priority_proj_with_due_date = task.priority == 'low' && task.project&.due_date_at ? 0 : 1
      is_low_priority_with_due_date = task.priority == 'low' && task.due_date ? 0 : 1
      is_low_priority = task.priority == 'low' && !task.due_date && !task.project&.due_date_at ? 0 : 1

      # Primary sorting criteria - same as Task.sort_suggested_tasks
      [
        is_high_priority_proj_with_due_date,
        is_high_priority_with_due_date,
        is_high_priority,

        is_medium_priority_proj_with_due_date,
        is_medium_priority_with_due_date,
        is_medium_priority,

        is_low_priority_proj_with_due_date,
        is_low_priority_with_due_date,
        is_low_priority,

        task_due_date,
        project_due_date,
        priority_value
      ]
    end.first(5)

    if suggested_tasks.any?
      message += "💡 *Suggested Tasks \\(Top 3\\):*\n"
      # Only display the top 3 suggested tasks
      suggested_tasks.first(5).each_with_index do |task, index|
        priority_emoji =
          case task.priority
          when 'high' then '🔴'
          when 'medium' then '🟠'
          when 'low' then '🟢'
          else '⚪'
          end

        # Escape special characters in task name and project name
        task_name = escape_markdown(task.name)
        project_info = task.project ? " \\[#{escape_markdown(task.project.name)}\\]" : ''
        due_date = task.due_date ? " \\(Due: #{escape_markdown(task.due_date.strftime('%b %d'))}\\)" : ''

        message += "#{index + 1}\\. #{priority_emoji} #{task_name}#{project_info}#{due_date}\n"
      end
      message += "\n"
    end

    # Add a section divider
    message += "━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

    # Add completed tasks for today if any
    if completed_today.any?
      message += "✅ *Completed Today:*\n"
      completed_today.order(updated_at: :desc).each_with_index do |task, index|
        # Escape special characters in task name and project name
        task_name = escape_markdown(task.name)
        project_info = task.project ? " \\[#{escape_markdown(task.project.name)}\\]" : ''

        message += "#{index + 1}\\. #{task_name}#{project_info}\n"
      end
      message += "\n"
    end

    # Add inbox count if available
    inbox_items_count = user.inbox_items.where(status: 'added').count
    if inbox_items_count > 0
      message += "*Inbox:*\n"
      message += "• You have #{inbox_items_count} item\\(s\\) in your inbox to process\\.\n\n"
    end

    # Add a section divider
    message += "━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
    # Add a motivational note from the YAML file
    begin
      quotes_file = Rails.root.join('config', 'quotes.yml')
      quotes_data = YAML.load_file(quotes_file)['quotes']

      message += "💪 *Today's Motivation:*\n"
      quote = quotes_data.sample
      # Escape special characters in the quote
      message += escape_markdown(quote)
    rescue StandardError => e
      # Fallback to default quotes if there's an issue loading from YAML
      default_quotes = [
        'Focus on progress, not perfection.',
        'One task at a time leads to great accomplishments.',
        "Today's effort is tomorrow's success.",
        'Small steps every day lead to big results.'
      ]

      message += "💪 *Today's Motivation:*\n"
      quote = default_quotes.sample
      # Escape special characters in the quote
      message += escape_markdown(quote)
    end

    message
  end

  def self.send_summary_to_user(user_id)
    user = User.find_by(id: user_id)
    return false unless user && user.telegram_bot_token && user.telegram_chat_id

    summary = generate_summary_for_user(user_id)
    return false unless summary

    # Send the message via Telegram
    begin
      TelegramPoller.instance.send_telegram_message(
        user.telegram_bot_token,
        user.telegram_chat_id,
        summary
      )

      # Update the last run time and calculate the next run time
      now = Time.now
      next_run = calculate_next_run_time(user, now)

      # Update the user's tracking fields
      user.update(
        task_summary_last_run: now,
        task_summary_next_run: next_run
      )

      true
    rescue StandardError => e
      puts "Error sending task summary to user #{user_id}: #{e.message}"
      false
    end
  end

  # Calculate when the next task summary should run based on frequency
  def self.calculate_next_run_time(user, from_time = Time.now)
    case user.task_summary_frequency
    when 'daily'
      # Next day at 7 AM
      from_time.tomorrow.change(hour: 7, min: 0, sec: 0)
    when 'weekdays'
      # If it's Friday, next is Monday, otherwise next day (if it's a weekday)
      days_until_next_weekday =
        if from_time.wday == 5 # Friday
          3 # Next Monday
        elsif from_time.wday == 6 # Saturday
          2 # Next Monday
        else
          1 # Next day
        end
      from_time.advance(days: days_until_next_weekday).change(hour: 7, min: 0, sec: 0)
    when 'weekly'
      # Next week same day, or next Monday if we're being specific
      from_time.advance(days: 7).change(hour: 7, min: 0, sec: 0)
    when '1h'
      from_time + 1.hour
    when '2h'
      from_time + 2.hours
    when '4h'
      from_time + 4.hours
    when '8h'
      from_time + 8.hours
    when '12h'
      from_time + 12.hours
    else
      # Default to daily at 7 AM
      from_time.tomorrow.change(hour: 7, min: 0, sec: 0)
    end
  end
end
