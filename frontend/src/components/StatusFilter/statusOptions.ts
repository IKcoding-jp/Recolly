// ステータスフィルタの選択肢を動的に生成する
import { getStatusOptions } from '../../lib/mediaTypeUtils'

export { getStatusOptions }

// 後方互換: LibraryPage が Task 8 で getStatusOptions に移行するまで残す
export const STATUS_OPTIONS = getStatusOptions()
