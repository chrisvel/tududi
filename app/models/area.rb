class Area < ActiveRecord::Base
  belongs_to :user
  has_many :projects, dependent: :destroy

  validates :name, presence: true, uniqueness: { scope: :user_id }
end
