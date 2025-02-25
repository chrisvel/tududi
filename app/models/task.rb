class Task < ActiveRecord::Base
  belongs_to :user
  belongs_to :project, optional: true
  has_and_belongs_to_many :tags

  enum priority: { low: 0, medium: 1, high: 2 }
  enum status: { not_started: 0, in_progress: 1, done: 2, archived: 3, waiting: 4 }

  # Existing scopes
  scope :complete, -> { where(status: statuses[:done]) }
  scope :incomplete, -> { where.not(status: statuses[:done]) }
  scope :due_today, -> { incomplete.where('DATE(due_date) <= ?', Date.today) }
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

    # Calculate tasks due today including those due via projects
    tasks_due_today = user.tasks.incomplete.joins(:project)
                          .where('tasks.due_date <= ? OR projects.due_date_at <= ?', Date.today, Date.today)
                          .distinct

    # Gather an array of IDs to be excluded from suggested tasks
    excluded_task_ids = tasks_in_progress.pluck(:id) + tasks_due_today.pluck(:id)

    # Gather tasks in projects expiring starting today, order by task priority
    tasks_in_expiring_projects = user.tasks.incomplete
                                        .joins(:project)
                                        .where('projects.due_date_at >= ?', Date.today)
                                        .where(projects: { active: true }) # Only active projects
                                        .where.not(id: excluded_task_ids)
                                        .order(Arel.sql('projects.due_date_at ASC, tasks.priority DESC'))
                                        .limit(5)

    # Gather tasks not assigned to projects expiring today, ordered by task priority
    tasks_without_projects = user.tasks.incomplete
                                     .where(status: statuses[:not_started], project_id: nil)
                                     .or(user.tasks.where(project_id: nil, status: statuses[:not_started]))
                                     .where.not(id: excluded_task_ids)
                                     .order(priority: :desc)
                                     .limit(5)

    # Combine both list of suggested tasks
    suggested_tasks = tasks_in_expiring_projects + tasks_without_projects

    {
      total_open_tasks: total_open_tasks,
      tasks_pending_over_month: tasks_pending_over_month,
      tasks_in_progress: tasks_in_progress,
      tasks_in_progress_count: tasks_in_progress_count,
      tasks_due_today: tasks_due_today,
      suggested_tasks: suggested_tasks
    }
  end

  def as_json(options = {})
    super(options).merge(
      'due_date' => due_date&.strftime('%Y-%m-%d')
    )
  end
end
