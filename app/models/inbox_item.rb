class InboxItem < ActiveRecord::Base
  belongs_to :user

  # Enum for status
  enum status: { added: 'added', processed: 'processed', deleted: 'deleted' }
  
  # Enum for source
  enum source: { tududi: 'tududi', telegram: 'telegram' }
  
  # Scopes
  scope :active, -> { where(status: 'added') }
  scope :processed, -> { where(status: 'processed') }
  scope :by_source, ->(source) { where(source: source) }
  
  # Validations
  validates :content, presence: true
  validates :status, inclusion: { in: statuses.keys }
  validates :source, inclusion: { in: sources.keys }
  
  def mark_as_processed!
    update(status: 'processed')
  end
  
  def mark_as_deleted!
    update(status: 'deleted')
  end
end