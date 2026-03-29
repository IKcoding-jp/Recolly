# アプリアイコンリニューアル 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recollyのアプリアイコン（favicon.svg + PWA用PNG 3種）を新デザインに置き換える

**Architecture:** favicon.svgを新しいSVGに置き換え、そのSVGからNode.jsスクリプト（sharp）を使ってPNG 3サイズを生成する。SVGは `<text>` 要素でGeorgia Boldの「R」を描画し、3色のカラーラインを `<rect>` で配置する。

**Tech Stack:** SVG, Node.js, sharp（PNG生成用・一時的devDependency）

**Issue:** #71

---

## ファイルマップ

| ファイル | 操作 | 役割 |
|---------|------|------|
| `frontend/public/favicon.svg` | 置き換え | ブラウザfavicon（新デザイン） |
| `frontend/public/icons/icon-192x192.png` | 置き換え | PWAアイコン（小） |
| `frontend/public/icons/icon-512x512.png` | 置き換え | PWAアイコン（大） |
| `frontend/public/icons/apple-touch-icon-180x180.png` | 置き換え | Apple Touch Icon |
| `scripts/generate-icons.mjs` | 新規→削除 | SVG→PNG変換スクリプト（一時的） |

---

### Task 1: favicon.svgを新デザインに置き換え

**Files:**
- 置き換え: `frontend/public/favicon.svg`

- [ ] **Step 1: 既存のfavicon.svgをバックアップ確認**

Run: `git show HEAD:frontend/public/favicon.svg > /dev/null && echo "OK: git tracks the file"`
Expected: `OK: git tracks the file`（gitで復元できるのでバックアップ不要）

- [ ] **Step 2: 新しいfavicon.svgを作成**

`frontend/public/favicon.svg` を以下の内容で置き換える:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="140" height="140">
  <!-- 白背景の角丸四角 -->
  <rect x="0" y="0" width="140" height="140" rx="28" fill="#ffffff"/>
  <!-- 中央配置の「R」 -->
  <g transform="translate(70, 72)">
    <text x="0" y="0" text-anchor="middle" dominant-baseline="central"
          font-family="Georgia, 'Times New Roman', serif"
          font-size="84" font-weight="700" fill="#2c2c2c">R</text>
  </g>
  <!-- 脚の3色カラーライン（落ち着きトーン） -->
  <rect x="76" y="85" width="22" height="3.5" rx="1.75" fill="#5e548e" transform="rotate(-50, 76, 85)"/>
  <rect x="79" y="90" width="18" height="3.5" rx="1.75" fill="#6b9080" transform="rotate(-50, 79, 90)"/>
  <rect x="82" y="95" width="14" height="3.5" rx="1.75" fill="#c4956a" transform="rotate(-50, 82, 95)"/>
</svg>
```

- [ ] **Step 3: ブラウザで表示確認**

Run: Playwright MCPで `http://localhost:5173` を開き、ブラウザタブのfaviconが新デザインに変わっていることを確認する。
（開発サーバーが起動していない場合は `cd frontend && npm run dev` で起動）

- [ ] **Step 4: コミット**

```bash
git add frontend/public/favicon.svg
git commit -m "feat: faviconを新デザイン（R + 3色ライン）に置き換え

Refs #71"
```

---

### Task 2: PNG生成スクリプトを作成して実行

**Files:**
- 新規: `scripts/generate-icons.mjs`
- 置き換え: `frontend/public/icons/icon-192x192.png`
- 置き換え: `frontend/public/icons/icon-512x512.png`
- 置き換え: `frontend/public/icons/apple-touch-icon-180x180.png`

- [ ] **Step 1: sharpをdevDependencyとしてインストール**

Run: `cd frontend && npm install --save-dev sharp`
Expected: `added X packages` のような出力。package.jsonのdevDependenciesにsharpが追加される。

- [ ] **Step 2: PNG生成スクリプトを作成**

