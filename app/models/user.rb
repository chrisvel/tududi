class User < ActiveRecord::Base
  has_secure_password

  has_many :areas
  has_many :projects
  has_many :tasks

  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }, uniqueness: true
end
