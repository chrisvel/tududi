class CreateProjectsTags < ActiveRecord::Migration[7.1]
  def change
    create_table :projects_tags, id: false do |t|
      t.integer :project_id, null: false
      t.integer :tag_id, null: false
    end

    add_index :projects_tags, :project_id
    add_index :projects_tags, :tag_id

    add_foreign_key :projects_tags, :projects
    add_foreign_key :projects_tags, :tags
  end
end
