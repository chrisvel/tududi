class User < ActiveRecord::Base
  has_secure_password

  TASK_SUMMARY_FREQUENCIES = %w[daily weekdays weekly 1h 2h 4h 8h 12h].freeze

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
  validates :task_summary_frequency, inclusion: { in: TASK_SUMMARY_FREQUENCIES }, allow_nil: true

  # has_one_attached :avatar_image
end
