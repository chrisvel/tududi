class AddTaskSummaryToUsers < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :task_summary_enabled, :boolean, default: false
    add_column :users, :task_summary_frequency, :string, default: 'daily'
  end
end

