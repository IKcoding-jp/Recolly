// ステータスフィルタの選択肢定数
import type { RecordStatus } from '../../lib/types'

export const STATUS_OPTIONS: { value: RecordStatus | null; label: string }[] = [
  { value: null, label: 'すべて' },
  { value: 'watching', label: '視聴中' },
  { value: 'completed', label: '視聴完了' },
  { value: 'on_hold', label: '一時停止' },
  { value: 'dropped', label: '中断' },
  { value: 'plan_to_watch', label: '視聴予定' },
]
