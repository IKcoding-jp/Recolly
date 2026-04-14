import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './LandingNav.module.css'

/**
 * ランディングページ専用の固定ナビゲーション。
 * スクロール量が 20px を超えると下部に罫線が表れる。
 */
export function LandingNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.navScrolled : ''}`}>
      <Link to="/" className={styles.brand}>
        Recolly
      </Link>
      <div className={styles.actions}>
        <a className={`${styles.link} ${styles.hideMobile}`} href="#solution">
          特徴
        </a>
        <a className={`${styles.link} ${styles.hideMobile}`} href="#how">
          使い方
        </a>
        <a className={`${styles.link} ${styles.hideMobile}`} href="#faq">
          FAQ
        </a>
        <Link className={styles.link} to="/login">
          ログイン
        </Link>
        <Link className={styles.cta} to="/signup">
          無料で始める
        </Link>
      </div>
    </nav>
  )
}
