class Note < ActiveRecord::Base
  belongs_to :user, dependent: :destroy
  has_and_belongs_to_many :tags

  validates :content, presence: true
end
