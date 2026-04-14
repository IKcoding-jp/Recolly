import styles from './FaqSection.module.css'

type Faq = {
  num: string
  q: string
  a: string
}

const FAQS: Faq[] = [
  {
    num: 'Q1',
    q: 'Netflix や Kindle のような視聴・読書サービスとは何が違いますか？',
    a: 'Recolly は、視聴や読書そのものを提供するサービスではありません。既存の配信・電子書籍サービスで味わった作品を「まとめて記録し、振り返る」ための場所です。視聴や読書はこれまで通り既存のサービスで、記録と振り返りは Recolly で、という使い方になります。',
  },
  {
    num: 'Q2',
    q: '他のサービスの記録は Recolly に移行できますか？',
    a: '現状、エクスポート／インポート機能は対応していません。今後の検討事項として、ユーザーの声を見ながら判断していきます。',
  },
  {
    num: 'Q3',
    q: 'スマホと PC どちらでも使えますか？',
    a: '両方で使えます。PWA に対応しているので、スマホのホーム画面に追加すればアプリのように起動できます。',
  },
  {
    num: 'Q4',
    q: '記録は他の人に公開されますか？',
    a: 'プロフィールの一部は公開ベースの設計になっています。将来、より細かく公開範囲を選べる非公開モードを追加する予定です。',
  },
]

export function FaqSection() {
  return (
    <section className={styles.faq} id="faq">
      <div className={styles.container}>
        <div className={`${styles.label} reveal`}>
          <span className={styles.labelNum}>07</span>よくある質問
        </div>
        <h2 className={`${styles.heading} reveal`}>よくある質問</h2>
        <div className={styles.list}>
          {FAQS.map((f) => (
            <div key={f.num} className={`${styles.item} reveal`}>
              <div className={styles.num}>{f.num}</div>
              <div>
                <div className={styles.q}>{f.q}</div>
                <p className={styles.a}>{f.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
