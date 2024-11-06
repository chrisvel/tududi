class AddPinToSidebarToProjects < ActiveRecord::Migration[7.1]
  def change
    add_column :projects, :pin_to_sidebar, :boolean, default: false
  end
end
