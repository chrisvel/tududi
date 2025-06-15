class AddFieldsToProjects < ActiveRecord::Migration[7.1]
  def change
    add_column :projects, :description, :text
  end
end
