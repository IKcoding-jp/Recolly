import { Link } from 'react-router-dom'
import styles from './FinalCtaSection.module.css'

export function FinalCtaSection() {
  return (
    <section className={styles.ctaFinal}>
      <div className={styles.container}>
        <h2 className={`${styles.heading} reveal`}>
          あなたの観たもの、読んだもの、プレイしたもの。
          <br />
          全部、ひとつの棚に。
        </h2>
        <Link className={`${styles.btnPrimary} reveal`} to="/signup">
          無料で始める
        </Link>
        <div className={`${styles.note} reveal`}>永久無料・カード不要</div>
      </div>
    </section>
  )
}
