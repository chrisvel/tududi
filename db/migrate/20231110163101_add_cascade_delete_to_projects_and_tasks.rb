class AddCascadeDeleteToProjectsAndTasks < ActiveRecord::Migration[7.1]
  def change
    # Remove the existing foreign key from projects to areas
    remove_foreign_key :projects, :areas
    # Add the new foreign key with on_delete: :cascade
    add_foreign_key :projects, :areas, on_delete: :cascade

    # Remove the existing foreign key from tasks to projects
    remove_foreign_key :tasks, :projects
    # Add the new foreign key with on_delete: :cascade
    add_foreign_key :tasks, :projects, on_delete: :cascade
  end
end
