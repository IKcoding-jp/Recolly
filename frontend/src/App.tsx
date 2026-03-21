import { Typography } from './components/ui/Typography/Typography'
import { Button } from './components/ui/Button/Button'
import { Divider } from './components/ui/Divider/Divider'
import { SectionTitle } from './components/ui/SectionTitle/SectionTitle'
import styles from './App.module.css'

function App() {
  return (
    <div className={styles.showcase}>
      <Typography variant="h1">Recolly デザインシステム</Typography>
      <Typography variant="body">コンポーネントショーケース — 全UIパーツの一覧</Typography>

      <Divider />

      <SectionTitle>Typography</SectionTitle>
      <Typography variant="h1">見出し1 / Heading 1</Typography>
      <Typography variant="h2">見出し2 / Heading 2</Typography>
      <Typography variant="h3">見出し3 / Heading 3</Typography>
      <Typography variant="h4">見出し4 / Heading 4</Typography>
      <Typography variant="body">本文テキスト。Zen Kaku Gothic Newで表示されます。</Typography>
      <Typography variant="label">ラベルテキスト</Typography>
      <Typography variant="meta">メタ情報テキスト（小さめ・薄め）</Typography>

      <Divider />

      <SectionTitle>Button</SectionTitle>
      <div className={styles.row}>
        <Button variant="primary">プライマリ</Button>
        <Button variant="secondary">セカンダリ</Button>
        <Button variant="ghost">ゴースト</Button>
      </div>
      <div className={styles.rowWithMargin}>
        <Button variant="primary" size="sm">
          Small
        </Button>
        <Button variant="primary" size="md">
          Medium
        </Button>
        <Button variant="primary" size="lg">
          Large
        </Button>
      </div>
      <div className={styles.rowWithMargin}>
        <Button variant="primary" disabled>
          無効化
        </Button>
      </div>

      <Divider />

      <SectionTitle>Divider</SectionTitle>
      <Typography variant="body">上のセクション</Typography>
      <Divider />
      <Typography variant="body">下のセクション</Typography>

      <Divider />

      <SectionTitle>ジャンル別カラー</SectionTitle>
      <div className={styles.row}>
        {(['anime', 'movie', 'drama', 'book', 'manga', 'game'] as const).map((genre) => (
          <span
            key={genre}
            className={styles.genreBadge}
            style={{ backgroundColor: `var(--color-${genre})` }}
          >
            {genre}
          </span>
        ))}
      </div>
    </div>
  )
}

export default App
