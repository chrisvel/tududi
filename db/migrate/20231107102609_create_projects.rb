class CreateProjects < ActiveRecord::Migration[7.1]
  def change
    create_table :projects do |t|
      t.string :name
      t.references :user, null: false, foreign_key: true
      t.references :area, foreign_key: true

      t.timestamps null: false
    end
  end
end
