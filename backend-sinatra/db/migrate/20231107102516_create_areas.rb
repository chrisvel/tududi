class CreateAreas < ActiveRecord::Migration[7.1]
  def change
    create_table :areas do |t|
      t.string :name
      t.references :user, null: false, foreign_key: true

      t.timestamps null: false
    end
  end
end
