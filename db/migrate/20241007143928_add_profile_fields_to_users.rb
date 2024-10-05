class AddProfileFieldsToUsers < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :appearance, :string, default: 'light', null: false
    add_column :users, :language, :string, default: 'en', null: false
    add_column :users, :timezone, :string, default: 'UTC', null: false
    add_column :users, :avatar_image, :string
  end
end
