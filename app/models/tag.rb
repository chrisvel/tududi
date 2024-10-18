class Tag < ActiveRecord::Base
  belongs_to :user
  has_and_belongs_to_many :tasks
  has_and_belongs_to_many :notes

  validates :name, presence: true, uniqueness: { scope: :user_id }
end
