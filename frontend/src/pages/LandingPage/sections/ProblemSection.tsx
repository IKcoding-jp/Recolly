import styles from './ProblemSection.module.css'

export function ProblemSection() {
  return (
    <section className={styles.problem} id="problem">
      <div className={styles.container}>
        <div className={`${styles.label} reveal`}>
          <span className={styles.labelNum}>01</span>散らばる履歴
        </div>
        <div className={styles.grid}>
          <h2 className={`${styles.heading} reveal`}>
            観たドラマも、
            <br />
            読んだ本も、
            <br />
            プレイしたゲームも、
            <br />
            全部、別の場所。
          </h2>
          <div className={`${styles.body} reveal`}>
            <p>
              Netflix に視聴履歴、Kindle に読書履歴、Steam
              にプレイ時間。一つ一つは便利なのに、ジャンルをまたいで「自分が何を味わってきたか」を一箇所で振り返れる場所はありません。
            </p>
            <p>好きだった作品に、メディアをまたいで戻れる場所を。</p>
          </div>
        </div>
      </div>
    </section>
  )
}
