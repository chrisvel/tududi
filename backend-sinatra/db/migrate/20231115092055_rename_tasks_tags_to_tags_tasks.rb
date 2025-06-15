class RenameTasksTagsToTagsTasks < ActiveRecord::Migration[7.1]
  def change
    rename_table :tasks_tags, :tags_tasks
  end
end
