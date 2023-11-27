class Task < ActiveRecord::Base
  belongs_to :user
  belongs_to :project, optional: true
  has_and_belongs_to_many :tags

  enum priority: { low: 0, medium: 1, high: 2 }
  enum status: { not_started: 0, in_progress: 1, done: 2, archived: 3 }

  scope :complete, -> { where(status: statuses[:done]) }
  scope :incomplete, -> { where.not(status: statuses[:done]) }

  validates :name, presence: true
end
