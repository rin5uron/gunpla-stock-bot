# ガンプラ在庫監視Bot - プロジェクトドキュメント

このドキュメントは、Claude Codeがこのプロジェクトを理解し、効率的に作業を進めるための総合ガイドです。

## 📋 プロジェクト概要

プレミアムバンダイのガンプラ在庫を自動監視し、在庫が復活したらLINEで通知するシンプルなBotです。

### 主な機能
- 30分おきの自動在庫チェック（GitHub Actions）
- ボタン判定による在庫状態の検出（カートに入れる/在庫なし/予約する）
- 在庫復活時のLINE通知（商品URLのみ送信）
- LINE経由での友だち登録・削除対応

### ユーザーフロー
1. ユーザーがLINE BotをフォローするとSupabase DBに登録
2. GitHub Actionsが30分おきに監視対象商品の在庫をチェック
3. 在庫復活を検知したら全登録ユーザーにLINE Flex Messageで通知
4. ユーザーは手動で商品ページにアクセスして購入

---

## 🏗️ アーキテクチャ

このBotは、以下の3つのコンポーネントで構成されています。

### 1. データベース（Supabase PostgreSQL）
- **役割**: 監視対象商品（`Target`）とユーザー情報（`User`）を管理
- **テーブル構成**:
  - `Target`: 商品ID、名前、URL、最終在庫状態、有効/無効フラグ
  - `User`: LINEユーザーID、表示名、登録日時
- **技術**: Prisma ORM（Node.js環境とDeno環境の両対応）

### 2. 在庫チェッカー（GitHub Actions）
- **役割**: 定期的に在庫をチェックし、復活時に通知
- **実行環境**: GitHub Actions（Ubuntu latest）
- **実行頻度**: 30分おき（cron: `*/30 * * * *`）
- **処理フロー**:
  1. Supabase DBから監視対象商品とユーザーリストを取得
  2. Playwrightでブラウザを起動し、各商品ページにアクセス
  3. ページ上のボタン要素を判定して在庫状態を特定（`in_stock`, `out_of_stock`, `pre_order`, `sold_out`, `unknown`）
  4. 在庫復活を検知したらLINE Messaging APIで全ユーザーに商品URLを通知
  5. 最新の在庫状態をDBに保存

**スクレイピング対策とアカウントBAN防止**:
- 自動カート投入機能は廃止（プレミアムバンダイのスクレイピング対策およびアカウントBAN対策のため）
- ボタンのテキスト判定のみで在庫状態を検出し、通知は商品URLのみを送信
- ユーザーは通知を受け取った後、手動で購入手続きを行う

### 3. Webhookサーバー（Supabase Edge Functions）
- **役割**: LINE Webhookを受け取り、友だち追加/削除に応答
- **実行環境**: Deno（Supabase Edge Runtime）
- **処理内容**:
  - `follow`: ユーザー登録（DBにupsert）
  - `unfollow`: ユーザー削除（DBから削除）
  - `message`: シンプルな自動返信

---

## 🛠️ 技術スタック

### バックエンド・実行環境
- **Node.js**: v20以上（在庫チェッカー本体）
- **Deno**: v1.25以上（Supabase Edge Functions）
- **TypeScript**: v5.7（型安全性）
- **Playwright**: v1.48（ブラウザ自動化）
- **Prisma**: v7.1（ORM）

### インフラ・サービス
- **Supabase**: PostgreSQL DB、Edge Functions、認証（将来）
- **GitHub Actions**: 定期実行スケジューラ
- **LINE Messaging API**: 通知配信

### 主な依存パッケージ
- `@line/bot-sdk`: LINE Messaging APIクライアント
- `@prisma/client`: Prismaクライアント
- `playwright`: ブラウザ自動化
- `dotenv`: 環境変数管理
- `express`: サーバー（現在未使用、将来の拡張用）

---

## 📁 ディレクトリ構造