`scripts/generate-icons.mjs` を以下の内容で作成:

```javascript
// SVGからPNGアイコンを生成する一時スクリプト
// 使い方: node scripts/generate-icons.mjs
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = resolve(__dirname, '../frontend/public/favicon.svg');
const iconsDir = resolve(__dirname, '../frontend/public/icons');

const svgBuffer = readFileSync(svgPath);

const targets = [
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-512x512.png', size: 512 },
  { name: 'apple-touch-icon-180x180.png', size: 180 },
];

for (const target of targets) {
  const outputPath = resolve(iconsDir, target.name);
  await sharp(svgBuffer)
    .resize(target.size, target.size)
    .png()
    .toFile(outputPath);
  console.log(`生成完了: ${target.name} (${target.size}x${target.size})`);
}

console.log('全アイコン生成完了');
```

- [ ] **Step 3: スクリプトを実行してPNGを生成**

Run: `node scripts/generate-icons.mjs`
Expected:
```
生成完了: icon-192x192.png (192x192)
生成完了: icon-512x512.png (512x512)
生成完了: apple-touch-icon-180x180.png (180x180)
全アイコン生成完了
```

- [ ] **Step 4: 生成されたPNGのサイズを確認**

Run: `node -e "const sharp = require('sharp'); async function check() { for (const f of ['icon-192x192.png','icon-512x512.png','apple-touch-icon-180x180.png']) { const m = await sharp('frontend/public/icons/' + f).metadata(); console.log(f + ': ' + m.width + 'x' + m.height); } } check()"`
Expected:
```
icon-192x192.png: 192x192
icon-512x512.png: 512x512
apple-touch-icon-180x180.png: 180x180
```

- [ ] **Step 5: sharpが不要なら削除、PNGをコミット**

sharpはアイコン生成以外で使わないので削除する:

```bash
cd frontend && npm uninstall sharp
```

一時スクリプトも削除:

```bash
rm scripts/generate-icons.mjs
```

生成されたPNGをコミット:

```bash
git add frontend/public/icons/icon-192x192.png frontend/public/icons/icon-512x512.png frontend/public/icons/apple-touch-icon-180x180.png
git commit -m "feat: PWA/Apple Touch用PNGアイコンを新デザインで再生成

Refs #71"
```

---

### Task 3: 表示確認とスペックコミット

**Files:**
- 新規: `docs/superpowers/specs/2026-03-29-app-icon-design.md`（既に作成済み、コミットのみ）

- [ ] **Step 1: 開発サーバーでfavicon表示確認**

Playwright MCPで `http://localhost:5173` を開き、以下を確認:
- ブラウザタブにRのアイコンが表示されている
- 旧アイコン（紫の稲妻のようなデザイン）が表示されていないこと

- [ ] **Step 2: Apple Touch Iconのlink要素を確認**

`frontend/index.html` の以下の行が正しくPNGを参照していることを確認:
```html
<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180x180.png" />
```
（既に正しいパスを参照しているので変更不要のはず）

- [ ] **Step 3: スペックをコミット**

```bash
git add docs/superpowers/specs/2026-03-29-app-icon-design.md
git commit -m "docs: アプリアイコンデザイン仕様書を追加

Refs #71"
```

---

## フォールバック: sharpでテキスト描画がうまくいかない場合

sharpのSVGレンダリングでGeorgiaフォントのテキストが正しく描画されない場合は、以下のフォールバックを使う:

1. `frontend/public/favicon.svg` をブラウザで開く（`file:///` または開発サーバー経由）
2. Playwright MCPの `browser_take_screenshot` でスクリーンショットを撮る
3. 撮影した画像をsharpでリサイズ・クロップしてPNGを生成

または、SVGの `<text>` 要素をパスデータ（`<path d="...">`）に変換すれば、フォントに依存しないSVGになる。InkscapeやFontForge等のツールで変換可能。
