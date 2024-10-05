class Task < ActiveRecord::Base
  belongs_to :user
  belongs_to :project, optional: true
  has_and_belongs_to_many :tags

  enum priority: { low: 0, medium: 1, high: 2 }
  enum status: { not_started: 0, in_progress: 1, done: 2, archived: 3, waiting: 4 }

  scope :complete, -> { where(status: statuses[:done]) }
  scope :incomplete, -> { where.not(status: statuses[:done]) }
  scope :due_today, -> { incomplete.where('due_date <= ?', Date.today.end_of_day) }
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

  validates :name, presence: true, uniqueness: { scope: :user_id }
end
