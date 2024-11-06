class Note < ActiveRecord::Base
  belongs_to :user
  belongs_to :project, optional: true
  has_and_belongs_to_many :tags

  validates :content, presence: true
  validates :title, presence: true, uniqueness: { scope: :user_id }
end
