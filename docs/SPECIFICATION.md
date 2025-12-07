# ガンプラ在庫監視Bot - 仕様書

このドキュメントでは、プロジェクトの詳細な仕様とファイル構成について説明します。

## 📋 目次

- [プロジェクト概要](#プロジェクト概要)
- [ディレクトリ構造](#ディレクトリ構造)
- [ファイル詳細](#ファイル詳細)
- [データフロー](#データフロー)
- [在庫判定ロジック](#在庫判定ロジック)
- [環境変数](#環境変数)

---

## プロジェクト概要

プレミアムバンダイの商品在庫を30分おきに自動監視し、在庫が復活したらLINEで通知するBotです。

### 技術スタック
- **言語**: TypeScript
- **ランタイム**: Node.js v20以上
- **ブラウザ自動化**: Playwright
- **LINE通知**: LINE Messaging API
- **実行環境**: GitHub Actions
- **データ管理**: CSVファイル

### 主な特徴
- データベース不要（CSVファイルで管理）
- Webhookサーバー不要（GitHub Actionsのみ）
- セットアップが簡単（CSV編集 + GitHub Secrets設定）
- スクレイピング対策（ボタン判定のみ、自動操作なし）

---

## ディレクトリ構造

```
gunpla-stock-bot/
├── .github/
│   └── workflows/
│       └── check-stock.yml          # GitHub Actions定義（30分おき実行）
├── config/
│   ├── targets.csv                  # 監視対象商品リスト
│   └── users.csv                    # LINE通知先ユーザーリスト
├── docs/
│   ├── SETUP.md                     # セットアップガイド
│   ├── SPECIFICATION.md             # このファイル（仕様書）
│   └── TESTING.md                   # テスト方法
├── src/
│   ├── main.ts                      # エントリーポイント
│   ├── checker.ts                   # 在庫チェッカークラス
│   ├── csvHelper.ts                 # CSV読み書きヘルパー
│   ├── lineMessaging.ts             # LINE通知クライアント
│   └── types.ts                     # TypeScript型定義
├── test-output/                     # テスト時のHTML出力（.gitignore）
├── .env.example                     # 環境変数テンプレート
├── .gitignore                       # Git除外設定
├── package.json                     # npm依存関係
├── tsconfig.json                    # TypeScript設定
├── README.md                        # プロジェクト概要
└── claude.md                        # Claude Code用ドキュメント
```

---

## ファイル詳細

### 📁 config/ - 設定ファイル

#### `config/targets.csv`
**役割**: 監視対象商品の管理

**形式**:
```csv
id,name,url,lastStatus,enabled
item-1,商品名,https://p-bandai.jp/item/item-XXXXXXXXX/,out_of_stock,true
```

**カラム説明**:
- `id`: 商品の一意識別子（任意の文字列、重複不可）
- `name`: 商品名（通知メッセージに表示される）
- `url`: プレミアムバンダイの商品ページURL
- `lastStatus`: 最終チェック時の在庫状態
  - `in_stock`: 在庫あり
  - `out_of_stock`: 在庫なし
  - `pre_order`: 予約受付中
  - `sold_out`: 完売
  - `unknown`: 不明（エラー時）
- `enabled`: 監視の有効/無効（`true` / `false`）

**注意事項**:
- このファイルは `.gitignore` に含まれているため、Gitにコミットされません
- 商品を追加する際は、このファイルを編集してGitHubにプッシュしてください
- `lastStatus` は自動的に更新されるため、初期値は `out_of_stock` で問題ありません

---

#### `config/users.csv`
**役割**: LINE通知先ユーザーの管理

**形式**:
```csv
userId,displayName
U1234567890abcdef1234567890abcdef,ユーザー名
```

**カラム説明**:
- `userId`: LINE ユーザーID（Uから始まる33文字の文字列）
- `displayName`: 表示名（管理用、通知には使用されない）

**LINE ユーザーIDの取得方法**:

LINEのユーザーIDは、Bot側から一覧で取得することはできません。ユーザーに特定の操作をしてもらう必要があります。
開発環境で簡単・安全にIDを取得するために、専用のツールを用意しています。

**詳しい手順はこちらのガイドをご覧ください:**

👉 **[ユーザーIDの取得方法](./GET_USER_ID.md)**

このガイドでは、`ngrok`というツールとプロジェクト内の`getUserId.js`スクリプトを使って、一時的にWebhookサーバーを起動し、安全にIDを取得する方法を説明しています。

**注意事項**:
- このファイルは `.gitignore` に含まれているため、Gitにコミットされません
- 複数のユーザーを登録できます（行を追加するだけ）

---

### 📁 src/ - ソースコード

#### `src/main.ts`
**役割**: プログラムのエントリーポイント

**処理フロー**:
1. 環境変数の読み込み（`dotenv`）
2. CSVファイルから監視対象商品とユーザーリストを読み込み
3. StockCheckerとLineMessagingClientを初期化
4. 各商品を順次チェック（1秒間隔でレート制限対策）
5. 在庫復活を検知したら、LINE通知を送信
6. 最新の在庫状態をCSVファイルに書き戻し
7. 実行結果のサマリーを表示

**実行コマンド**:
```bash
npm run start
```

**ログ出力例**:
```
🚀 ガンプラ在庫監視Bot 起動
⏰ 実行時刻: 2025-12-07 18:00:00
📋 監視対象: 3件
👥 通知先: 2人
🌐 ブラウザを起動しました
📦 チェック開始: 商品1
✅ チェック完了: 商品1 | out_of_stock → in_stock | 2500ms
🎉 在庫復活検知: 商品1
✅ 通知送信完了: 商品1
💾 ターゲット情報を更新しました

📊 実行結果サマリー
  チェック済み: 3件
  変化あり: 1件
  在庫復活: 1件
✅ 処理完了
```

---

#### `src/checker.ts`
**役割**: Playwrightを使った在庫チェック

**主要クラス**: `StockChecker`

**主要メソッド**:

##### `init(): Promise<void>`
- Playwrightブラウザを起動します
- headlessモードで動作（GitHub Actions環境用）
- 1回だけ呼び出します

##### `close(): Promise<void>`
- ブラウザを終了します
- 必ず最後に呼び出します

##### `checkStock(target: Target): Promise<CheckResult>`
- 指定された商品の在庫をチェックします
- **引数**: `target` - 監視対象商品
- **戻り値**: チェック結果（在庫状態、変化の有無など）

**処理フロー**:
1. 商品ページにアクセス（`page.goto`）
2. ページから在庫状態を判定（`extractStockStatus`）
3. 前回の状態と比較して在庫復活を判定（`isStockRestored`）
4. 結果を返す

##### `extractStockStatus(page: Page): Promise<StockStatus>`
- ページのbodyテキストから在庫状態を判定します
- **現在の実装**:
  - `カートに入れる` または `購入手続き` → `in_stock`
  - `予約する` または `予約受付中` → `pre_order`
  - `在庫がありません` または `在庫なし` → `out_of_stock`
  - `完売` または `受付終了` → `sold_out`
  - 上記に該当しない → `unknown`

**⚠️ 改善が必要な点**:
- bodyテキスト全体で判定しているため、精度が低い
- より具体的なセレクタ（ボタン要素など）を使うべき
- 詳細は [TESTING.md](./TESTING.md) を参照

##### `isStockRestored(prev: StockStatus, curr: StockStatus): boolean`
- 在庫が復活したかを判定します
- **ロジック**: `out_of_stock/sold_out/unknown` → `in_stock/pre_order`

##### `getPageHtml(): Promise<string>`
- 現在のページのHTMLを取得します（テスト用）

---

#### `src/csvHelper.ts`
**役割**: CSV読み書きヘルパー関数

**主要関数**:

##### `loadTargets(): TargetRow[]`
- `config/targets.csv` から監視対象商品を読み込みます
- `enabled=true` のみを返します

##### `updateTargetStatus(targetId: string, newStatus: StockStatus): void`
- 指定された商品の `lastStatus` を更新します
- CSVファイルに書き戻します

##### `loadUsers(): UserRow[]`
- `config/users.csv` から通知先ユーザーを読み込みます

**使用ライブラリ**:
- `csv-parse/sync`: CSV解析
- `csv-stringify/sync`: CSV生成

---

#### `src/lineMessaging.ts`
**役割**: LINE Messaging APIクライアント

**主要クラス**: `LineMessagingClient`

**主要メソッド**:

##### `sendFlexMessage(users: User[], message: NotificationMessage): Promise<void>`
- Flex Messageを使って在庫復活通知を送信します
- **引数**:
  - `users`: 通知先ユーザーリスト
  - `message`: 通知メッセージ（タイトル、本文、URL、タイムスタンプ）

**Flex Messageの内容**:
- ヘッダー: 商品名
- 本文: 在庫状態の変化（例: `在庫なし → 在庫あり`）
- フッター: 商品URLへのリンク
- タイムスタンプ

**LINE Messaging API仕様**:
- エンドポイント: `https://api.line.me/v2/bot/message/multicast`
- 一度に最大500ユーザーまで送信可能

---

#### `src/types.ts`
**役割**: TypeScript型定義

**主要型**:

##### `StockStatus`
```typescript
type StockStatus =
  | 'in_stock'      // 在庫あり
  | 'out_of_stock'  // 在庫なし
  | 'pre_order'     // 予約受付中
  | 'sold_out'      // 完売
  | 'unknown';      // 不明
```

##### `Target`
```typescript
interface Target {
  id: string;
  name: string;
  url: string;
  lastStatus: StockStatus;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

##### `CheckResult`
```typescript
interface CheckResult {
  targetId: string;
  name: string;
  url: string;
  previousStatus: StockStatus;
  currentStatus: StockStatus;
  hasChanged: boolean;
  isStockRestored: boolean;
  checkedAt: string;
}
```

##### `NotificationMessage`
```typescript
interface NotificationMessage {
  title: string;
  body: string;
  url: string;
  timestamp: string;
}
```

---

### 📁 .github/workflows/

#### `.github/workflows/check-stock.yml`
**役割**: GitHub Actions定義

**トリガー**:
- **スケジュール**: 30分おき（`cron: '*/30 * * * *'`）
- **手動実行**: `workflow_dispatch`

**実行ステップ**:
1. リポジトリをチェックアウト
2. Node.js v20をセットアップ
3. npm依存関係をインストール
4. Playwright Chromiumブラウザをインストール
5. 在庫チェックを実行（`npm run start`）

**環境変数**:
- `LINE_CHANNEL_ACCESS_TOKEN`: GitHub Secretsから取得
- `TZ`: Asia/Tokyo（日本時間）

**注意事項**:
- GitHub Actions無料枠: 月2000分まで
- 1回の実行は約3-5分（商品数による）
- 30分おき実行の場合、月約1440分使用（無料枠内）

---

## データフロー

```
[GitHub Actions 30分おき起動]
        ↓
[src/main.ts 実行開始]
        ↓
[config/targets.csv 読み込み] ← CSVファイル
[config/users.csv 読み込み]   ← CSVファイル
        ↓
[StockChecker初期化]
[Playwrightブラウザ起動]
        ↓
[各商品を順次チェック]
  ├─ ページにアクセス
  ├─ 在庫状態を判定
  ├─ 前回の状態と比較
  └─ 在庫復活を検知？
        ├─ YES → LINE通知送信
        └─ NO  → 次の商品へ
        ↓
[lastStatusをCSVに書き戻し] → config/targets.csv更新
        ↓
[ブラウザ終了]
[実行完了]
```

---

## 在庫判定ロジック

### 現在の実装

`src/checker.ts` の `extractStockStatus()` メソッド:

```typescript
const bodyText = await page.textContent('body');
const normalized = bodyText.replace(/\s+/g, '').toLowerCase();

if (normalized.includes('カートに入れる') || normalized.includes('購入手続き'))
  return 'in_stock';
if (normalized.includes('予約する') || normalized.includes('予約受付中'))
  return 'pre_order';
if (normalized.includes('在庫がありません') || normalized.includes('在庫なし'))
  return 'out_of_stock';
if (normalized.includes('完売') || normalized.includes('受付終了'))
  return 'sold_out';

return 'unknown';
```

### 問題点

1. **精度が低い**: ページ全体のテキストで判定しているため、誤判定の可能性
2. **脆弱性**: プレミアムバンダイのサイト構造変更に弱い
3. **テキストベース**: より堅牢なセレクタ（ボタン要素など）を使うべき

### 改善案

詳細は [TESTING.md](./TESTING.md) の「在庫判定ロジックの改善」セクションを参照してください。

---

## 環境変数

### `.env` (ローカル開発用)

```env
LINE_CHANNEL_ACCESS_TOKEN=あなたのLINEチャネルアクセストークン
```

### GitHub Actions Secrets

以下のSecretを設定してください:

| Secret名 | 説明 | 取得方法 |
|---------|------|---------|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging APIトークン | [LINE Developers](https://developers.line.biz/) で取得 |

---

## セキュリティとプライバシー

### .gitignore設定

以下のファイルはGitにコミットされません:

```
config/users.csv        # ユーザーのLINE ID
config/targets.csv      # 監視対象商品
.env                    # 環境変数
.env.local
test-output/            # テスト時のHTML出力
```

### GitHub Secrets

- GitHub Secretsは暗号化されて保存されます
- ログには `***` としてマスクされます
- Secretsは直接コードには書かないでください

---

## トラブルシューティング

詳細は [TESTING.md](./TESTING.md) を参照してください。

---

## 参考リンク

- [Playwrightドキュメント](https://playwright.dev/)
- [LINE Messaging APIドキュメント](https://developers.line.biz/ja/docs/messaging-api/)
- [GitHub Actionsドキュメント](https://docs.github.com/ja/actions)
- [csv-parseドキュメント](https://csv.js.org/parse/)
