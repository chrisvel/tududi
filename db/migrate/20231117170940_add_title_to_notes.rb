class AddTitleToNotes < ActiveRecord::Migration[7.1]
  def change
    add_column :notes, :title, :string
  end
end
