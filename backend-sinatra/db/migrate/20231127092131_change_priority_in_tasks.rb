class ChangePriorityInTasks < ActiveRecord::Migration[7.1]
  def up
    add_column :tasks, :new_priority, :integer

    execute <<-SQL.squish
      UPDATE tasks SET new_priority = CASE
        WHEN priority = 'Low' THEN 0
        WHEN priority = 'Medium' THEN 1
        WHEN priority = 'High' THEN 2
        ELSE 0
      END
    SQL

    remove_column :tasks, :priority
    rename_column :tasks, :new_priority, :priority
  end

  def down
    add_column :tasks, :old_priority, :string

    execute <<-SQL.squish
      UPDATE tasks SET old_priority = CASE
        WHEN priority = 0 THEN 'Low'
        WHEN priority = 1 THEN 'Medium'
        WHEN priority = 2 THEN 'High'
        ELSE 'Low'
      END
    SQL

    remove_column :tasks, :priority
    rename_column :tasks, :old_priority, :priority
  end
end
