import { Typography } from '../../components/ui/Typography/Typography'
import { Divider } from '../../components/ui/Divider/Divider'
import styles from './PrivacyPage.module.css'

/**
 * プライバシーポリシーページ (/privacy)
 *
 * Cookie 同意バナーを実装しない方針のため、計測内容・PII の取り扱い・
 * オプトアウト方法をこのページに明記する。日本 APPI 対応の一環。
 *
 * Spec: docs/superpowers/specs/2026-04-13-analytics-tracking-design.md 4 節
 * ADR: docs/adr/0041-プロダクト分析ツールにposthogを採用.md
 */
export function PrivacyPage() {
  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <Typography variant="h1">プライバシーポリシー</Typography>
        <Divider />

        <section className={styles.section}>
          <Typography variant="h2">1. 取得する情報</Typography>
          <Typography variant="body">
            Recolly（以下「本サービス」）では、サービス改善と利用状況の把握のため、
            以下の情報を自動的に取得します。
          </Typography>
          <ul className={styles.list}>
            <li>ページの閲覧履歴（どの画面を開いたか）</li>
            <li>操作イベント（新規登録、記録作成など）</li>
            <li>ログイン状態（ログイン中のユーザー内部 ID）</li>
            <li>アクセスしたブラウザ・デバイス情報</li>
          </ul>
        </section>

        <section className={styles.section}>
          <Typography variant="h2">2. 利用する解析ツール</Typography>
          <Typography variant="body">
            本サービスは解析ツールとして <strong>PostHog</strong> を利用しています。 PostHog
            は世界中で利用されているプロダクト分析ツールで、
            本サービスの改善のためにイベントデータを収集します。
          </Typography>
        </section>

        <section className={styles.section}>
          <Typography variant="h2">3. 送信しない情報（匿名性の担保）</Typography>
          <Typography variant="body">以下の情報は PostHog に送信しません:</Typography>
          <ul className={styles.list}>
            <li>メールアドレス</li>
            <li>パスワード</li>
            <li>作品の感想本文</li>
            <li>掲示板のコメント本文</li>
            <li>プロフィールの自己紹介文</li>
          </ul>
        </section>

        <section className={styles.section}>
          <Typography variant="h2">4. オプトアウト（計測拒否）の方法</Typography>
          <Typography variant="body">
            計測を拒否したい場合は、ブラウザのプライバシー設定で Cookie / localStorage を
            拒否することで PostHog のトラッキングを無効化できます。
            本サービスは計測を無効化していても基本機能をご利用いただけます。
          </Typography>
        </section>

        <section className={styles.section}>
          <Typography variant="h2">5. 利用目的</Typography>
          <ul className={styles.list}>
            <li>サービスの利用状況を把握し、機能改善に活用するため</li>
            <li>ユーザーの継続率・離脱ポイントを分析し、体験を改善するため</li>
            <li>不具合の発見と修正のため</li>
          </ul>
        </section>

        <section className={styles.section}>
          <Typography variant="h2">6. お問い合わせ</Typography>
          <Typography variant="body">
            本ポリシーに関するお問い合わせは、本サービスの GitHub リポジトリ経由で
            受け付けています。
          </Typography>
        </section>
      </div>
    </div>
  )
}
