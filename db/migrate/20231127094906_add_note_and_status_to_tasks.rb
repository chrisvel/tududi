class AddNoteAndStatusToTasks < ActiveRecord::Migration[7.1]
  def up
    add_column :tasks, :note, :text
    add_column :tasks, :status, :integer, default: 0

    Task.reset_column_information
    Task.find_each do |task|
      task.update_column(:status, task.completed ? 2 : 0)
    end

    remove_column :tasks, :completed
  end

  def down
    add_column :tasks, :completed, :boolean, default: false

    Task.reset_column_information
    Task.where(status: 2).update_all(completed: true)

    remove_column :tasks, :status
    remove_column :tasks, :note
  end
end
