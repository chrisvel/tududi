class User < ActiveRecord::Base
  has_secure_password

  has_many :areas
  has_many :projects
  has_many :tasks
  has_many :tags, dependent: :destroy

  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }, uniqueness: true
end
