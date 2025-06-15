class AddCascadeDeleteToProjectsAndTasks < ActiveRecord::Migration[7.1]
  def change
    remove_foreign_key :projects, :areas
    add_foreign_key :projects, :areas, on_delete: :cascade

    remove_foreign_key :tasks, :projects
    add_foreign_key :tasks, :projects, on_delete: :cascade
  end
end
