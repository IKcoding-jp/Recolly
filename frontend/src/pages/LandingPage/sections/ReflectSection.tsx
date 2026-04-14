import styles from './ReflectSection.module.css'

export function ReflectSection() {
  return (
    <section className={styles.reflect}>
      <div className={styles.container}>
        <div className={`${styles.label} reveal`}>
          <span className={styles.labelNum}>04</span>数か月後、数年後に
        </div>
        <div className={styles.grid}>
          <h2 className={`${styles.heading} reveal`}>
            続けていると、
            <br />
            自分の好みが
            <br />
            見えてくる。
          </h2>
          <div className={`${styles.body} reveal`}>
            <p>
              記録を続けていると、ジャンルをまたいだ自分の好みが見えてきます。「去年一番よかったのは何だっけ」「最近こういうの観てるな」——過去の蓄積が、これからの作品選びのヒントになります。
            </p>
            <p>Recolly は、記録そのものよりも、振り返れるようになった後に価値が出るツールです。</p>
          </div>
        </div>
      </div>
    </section>
  )
}
