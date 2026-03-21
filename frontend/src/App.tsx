import { Typography } from './components/ui/Typography/Typography'
import { Button } from './components/ui/Button/Button'
import { Divider } from './components/ui/Divider/Divider'
import { SectionTitle } from './components/ui/SectionTitle/SectionTitle'

function App() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
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
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Button variant="primary">プライマリ</Button>
        <Button variant="secondary">セカンダリ</Button>
        <Button variant="ghost">ゴースト</Button>
      </div>
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          marginTop: '1rem',
        }}
      >
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
      <div style={{ marginTop: '1rem' }}>
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
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {(['anime', 'movie', 'drama', 'book', 'manga', 'game'] as const).map((genre) => (
          <span
            key={genre}
            style={{
              backgroundColor: `var(--color-${genre})`,
              color: 'var(--color-bg-white)',
              padding: '0.25rem 0.75rem',
              fontSize: '0.875rem',
            }}
          >
            {genre}
          </span>
        ))}
      </div>
    </div>
  )
}

export default App
