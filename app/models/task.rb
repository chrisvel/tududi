class Task < ActiveRecord::Base
  belongs_to :user
  belongs_to :project, optional: true

  default_scope { where(completed: false) }
end
