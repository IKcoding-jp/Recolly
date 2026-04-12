import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { useRecollyMotion } from '../../lib/motion'
import styles from './EmailPromptBanner.module.css'

export function EmailPromptBanner() {
  const m = useRecollyMotion()

  return (
    <motion.div
      className={styles.banner}
      variants={m.banner}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <p className={styles.text}>
        メールアドレスを設定すると、パスワードリセットなどの機能が使えるようになります。
      </p>
      <Link to="/auth/email-setup" className={styles.link}>
        メールアドレスを設定する
      </Link>
    </motion.div>
  )
}
