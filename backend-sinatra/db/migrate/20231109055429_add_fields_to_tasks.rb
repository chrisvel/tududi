class AddFieldsToTasks < ActiveRecord::Migration[7.1]
  def change
    add_column :tasks, :today, :boolean, default: false
    add_column :tasks, :description, :text
    add_column :tasks, :completed, :boolean, default: false
  end
end
