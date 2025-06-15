class AddProjectToNotes < ActiveRecord::Migration[7.1]
  def change
    add_reference :notes, :project, foreign_key: true
  end
end
