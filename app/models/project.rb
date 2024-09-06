class Project < ActiveRecord::Base
  belongs_to :user
  belongs_to :area, optional: true
  has_many :tasks, dependent: :destroy
  has_many :notes, dependent: :destroy

  scope :with_incomplete_tasks, -> { joins(:tasks).where.not(tasks: { status: Task.statuses[:done] }).distinct }
  scope :with_complete_tasks, -> { joins(:tasks).where(tasks: { status: Task.statuses[:done] }).distinct }

  validates :name, presence: true

  def task_status_counts
    status_counts = tasks.group(:status).count

    total = status_counts.values.sum

    {
      total: total,
      in_progress: status_counts[Task.statuses[:in_progress]] || 0,
      done: status_counts[Task.statuses[:done]] || 0,
      not_started: status_counts[Task.statuses[:not_started]] || 0
    }
  end

  def progress_percentage
    counts = task_status_counts
    return 0 if counts[:total].zero?

    completed_tasks = counts[:total] - counts[:not_started]
    (completed_tasks.to_f / counts[:total] * 100).round
  end
end
