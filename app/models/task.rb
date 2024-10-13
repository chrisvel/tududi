class Task < ActiveRecord::Base
  belongs_to :user
  belongs_to :project, optional: true
  has_and_belongs_to_many :tags

  enum priority: { low: 0, medium: 1, high: 2 }
  enum status: { not_started: 0, in_progress: 1, done: 2, archived: 3, waiting: 4 }

  scope :complete, -> { where(status: statuses[:done]) }
  scope :incomplete, -> { where.not(status: statuses[:done]) }

  # Scope for tasks due today
  scope :due_today, lambda {
    where('(status = ? OR status = ?) AND due_date <= ?',
          statuses[:in_progress],
          statuses[:not_started],
          Date.today.end_of_day)
  }

  # Scope for tasks due in the upcoming week
  scope :upcoming, lambda {
    where('(status = ? OR status = ?) AND due_date BETWEEN ? AND ?',
          statuses[:in_progress],
          statuses[:not_started],
          Date.tomorrow,
          Date.today + 7.days)
  }

  # Scope for Next Actions (tasks without due dates but need action soon)
  scope :next_actions, lambda {
    incomplete.where('due_date IS NULL AND project_id IS NOT NULL')
  }

  # Scope for Someday/Maybe tasks (tasks without a due date or that are not urgent)
  scope :someday, lambda {
    incomplete.where('due_date IS NULL')
  }

  # Scope for Inbox (unprocessed tasks that have no project and no due date)
  scope :inbox, lambda {
    incomplete.where('due_date IS NULL AND project_id IS NULL')
  }

  # Scope for Waiting For (tasks waiting on someone else or another dependency)
  scope :waiting_for, lambda {
    where(status: statuses[:waiting])
  }

  validates :name, presence: true
end
