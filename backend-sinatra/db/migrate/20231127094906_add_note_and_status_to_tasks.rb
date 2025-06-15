class AddNoteAndStatusToTasks < ActiveRecord::Migration[7.1]
  def up
    add_column :tasks, :note, :text
    add_column :tasks, :status, :integer, default: 0

    execute <<-SQL.squish
      UPDATE tasks SET status = CASE
        WHEN completed = 't' THEN 2
        ELSE 0
      END
    SQL

    remove_column :tasks, :completed
  end

  def down
    add_column :tasks, :completed, :boolean, default: false

    execute <<-SQL.squish
      UPDATE tasks SET completed = 't'
      WHERE status = 2
    SQL

    remove_column :tasks, :status
    remove_column :tasks, :note
  end
end
