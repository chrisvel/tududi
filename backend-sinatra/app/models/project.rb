class Project < ActiveRecord::Base
  belongs_to :user
  belongs_to :area, optional: true
  has_many :tasks, dependent: :destroy
  has_many :notes, dependent: :destroy
  has_and_belongs_to_many :tags

  enum priority: { low: 0, medium: 1, high: 2 }

  scope :with_incomplete_tasks, -> { joins(:tasks).where.not(tasks: { status: Task.statuses[:done] }).distinct }
  scope :with_complete_tasks, -> { joins(:tasks).where(tasks: { status: Task.statuses[:done] }).distinct }

  validates :name, presence: true, uniqueness: { scope: :user_id }

  def task_status_counts
    status_counts = tasks.group(:status).count

    total = status_counts.values.sum

    {
      total: total,
      in_progress: status_counts['in_progress'] || 0,
      done: status_counts['done'] || 0,
      not_started: status_counts['not_started'] || 0
    }
  end

  def progress_percentage
    counts = task_status_counts
    return 0 if counts[:total].zero?

    completed_tasks = counts[:total] - counts[:not_started]
    (completed_tasks.to_f / counts[:total] * 100).round
  end

  def due_date_at
    self[:due_date_at]&.strftime('%Y-%m-%d')
  end
end
