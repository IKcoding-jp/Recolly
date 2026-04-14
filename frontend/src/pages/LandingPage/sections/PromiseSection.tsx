import styles from './PromiseSection.module.css'

export function PromiseSection() {
  return (
    <section className={styles.promise}>
      <div className={styles.inner}>
        <div className={`${styles.label} reveal`}>
          <span className={styles.labelNum}>06</span>約束
        </div>
        <h2 className={`${styles.heading} reveal`}>基本機能は、これから先も無料で使えます。</h2>
        <div className={`${styles.body} reveal`}>
          <p>
            Recolly の<strong>記録・ライブラリ・検索・おすすめ</strong>
            は、これから先も無料で使えます。将来、詳細統計やデータエクスポートのような付加価値機能のみ有料化する可能性はありますが、あなたの日々の記録を人質にすることはありません。
          </p>
        </div>
      </div>
    </section>
  )
}
