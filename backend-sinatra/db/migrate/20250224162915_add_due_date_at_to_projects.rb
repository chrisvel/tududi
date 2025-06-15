class AddDueDateAtToProjects < ActiveRecord::Migration[7.1]
  def change
    add_column :projects, :due_date_at, :datetime
  end
end
