import { Link } from 'react-router-dom'
import styles from './EmailPromptBanner.module.css'

export function EmailPromptBanner() {
  return (
    <div className={styles.banner}>
      <p className={styles.text}>
        メールアドレスを設定すると、パスワードリセットなどの機能が使えるようになります。
      </p>
      <Link to="/auth/email-setup" className={styles.link}>
        メールアドレスを設定する
      </Link>
    </div>
  )
}
