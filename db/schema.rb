# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.1].define(version: 2025_04_16_235420) do
  create_table "areas", force: :cascade do |t|
    t.string "name"
    t.integer "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "description"
    t.index ["user_id"], name: "index_areas_on_user_id"
  end

  create_table "inbox_items", force: :cascade do |t|
    t.string "content", null: false
    t.integer "user_id", null: false
    t.string "status", default: "added"
    t.string "source", default: "tududi"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_inbox_items_on_user_id"
  end

  create_table "notes", force: :cascade do |t|
    t.text "content"
    t.integer "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "title"
    t.integer "project_id"
    t.index ["project_id"], name: "index_notes_on_project_id"
    t.index ["user_id"], name: "index_notes_on_user_id"
  end

  create_table "notes_tags", id: false, force: :cascade do |t|
    t.integer "note_id", null: false
    t.integer "tag_id", null: false
    t.index ["note_id"], name: "index_notes_tags_on_note_id"
    t.index ["tag_id"], name: "index_notes_tags_on_tag_id"
  end

  create_table "projects", force: :cascade do |t|
    t.string "name"
    t.integer "user_id", null: false
    t.integer "area_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "description"
    t.boolean "active", default: false
    t.boolean "pin_to_sidebar", default: false
    t.integer "priority"
    t.datetime "due_date_at"
    t.index ["area_id"], name: "index_projects_on_area_id"
    t.index ["user_id"], name: "index_projects_on_user_id"
  end

  create_table "projects_tags", id: false, force: :cascade do |t|
    t.integer "project_id", null: false
    t.integer "tag_id", null: false
    t.index ["project_id"], name: "index_projects_tags_on_project_id"
    t.index ["tag_id"], name: "index_projects_tags_on_tag_id"
  end

  create_table "tags", force: :cascade do |t|
    t.string "name"
    t.integer "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_tags_on_user_id"
  end

  create_table "tags_tasks", id: false, force: :cascade do |t|
    t.integer "task_id", null: false
    t.integer "tag_id", null: false
    t.index ["tag_id"], name: "index_tags_tasks_on_tag_id"
    t.index ["task_id"], name: "index_tags_tasks_on_task_id"
  end

  create_table "tasks", force: :cascade do |t|
    t.string "name"
    t.datetime "due_date"
    t.integer "user_id", null: false
    t.integer "project_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "today", default: false
    t.text "description"
    t.integer "priority"
    t.text "note"
    t.integer "status", default: 0
    t.string "recurrence_type", default: "none"
    t.integer "recurrence_interval"
    t.datetime "recurrence_end_date"
    t.datetime "last_generated_date"
    t.index ["last_generated_date"], name: "index_tasks_on_last_generated_date"
    t.index ["project_id"], name: "index_tasks_on_project_id"
    t.index ["recurrence_type"], name: "index_tasks_on_recurrence_type"
    t.index ["user_id"], name: "index_tasks_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "name"
    t.string "email"
    t.string "password_digest"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "appearance", default: "light", null: false
    t.string "language", default: "en", null: false
    t.string "timezone", default: "UTC", null: false
    t.string "avatar_image"
    t.string "telegram_bot_token"
    t.string "telegram_chat_id"
    t.boolean "task_summary_enabled", default: false
    t.string "task_summary_frequency", default: "daily"
    t.datetime "task_summary_last_run"
    t.datetime "task_summary_next_run"
  end

  add_foreign_key "areas", "users"
  add_foreign_key "inbox_items", "users"
  add_foreign_key "notes", "projects"
  add_foreign_key "notes", "users", on_delete: :cascade
  add_foreign_key "projects", "areas", on_delete: :cascade
  add_foreign_key "projects", "users"
  add_foreign_key "projects_tags", "projects"
  add_foreign_key "projects_tags", "tags"
  add_foreign_key "tags", "users", on_delete: :cascade
  add_foreign_key "tags_tasks", "tags"
  add_foreign_key "tags_tasks", "tasks"
  add_foreign_key "tasks", "projects", on_delete: :cascade
  add_foreign_key "tasks", "users"
end
