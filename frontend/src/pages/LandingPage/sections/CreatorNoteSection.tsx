import styles from './CreatorNoteSection.module.css'

export function CreatorNoteSection() {
  return (
    <section className={styles.creator}>
      <div className={styles.inner}>
        <div className={`${styles.label} reveal`}>
          <span className={styles.labelNum}>05</span>なぜ作ったか
        </div>
        <div className={`${styles.body} reveal`}>
          <p>
            作者の IK です。好きな作品を振り返りたくなったとき、Netflix の視聴履歴を開き、Kindle
            のライブラリを開き、Steam
            のプレイ時間を見る——そんなことを何度もしていました。どれも便利なサービスです。
          </p>
          <p>
            でも、ジャンルをまたいで「自分が味わってきたもの」を一箇所で俯瞰する場所は、どこにもありませんでした。Recolly
            は、そのための場所として作りました。
          </p>
        </div>
        <div className={`${styles.signature} reveal`}>— IK, 作者</div>
      </div>
    </section>
  )
}
