class AddPriorityToProjects < ActiveRecord::Migration[7.1]
  def change
    add_column :projects, :priority, :integer
  end
end
