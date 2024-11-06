class CreateDescriptionForArea < ActiveRecord::Migration[7.1]
  def change
    add_column :areas, :description, :string
  end
end
