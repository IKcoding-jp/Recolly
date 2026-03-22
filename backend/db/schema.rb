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

ActiveRecord::Schema[8.1].define(version: 2026_03_22_235321) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "records", force: :cascade do |t|
    t.date "completed_at"
    t.datetime "created_at", null: false
    t.integer "current_episode", default: 0
    t.integer "rating"
    t.integer "rewatch_count", default: 0
    t.date "started_at"
    t.integer "status", default: 4, null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.bigint "work_id", null: false
    t.index ["user_id", "work_id"], name: "index_records_on_user_id_and_work_id", unique: true
    t.index ["user_id"], name: "index_records_on_user_id"
    t.index ["work_id"], name: "index_records_on_work_id"
  end

  create_table "user_providers", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "provider", null: false
    t.string "provider_uid", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["provider", "provider_uid"], name: "index_user_providers_on_provider_and_provider_uid", unique: true
    t.index ["user_id", "provider"], name: "index_user_providers_on_user_id_and_provider", unique: true
    t.index ["user_id"], name: "index_user_providers_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "avatar_url"
    t.text "bio"
    t.datetime "created_at", null: false
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.datetime "remember_created_at"
    t.datetime "reset_password_sent_at"
    t.string "reset_password_token"
    t.datetime "updated_at", null: false
    t.string "username", null: false
    t.index ["email"], name: "index_users_on_email", unique: true, where: "((email)::text <> ''::text)"
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
    t.index ["username"], name: "index_users_on_username", unique: true
  end

  create_table "works", force: :cascade do |t|
    t.string "cover_image_url"
    t.datetime "created_at", null: false
    t.text "description"
    t.string "external_api_id"
    t.string "external_api_source"
    t.integer "media_type", null: false
    t.jsonb "metadata", default: {}
    t.string "title", null: false
    t.integer "total_episodes"
    t.datetime "updated_at", null: false
    t.index ["external_api_id", "external_api_source"], name: "index_works_on_external_api_id_and_external_api_source", unique: true, where: "(external_api_id IS NOT NULL)"
  end

  add_foreign_key "records", "users"
  add_foreign_key "records", "works"
  add_foreign_key "user_providers", "users"
end
