class CreateTasksTags < ActiveRecord::Migration[7.1]
  def change
    create_table :tasks_tags, id: false do |t|
      t.belongs_to :task, null: false, foreign_key: true
      t.belongs_to :tag, null: false, foreign_key: true
    end
  end
end
