import { Link } from 'react-router-dom'
import styles from './Footer.module.css'

/**
 * 全ページ共通のフッター。
 *
 * Cookie 同意バナーを実装しない方針のため、プライバシーポリシーへの導線を
 * 常に露出する目的で配置する。
 *
 * Spec: docs/superpowers/specs/2026-04-13-analytics-tracking-design.md 4.4 節
 */
export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span className={styles.brand}>© Recolly</span>
        <nav className={styles.nav}>
          <Link to="/privacy" className={styles.link}>
            プライバシーポリシー
          </Link>
        </nav>
      </div>
    </footer>
  )
}
