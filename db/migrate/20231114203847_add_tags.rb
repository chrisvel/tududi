class AddTags < ActiveRecord::Migration[7.1]
  def change
    create_table :tags do |t|
      t.string :name
      t.references :user, null: false, foreign_key: { on_delete: :cascade }

      t.timestamps
    end
  end
end
