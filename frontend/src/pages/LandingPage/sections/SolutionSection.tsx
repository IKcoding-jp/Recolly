import styles from './SolutionSection.module.css'

type Feature = {
  num: string
  title: string
  body: string
}

const FEATURES: Feature[] = [
  {
    num: '01',
    title: '6 ジャンルをまとめて記録',
    body: 'アニメ、映画、ドラマ、本、漫画、ゲーム。すべての作品を同じ使い心地で、一箇所に記録できます。',
  },
  {
    num: '02',
    title: '評価は 10 点満点で統一',
    body: 'サービスごとに評価基準が違う問題をなくします。全作品を同じ尺度で並べられるので、過去の蓄積がそのまま比較可能な資産になります。',
  },
  {
    num: '03',
    title: 'いつでも振り返れるライブラリ',
    body: '「去年観たドラマってなんだっけ」にすぐ答えられます。タグや検索で、過去の記録に戻れます。',
  },
  {
    num: '04',
    title: 'シンプルで静かな UI',
    body: '派手な通知もランキング競争もありません。自分のペースで、落ち着いて使える場所です。',
  },
]

export function SolutionSection() {
  return (
    <section className={styles.solution} id="solution">
      <div className={styles.container}>
        <div className={`${styles.label} reveal`}>
          <span className={styles.labelNum}>02</span>できること
        </div>
        <h2 className={`${styles.heading} reveal`}>ジャンルの壁を越えて、作品を記録する。</h2>
        <div className={styles.grid}>
          {FEATURES.map((f) => (
            <div key={f.num} className={`${styles.feature} reveal`}>
              <div className={styles.featureNum}>{f.num}</div>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureBody}>{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
