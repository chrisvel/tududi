class Project < ActiveRecord::Base
  belongs_to :user
  belongs_to :area, optional: true
  has_many :tasks, dependent: :destroy
end
