module TaskHelper
  def priority_class(task)
    return 'text-success' if task.done?

    case task.priority
    when 'medium'
      'text-warning'
    when 'high'
      'text-danger'
    else
      'text-secondary'
    end
  end

  def due_date_badge_class(due_date)
    return 'bg-light text-dark' unless due_date

    case due_date.to_date
    when Date.today
      'bg-primary'
    when Date.tomorrow
      'bg-info'
    when Date.yesterday..Date.today
      'bg-danger'
    else
      'bg-light text-dark'
    end
  end

  def format_due_date(due_date)
    return '' unless due_date

    case due_date.to_date
    when Date.today
      'TODAY'
    when Date.tomorrow
      'TOMORROW'
    when Date.yesterday
      'YESTERDAY'
    else
      due_date.strftime('%Y-%m-%d')
    end
  end

  def status_badge_class(status)
    case status
    when 'not_started'
      'bg-warning-subtle text-warning'
    when 'in_progress'
      'bg-primary-subtle text-primary'
    when 'done'
      'bg-success-subtle text-success'
    else
      'bg-secondary-subtle text-secondary'
    end
  end

  def order_name(order_by)
    return 'Select' unless order_by

    field, direction = order_by.split(':')
    name = case field
           when 'due_date' then 'Due Date'
           when 'name' then 'Name'
           when 'priority' then 'Priority'
           when 'created_at' then 'Created At'
           else 'Select'
           end

    direction_icon = direction == 'asc' ? '<i class="bi bi-arrow-up"></i>' : '<i class="bi bi-arrow-down"></i>'

    "#{name} #{direction_icon}"
  end
end
