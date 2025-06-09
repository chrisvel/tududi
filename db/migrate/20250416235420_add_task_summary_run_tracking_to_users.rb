class AddTaskSummaryRunTrackingToUsers < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :task_summary_last_run, :datetime
    add_column :users, :task_summary_next_run, :datetime
  end
end

