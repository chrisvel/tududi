class User < ActiveRecord::Base
  has_secure_password

  has_many :tasks, dependent: :destroy
  has_many :projects, dependent: :destroy
  has_many :areas, dependent: :destroy
  has_many :notes, dependent: :destroy
  has_many :tags, dependent: :destroy
  has_many :inbox_items, dependent: :destroy

  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }, uniqueness: true
  validates :appearance, inclusion: { in: %w[light dark] }
  validates :language, presence: true
  validates :timezone, presence: true

  # has_one_attached :avatar_image
end