```
gunpla-stock-bot/
├── .github/
│   └── workflows/
│       └── check-stock.yml       # GitHub Actions定義（30分おき実行）
├── config/
│   └── targets.json              # 監視対象商品の初期データ（現在未使用）
├── docs/
│   └── SETUP.md                  # セットアップガイド
├── prisma/
│   ├── schema.prisma             # データベーススキーマ定義
│   └── seed.ts                   # シードデータ投入スクリプト
├── src/                          # メインソースコード（Node.js）
│   ├── main.ts                   # エントリーポイント（GitHub Actionsで実行）
│   ├── checker.ts                # StockCheckerクラス（Playwright制御）
│   ├── lineMessaging.ts          # LINE通知クライアント
│   └── types.ts                  # 型定義
├── supabase/
│   ├── config.toml               # Supabase設定
│   └── functions/
│       └── line-webhook/         # Deno Edge Function
│           ├── index.ts          # Webhook処理メイン
│           └── line-verify.ts    # LINE署名検証
├── .env.example                  # 環境変数テンプレート
├── .gitignore
├── package.json
├── tsconfig.json
├── README.md
└── claude.md                     # このファイル
```

---

## 🔧 主要コンポーネント詳細

### src/main.ts
- **役割**: GitHub Actionsから実行されるメインスクリプト
- **処理フロー**:
  1. 環境変数チェック（`LINE_CHANNEL_ACCESS_TOKEN`等）
  2. Prismaクライアント初期化
  3. DBから`Target`と`User`を取得
  4. `StockChecker`を初期化しブラウザ起動
  5. 各商品を順次チェック（1秒間隔でレート制限対策）
  6. 在庫復活を検知したら通知送信
  7. 最新状態をDBに保存

### src/checker.ts - StockCheckerクラス
主要メソッド:
- `init()`: Playwrightブラウザを起動（headlessモード）
- `checkStock(target)`: 指定商品の在庫をチェック
- `extractStockStatus(page)`: ページ上のボタン要素からテキストを取得して在庫状態を判定
- `isStockRestored(prev, curr)`: 在庫復活を判定（なし→あり）
- `getPageHtml()`: 現在のページのHTMLを取得（テスト用）

**在庫判定方式**:
- ボタン要素（カートに入れる/在庫なし/予約する/販売終了）のテキストを検出
- スクレイピング対策のため、カート投入などの自動操作は一切行わない
- 判定結果に基づき在庫状態（`in_stock`/`out_of_stock`/`pre_order`/`sold_out`）を決定

### src/lineMessaging.ts - LineMessagingClientクラス
- **役割**: LINE Messaging APIを使った通知配信
- **主要メソッド**:
  - `sendFlexMessage(users, message)`: Flex Messageで在庫復活通知を送信

### supabase/functions/line-webhook/index.ts
- **役割**: LINE Webhookイベントを処理（Deno環境）
- **イベント処理**:
  - `follow`: ユーザー登録（プロフィール取得→DB upsert→挨拶返信）
  - `unfollow`: ユーザー削除（DB delete）
  - `message`: シンプルな自動返信

---

## 🔑 環境変数

### ローカル開発用（.env）
```env
DATABASE_URL=postgresql://user:password@host:5432/database
```

### GitHub Actions Secrets
- `DATABASE_URL`: Supabase PostgreSQL接続URI
- `LINE_CHANNEL_ACCESS_TOKEN`: LINE Messaging APIトークン

### Supabase Secrets（Edge Function用）
- `DATABASE_URL`: 同上
- `LINE_CHANNEL_ACCESS_TOKEN`: 同上
- `LINE_CHANNEL_SECRET`: LINE Webhook署名検証用
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase管理者キー（将来の拡張用）

---

## 📝 開発ガイドライン

### コーディング規約
- **言語**: TypeScript（厳格な型定義を推奨）
- **フォーマット**: 既存コードのスタイルに従う（2スペースインデント）
- **ログ出力**: コンソール絵文字を活用（🚀起動、📦チェック、✅成功、❌エラー等）
- **エラーハンドリング**: try-catchで適切にキャッチし、詳細ログを出力

### 在庫判定ロジックの改善方針
現在の在庫判定ロジックは実際のページ構造に対応していません。

**改善が必要な点**:
- ページのbodyテキスト全体で判定しているため、精度が低い
- より具体的なセレクタで在庫ボタンやステータステキストを取得すべき
- `data-testid`などの安定した属性を優先的に使用
- 複数のフォールバックパターンを用意

