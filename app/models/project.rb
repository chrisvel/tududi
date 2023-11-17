class Project < ActiveRecord::Base
  belongs_to :user
  belongs_to :area, optional: true
  has_many :tasks, dependent: :destroy

  scope :with_incomplete_tasks, -> { joins(:tasks).where(tasks: { completed: false }).distinct }
  scope :with_complete_tasks, -> { joins(:tasks).where(tasks: { completed: true }).distinct }

  validates :name, presence: true
end
