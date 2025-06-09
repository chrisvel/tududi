class InboxItem < ActiveRecord::Base
  belongs_to :user

  enum status: { added: 'added', processed: 'processed', deleted: 'deleted' }
  enum source: { tududi: 'tududi', telegram: 'telegram' }

  scope :active, -> { where(status: 'added') }
  scope :processed, -> { where(status: 'processed') }
  scope :by_source, ->(source) { where(source: source) }

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
