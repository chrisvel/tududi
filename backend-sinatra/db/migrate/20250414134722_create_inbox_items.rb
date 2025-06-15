class CreateInboxItems < ActiveRecord::Migration[7.1]
  def change
    create_table :inbox_items do |t|
      t.string :content, null: false
      t.references :user, null: false, foreign_key: true
      t.string :status, default: 'added'
      t.string :source, default: 'tududi'
      t.timestamps
    end
  end
end
