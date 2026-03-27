# Solid Queueのコアテーブル: ジョブと実行状態（ADR-0008）
class CreateSolidQueueTables < ActiveRecord::Migration[7.2]
  def change
    create_jobs_table
    create_scheduled_executions
    create_ready_executions
    create_claimed_executions
    create_blocked_executions
    create_failed_executions
    create_recurring_executions
  end

  private

  def create_jobs_table
    create_table :solid_queue_jobs do |t|
      t.string :queue_name, null: false
      t.string :class_name, null: false
      t.text :arguments
      t.integer :priority, default: 0, null: false
      t.string :active_job_id
      t.datetime :scheduled_at
      t.datetime :finished_at
      t.string :concurrency_key
      t.datetime :created_at, null: false
      t.datetime :updated_at, null: false

      t.index [:active_job_id], name: 'index_solid_queue_jobs_on_active_job_id'
      t.index [:class_name], name: 'index_solid_queue_jobs_on_class_name'
      t.index [:finished_at], name: 'index_solid_queue_jobs_on_finished_at'
      t.index %i[queue_name finished_at], name: 'index_solid_queue_jobs_for_filtering'
      t.index %i[scheduled_at finished_at], name: 'index_solid_queue_jobs_for_alerting'
    end
  end

  def create_scheduled_executions
    create_table :solid_queue_scheduled_executions do |t|
      t.bigint :job_id, null: false
      t.string :queue_name, null: false
      t.integer :priority, default: 0, null: false
      t.datetime :scheduled_at, null: false
      t.datetime :created_at, null: false

      t.index [:job_id], name: 'index_solid_queue_scheduled_executions_on_job_id', unique: true
      t.index %i[scheduled_at priority job_id], name: 'index_solid_queue_dispatch_all'
    end
  end

  def create_ready_executions
    create_table :solid_queue_ready_executions do |t|
      t.bigint :job_id, null: false
      t.string :queue_name, null: false
      t.integer :priority, default: 0, null: false
      t.datetime :created_at, null: false

      t.index [:job_id], name: 'index_solid_queue_ready_executions_on_job_id', unique: true
      t.index %i[priority job_id], name: 'index_solid_queue_poll_all'
      t.index %i[queue_name priority job_id], name: 'index_solid_queue_poll_by_queue'
    end
  end

  def create_claimed_executions
    create_table :solid_queue_claimed_executions do |t|
      t.bigint :job_id, null: false
      t.bigint :process_id
      t.datetime :created_at, null: false

      t.index [:job_id], name: 'index_solid_queue_claimed_executions_on_job_id', unique: true
      t.index %i[process_id job_id], name: 'index_solid_queue_claimed_executions_on_process_id_and_job_id'
    end
  end

  def create_blocked_executions
    create_table :solid_queue_blocked_executions do |t|
      t.bigint :job_id, null: false
      t.string :queue_name, null: false
      t.integer :priority, default: 0, null: false
      t.string :concurrency_key, null: false
      t.datetime :expires_at, null: false
      t.datetime :created_at, null: false

      t.index %i[concurrency_key priority job_id], name: 'index_solid_queue_blocked_executions_for_release'
      t.index %i[expires_at concurrency_key], name: 'index_solid_queue_blocked_executions_for_maintenance'
      t.index [:job_id], name: 'index_solid_queue_blocked_executions_on_job_id', unique: true
    end
  end

  def create_failed_executions
    create_table :solid_queue_failed_executions do |t|
      t.bigint :job_id, null: false
      t.text :error
      t.datetime :created_at, null: false

      t.index [:job_id], name: 'index_solid_queue_failed_executions_on_job_id', unique: true
    end
  end

  def create_recurring_executions
    create_table :solid_queue_recurring_executions do |t|
      t.bigint :job_id, null: false
      t.string :task_key, null: false
      t.datetime :run_at, null: false
      t.datetime :created_at, null: false

      t.index [:job_id], name: 'index_solid_queue_recurring_executions_on_job_id', unique: true
      t.index %i[task_key run_at], name: 'index_solid_queue_recurring_executions_on_task_key_and_run_at', unique: true
    end
  end
end
