class Project < ActiveRecord::Base
  belongs_to :user
  belongs_to :area, optional: true
  has_many :tasks, dependent: :destroy
  has_many :notes, dependent: :destroy

  scope :with_incomplete_tasks, -> { joins(:tasks).where.not(tasks: { status: Task.statuses[:done] }).distinct }
  scope :with_complete_tasks, -> { joins(:tasks).where(tasks: { status: Task.statuses[:done] }).distinct }

  validates :name, presence: true

  def task_status_counts
    {
      total: tasks.count,
      in_progress: tasks.where(status: Task.statuses[:in_progress]).count,
      done: tasks.where(status: Task.statuses[:done]).count,
      not_started: tasks.where(status: Task.statuses[:not_started]).count
    }
  end

  def progress_percentage
    counts = task_status_counts
    return 0 if counts[:total].zero?

    completed_tasks = counts[:total] - counts[:not_started]
    (completed_tasks.to_f / counts[:total] * 100).round
  end
end
