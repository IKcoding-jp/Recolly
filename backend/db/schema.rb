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

ActiveRecord::Schema[8.1].define(version: 2026_04_05_033100) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "comments", force: :cascade do |t|
    t.text "body", null: false
    t.datetime "created_at", null: false
    t.bigint "discussion_id", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["discussion_id", "created_at"], name: "index_comments_on_discussion_id_and_created_at"
    t.index ["discussion_id"], name: "index_comments_on_discussion_id"
    t.index ["user_id"], name: "index_comments_on_user_id"
  end

  create_table "discussions", force: :cascade do |t|
    t.text "body", null: false
    t.integer "comments_count", default: 0, null: false
    t.datetime "created_at", null: false
    t.integer "episode_number"
    t.boolean "has_spoiler", default: false, null: false
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.bigint "work_id", null: false
    t.index ["user_id"], name: "index_discussions_on_user_id"
    t.index ["work_id", "created_at"], name: "index_discussions_on_work_id_and_created_at"
    t.index ["work_id"], name: "index_discussions_on_work_id"
  end

  create_table "episode_reviews", force: :cascade do |t|
    t.text "body", null: false
    t.datetime "created_at", null: false
    t.integer "episode_number", null: false
    t.bigint "record_id", null: false
    t.datetime "updated_at", null: false
    t.integer "visibility", default: 0, null: false
    t.index ["record_id", "episode_number"], name: "index_episode_reviews_on_record_id_and_episode_number", unique: true
    t.index ["record_id"], name: "index_episode_reviews_on_record_id"
  end

  create_table "favorite_works", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "position", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.bigint "work_id", null: false
    t.index ["user_id", "position"], name: "index_favorite_works_on_user_id_and_position", unique: true
    t.index ["user_id", "work_id"], name: "index_favorite_works_on_user_id_and_work_id", unique: true
    t.index ["user_id"], name: "index_favorite_works_on_user_id"
    t.index ["work_id"], name: "index_favorite_works_on_work_id"
  end

  create_table "images", force: :cascade do |t|
    t.string "content_type", null: false
    t.datetime "created_at", null: false
    t.string "file_name", null: false
    t.integer "file_size", null: false
    t.bigint "imageable_id", null: false
    t.string "imageable_type", null: false
    t.string "s3_key", null: false
    t.datetime "updated_at", null: false
    t.index ["imageable_type", "imageable_id"], name: "index_images_on_imageable"
    t.index ["s3_key"], name: "index_images_on_s3_key", unique: true
  end

  create_table "recommendations", force: :cascade do |t|
    t.text "analysis_summary"
    t.datetime "analyzed_at"
    t.jsonb "challenge_works", default: []
    t.datetime "created_at", null: false
    t.jsonb "genre_stats", default: []
    t.jsonb "preference_scores", default: []
    t.jsonb "recommended_works", default: []
    t.integer "record_count", default: 0
    t.jsonb "top_tags", default: []
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["user_id"], name: "index_recommendations_on_user_id", unique: true
  end

  create_table "record_tags", force: :cascade do |t|
    t.bigint "record_id", null: false
    t.bigint "tag_id", null: false
    t.index ["record_id", "tag_id"], name: "index_record_tags_on_record_id_and_tag_id", unique: true
    t.index ["record_id"], name: "index_record_tags_on_record_id"
    t.index ["tag_id"], name: "index_record_tags_on_tag_id"
  end

  create_table "records", force: :cascade do |t|
    t.date "completed_at"
    t.datetime "created_at", null: false
    t.integer "current_episode", default: 0
    t.integer "rating"
    t.text "review_text"
    t.integer "rewatch_count", default: 0
    t.date "started_at"
    t.integer "status", default: 4, null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.integer "visibility", default: 0, null: false
    t.bigint "work_id", null: false
    t.index ["user_id", "work_id"], name: "index_records_on_user_id_and_work_id", unique: true
    t.index ["user_id"], name: "index_records_on_user_id"
    t.index ["work_id"], name: "index_records_on_work_id"
  end

  create_table "solid_cache_entries", force: :cascade do |t|
    t.integer "byte_size", null: false
    t.datetime "created_at", null: false
    t.binary "key", null: false
    t.bigint "key_hash", null: false
    t.binary "value", null: false
    t.index ["byte_size"], name: "index_solid_cache_entries_on_byte_size"
    t.index ["key_hash", "byte_size"], name: "index_solid_cache_entries_on_key_hash_and_byte_size"
    t.index ["key_hash"], name: "index_solid_cache_entries_on_key_hash", unique: true
  end

  create_table "solid_queue_blocked_executions", force: :cascade do |t|
    t.string "concurrency_key", null: false
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.index ["concurrency_key", "priority", "job_id"], name: "index_solid_queue_blocked_executions_for_release"
    t.index ["expires_at", "concurrency_key"], name: "index_solid_queue_blocked_executions_for_maintenance"
    t.index ["job_id"], name: "index_solid_queue_blocked_executions_on_job_id", unique: true
  end

  create_table "solid_queue_claimed_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.bigint "process_id"
    t.index ["job_id"], name: "index_solid_queue_claimed_executions_on_job_id", unique: true
    t.index ["process_id", "job_id"], name: "index_solid_queue_claimed_executions_on_process_id_and_job_id"
  end

  create_table "solid_queue_failed_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "error"
    t.bigint "job_id", null: false
    t.index ["job_id"], name: "index_solid_queue_failed_executions_on_job_id", unique: true
  end

  create_table "solid_queue_jobs", force: :cascade do |t|
    t.string "active_job_id"
    t.text "arguments"
    t.string "class_name", null: false
    t.string "concurrency_key"
    t.datetime "created_at", null: false
    t.datetime "finished_at"
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.datetime "scheduled_at"
    t.datetime "updated_at", null: false
    t.index ["active_job_id"], name: "index_solid_queue_jobs_on_active_job_id"
    t.index ["class_name"], name: "index_solid_queue_jobs_on_class_name"
    t.index ["finished_at"], name: "index_solid_queue_jobs_on_finished_at"
    t.index ["queue_name", "finished_at"], name: "index_solid_queue_jobs_for_filtering"
    t.index ["scheduled_at", "finished_at"], name: "index_solid_queue_jobs_for_alerting"
  end

  create_table "solid_queue_pauses", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "queue_name", null: false
    t.index ["queue_name"], name: "index_solid_queue_pauses_on_queue_name", unique: true
  end

  create_table "solid_queue_processes", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "hostname"
    t.string "kind", null: false
    t.datetime "last_heartbeat_at", null: false
    t.text "metadata"
    t.string "name", null: false
    t.integer "pid", null: false
    t.bigint "supervisor_id"
    t.index ["last_heartbeat_at"], name: "index_solid_queue_processes_on_last_heartbeat_at"
    t.index ["name", "supervisor_id"], name: "index_solid_queue_processes_on_name_and_supervisor_id", unique: true
    t.index ["supervisor_id"], name: "index_solid_queue_processes_on_supervisor_id"
  end

  create_table "solid_queue_ready_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.index ["job_id"], name: "index_solid_queue_ready_executions_on_job_id", unique: true
    t.index ["priority", "job_id"], name: "index_solid_queue_poll_all"
    t.index ["queue_name", "priority", "job_id"], name: "index_solid_queue_poll_by_queue"
  end

  create_table "solid_queue_recurring_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.datetime "run_at", null: false
    t.string "task_key", null: false
    t.index ["job_id"], name: "index_solid_queue_recurring_executions_on_job_id", unique: true
    t.index ["task_key", "run_at"], name: "index_solid_queue_recurring_executions_on_task_key_and_run_at", unique: true
  end

  create_table "solid_queue_recurring_tasks", force: :cascade do |t|
    t.text "arguments"
    t.string "class_name"
    t.string "command", limit: 2048
    t.datetime "created_at", null: false
    t.text "description"
    t.string "key", null: false
    t.integer "priority", default: 0
    t.string "queue_name"
    t.string "schedule", null: false
    t.boolean "static", default: true, null: false
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_solid_queue_recurring_tasks_on_key", unique: true
    t.index ["static"], name: "index_solid_queue_recurring_tasks_on_static"
  end

  create_table "solid_queue_scheduled_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.datetime "scheduled_at", null: false
    t.index ["job_id"], name: "index_solid_queue_scheduled_executions_on_job_id", unique: true
    t.index ["scheduled_at", "priority", "job_id"], name: "index_solid_queue_dispatch_all"
  end

  create_table "solid_queue_semaphores", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.string "key", null: false
    t.datetime "updated_at", null: false
    t.integer "value", default: 1, null: false
    t.index ["expires_at"], name: "index_solid_queue_semaphores_on_expires_at"
    t.index ["key", "value"], name: "index_solid_queue_semaphores_on_key_and_value"
    t.index ["key"], name: "index_solid_queue_semaphores_on_key", unique: true
  end

  create_table "tags", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "name", limit: 30, null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["user_id", "name"], name: "index_tags_on_user_id_and_name", unique: true
    t.index ["user_id"], name: "index_tags_on_user_id"
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
    t.string "favorite_display_mode", default: "ranking", null: false
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
    t.datetime "last_synced_at"
    t.integer "media_type", null: false
    t.jsonb "metadata", default: {}
    t.string "title", null: false
    t.integer "total_episodes"
    t.datetime "updated_at", null: false
    t.index ["external_api_id", "external_api_source"], name: "index_works_on_external_api_id_and_external_api_source", unique: true, where: "(external_api_id IS NOT NULL)"
  end

  add_foreign_key "comments", "discussions"
  add_foreign_key "comments", "users"
  add_foreign_key "discussions", "users"
  add_foreign_key "discussions", "works"
  add_foreign_key "episode_reviews", "records"
  add_foreign_key "favorite_works", "users"
  add_foreign_key "favorite_works", "works"
  add_foreign_key "recommendations", "users"
  add_foreign_key "record_tags", "records"
  add_foreign_key "record_tags", "tags"
  add_foreign_key "records", "users"
  add_foreign_key "records", "works"
  add_foreign_key "solid_queue_blocked_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_claimed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_failed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_ready_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_recurring_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_scheduled_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "tags", "users"
  add_foreign_key "user_providers", "users"
end
