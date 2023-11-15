class Task < ActiveRecord::Base
  belongs_to :user
  belongs_to :project, optional: true
  has_and_belongs_to_many :tags

  scope :complete, -> { where(completed: true) }
  scope :incomplete, -> { where(completed: false) }
end
