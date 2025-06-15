class CreateTasks < ActiveRecord::Migration[7.1]
  def change
    create_table :tasks do |t|
      t.string :name
      t.string :priority
      t.datetime :due_date
      t.references :user, null: false, foreign_key: true
      t.references :project, foreign_key: true

      t.timestamps null: false
    end
  end
end
