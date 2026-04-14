import styles from './HowItWorksSection.module.css'

const STEPS = [
  {
    num: '1.',
    title: '探す',
    body: '作品のタイトルで検索して、自分の棚に加えます。アニメも本もゲームも、入り口は一つ。',
  },
  {
    num: '2.',
    title: '記録する',
    body: '観終わったら、読み終わったら、クリアしたら、評価とメモを残します。一言だけでも十分です。',
  },
  {
    num: '3.',
    title: '振り返る',
    body: 'ライブラリや検索で、過去の作品にいつでも戻れます。ジャンルをまたいで、好きだったものを見返せます。',
  },
]

export function HowItWorksSection() {
  return (
    <section className={styles.how} id="how">
      <div className={styles.container}>
        <div className={`${styles.label} reveal`}>
          <span className={styles.labelNum}>03</span>使い方
        </div>
        <h2 className={`${styles.heading} reveal`}>三ステップで、ライブラリが育つ。</h2>
        <div className={styles.steps}>
          {STEPS.map((s) => (
            <div key={s.num} className={`${styles.step} reveal`}>
              <div className={styles.stepNum}>{s.num}</div>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepBody}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
