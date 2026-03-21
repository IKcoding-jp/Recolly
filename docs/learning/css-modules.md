# CSS Modules — 学習ノート

## 何これ？

CSSのクラス名が他のコンポーネントと衝突しないように、自動でユニークな名前に変換してくれる仕組み。

## なぜ必要？

普通のCSSでは、全ファイルのクラス名がグローバルに共有される。
小規模なら手動で重複を避けられるが、コンポーネントが増えると管理が破綻する。

```
Button.css:  .primary { background: black; }
NavBar.css:  .primary { background: blue; }  ← 衝突！どちらかが壊れる
```

## どう解決する？

ファイル名を `.module.css` にするだけ。ビルドツール（Vite）が自動でクラス名を変換する。

```
開発者が書く:   .primary { ... }
Viteが変換:    .Button_primary_x3k2 { ... }
```

ランダム文字列が付くので絶対に衝突しない。

## 使い方

```tsx
// CSSを普通に書く（Button.module.css）
// .primary { background: black; }

// コンポーネントから import して使う
import styles from './Button.module.css'

<button className={styles.primary}>ボタン</button>
// → 実際のHTML: <button class="Button_primary_x3k2">ボタン</button>
```

## Recollyでの利用

- ADR-0006で「CSS Modules + グローバルCSS変数」の採用を決定
- 全UIコンポーネントのスタイルは `.module.css` に記述する
- Viteが標準でサポートしているため、追加ライブラリは不要