### DBマイグレーション
- スキーマ変更時は`prisma/schema.prisma`を編集
- `npx prisma db push`で開発環境に反映
- 本番環境（Supabase）にも同様に反映

### デプロイ手順

#### 1. 在庫チェッカー（GitHub Actions）
- `main`ブランチにpush/mergeすると自動で最新版が反映
- 手動実行: GitHubリポジトリの「Actions」タブ→「ガンプラ在庫チェック」→「Run workflow」

#### 2. 対話サーバー（Supabase Edge Functions）
```bash
supabase functions deploy line-webhook
```

#### 3. DBスキーマ更新
```bash
# ローカルで確認
npx prisma db push

# Supabaseの本番DBに反映（慎重に）
DATABASE_URL=<本番URL> npx prisma db push
```

---

## 🐛 よくある問題とトラブルシューティング

### 1. 在庫チェックが失敗する
**原因**: プレミアムバンダイのサイト構造変更、ネットワークタイムアウト
**対処**:
- `src/checker.ts`の`extractStockStatus()`メソッドを確認
- セレクタやテキスト判定ロジックを修正
- タイムアウト設定を延長（現在30秒）

### 2. LINE通知が届かない
**原因**: トークン期限切れ、Webhook設定ミス
**対処**:
- LINE Developersでチャネルアクセストークンを再発行
- GitHub Secretsを更新
- Supabase Edge Functionのログを確認（Supabaseダッシュボード）

### 3. Supabase Edge Functionがエラーを出す
**原因**: 環境変数未設定、Prisma Clientの生成ミス
**対処**:
```bash
# Secretsを再設定
supabase secrets set LINE_CHANNEL_ACCESS_TOKEN=xxx
supabase secrets set LINE_CHANNEL_SECRET=xxx
supabase secrets set DATABASE_URL=xxx

# 再デプロイ
supabase functions deploy line-webhook
```

### 4. Prisma Clientがエラーを出す
**原因**: スキーマとDBの不一致、CLIENT生成忘れ
**対処**:
```bash
npx prisma generate
npx prisma db push
```

---

## 🚀 今後の実装タスク

詳細はGitHub Issuesを参照してください。

### 必須タスク（安定化）
- [#5] 在庫判定ロジックの改善 - より堅牢なセレクタとテキストパターン

### 改善案（機能拡張）
- [#6] テストコードの追加
- [#7] Webダッシュボードの作成
- [#8] LINE対話機能の拡充（商品追加・削除など）

### 廃止した機能
- ~~カート投入機能~~ - スクレイピング対策およびアカウントBAN対策のため廃止（ボタン判定のみで在庫を検出し、商品URLを通知する方式に変更）
- ~~対話機能「在庫確認」~~ - シンプル化のため廃止

---

## 📚 参考リンク

- [Supabaseドキュメント](https://supabase.com/docs)
- [Prismaドキュメント](https://www.prisma.io/docs)
- [Playwrightドキュメント](https://playwright.dev/)
- [LINE Messaging APIドキュメント](https://developers.line.biz/ja/docs/messaging-api/)
- [GitHub Actionsドキュメント](https://docs.github.com/ja/actions)

---

## 🔒 セキュリティ注意事項

- **絶対に**.envファイルをGitにコミットしない（.gitignoreで除外済み）
- GitHub Secretsは暗号化されているが、ログ出力には十分注意
- 本Botは個人利用を想定しており、商業利用や大規模利用は非推奨
- プレミアムバンダイの利用規約を遵守すること
- 在庫監視の頻度（30分おき）は適切に保ち、サーバーに過度な負荷をかけない
- **カート投入などの自動操作は一切行わない**（スクレイピング対策、アカウントBAN防止のため、ボタン判定による在庫検出のみ実施）

---

## 📞 サポート

質問や問題が発生した場合は、GitHub Issuesで報告してください。

---
## 編集ルール
- `docs/study.md`を編集する際のルール：新しい日付の学習記録は、ファイルの先頭（目次の下）に追加してください。