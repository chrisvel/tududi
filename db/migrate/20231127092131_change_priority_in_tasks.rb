class ChangePriorityInTasks < ActiveRecord::Migration[7.1]
  def up
    add_column :tasks, :new_priority, :integer

    Task.reset_column_information
    Task.find_each do |task|
      new_value = case task.priority
                  when 'Low' then 0
                  when 'Medium' then 1
                  when 'High' then 2
                  else 0
                  end
      task.update_column(:new_priority, new_value)
    end

    remove_column :tasks, :priority
    rename_column :tasks, :new_priority, :priority
  end

  def down
    add_column :tasks, :old_priority, :string

    Task.reset_column_information
    Task.find_each do |task|
      old_value = case task.priority
                  when 0 then 'Low'
                  when 1 then 'Medium'
                  when 2 then 'High'
                  else 'Low'
                  end
      task.update_column(:old_priority, old_value)
    end

    remove_column :tasks, :priority
    rename_column :tasks, :old_priority, :priority
  end
end
