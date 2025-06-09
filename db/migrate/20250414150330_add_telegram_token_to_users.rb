class AddTelegramTokenToUsers < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :telegram_bot_token, :string
    add_column :users, :telegram_chat_id, :string
  end
end
