class Task < ActiveRecord::Base
  belongs_to :user
  belongs_to :project, optional: true
  has_and_belongs_to_many :tags

  enum priority: { low: 0, medium: 1, high: 2 }
  enum status: { not_started: 0, in_progress: 1, done: 2, archived: 3, waiting: 4 }

  # Existing scopes
  scope :complete, -> { where(status: statuses[:done]) }
  scope :incomplete, -> { where.not(status: statuses[:done]) }
  scope :due_today, -> { incomplete.where('DATE(due_date) < ?', Date.today) }
  scope :upcoming, -> { incomplete.where('due_date BETWEEN ? AND ?', Date.today, Date.today + 7.days) }
  scope :someday, -> { incomplete.where(due_date: nil) }
  scope :next_actions, -> { incomplete.where(due_date: nil, project_id: nil) }
  scope :waiting_for, -> { incomplete.where(status: statuses[:waiting]) }
  scope :inbox, -> { incomplete.where('due_date IS NULL OR project_id IS NULL') }

  scope :ordered_by_due_date, lambda { |direction = 'asc'|
    order(Arel.sql("CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date #{direction}"))
  }

  scope :with_tag, lambda { |tag_name|
    joins(:tags).where(tags: { name: tag_name })
  }

  scope :by_status, ->(status) { where(status: statuses[status]) }
  scope :by_priority, ->(priority) { where(priority: priorities[priority]) }

  scope :order_by_priority, -> { order(priority: :desc) }

  validates :name, presence: true, uniqueness: { scope: :user_id }

  # New class method to filter tasks based on params
  def self.filter_by_params(params, user)
    tasks = user.tasks.includes(:project, :tags)

    tasks = case params[:type]
            when 'today'
              tasks
            when 'upcoming'
              tasks.upcoming
            when 'next'
              tasks.next_actions
            when 'inbox'
              tasks.inbox
            when 'someday'
              tasks.someday
            when 'waiting'
              tasks.waiting_for
            else
              params[:status] == 'done' ? tasks.complete : tasks.incomplete
            end

    tasks = tasks.with_tag(params[:tag]) if params[:tag]

    tasks = tasks.apply_ordering(params[:order_by]) if params[:order_by]

    tasks.left_joins(:tags).distinct
  end

  scope :apply_ordering, lambda { |order_by|
    order_column, order_direction = order_by.split(':')
    order_direction ||= 'asc'
    order_direction = order_direction.downcase == 'desc' ? :desc : :asc

    allowed_columns = %w[created_at updated_at name priority status due_date]
    raise ArgumentError, 'Invalid order column specified.' unless allowed_columns.include?(order_column)

    if order_column == 'due_date'
      ordered_by_due_date(order_direction)
    else
      order("tasks.#{order_column} #{order_direction}")
    end
  }

  def self.compute_metrics(user)
    total_open_tasks = user.tasks.incomplete.count

    one_month_ago = Date.today - 30
    tasks_pending_over_month = user.tasks.incomplete.where('created_at < ?', one_month_ago).count

    tasks_in_progress = user.tasks.incomplete.where(status: statuses[:in_progress])
    tasks_in_progress_count = tasks_in_progress.count

    tasks_due_today = user.tasks.due_today

    # Suggested tasks
    excluded_task_ids = tasks_in_progress.pluck(:id) + tasks_due_today.pluck(:id)
    suggested_tasks = user.tasks.incomplete
                          .where(status: statuses[:not_started])
                          .where.not(id: excluded_task_ids)
                          .order_by_priority
                          .limit(5)

    {
      total_open_tasks: total_open_tasks,
      tasks_pending_over_month: tasks_pending_over_month,
      tasks_in_progress: tasks_in_progress,
      tasks_in_progress_count: tasks_in_progress_count,
      tasks_due_today: tasks_due_today,
      suggested_tasks: suggested_tasks
    }
  end
end
