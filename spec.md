# 仕様書 — gunpla-stock-bot (v0.2)

---

## 概要

**目的**  
プレミアムバンダイ上の指定ガンプラ在庫を監視し、在庫復活（再販・在庫あり・予約受付中）を検知したら **即通知**、オプションで **カート投入まで** 行う個人用Bot。

**対象**  
個人利用・学習/検証目的。過剰アクセスを避け、サイト規約・法令を遵守。

**主要技術**  
Node.js（TypeScript推奨） / Playwright（headless） / 通知（LINE Notify / Discord / ntfy.sh） / JSON or SQLite

---

## スコープ

- [必須] 指定商品の在庫ステータス取得（在庫あり / なし / 予約受付中）  
- [必須] 在庫「なし → あり/予約」遷移の **差分検知** と **即時通知**  
- [任意] **ログインセッション保持**（storageState）→ 在庫あり時に **自動カート投入**  
- [任意] 監視対象の追加・削除（ローカルJSON/SQLite）  
- [任意] 監視スケジュール（cron）  
- [任意] 直近イベントのサマリ通知（1日1回）  

**非スコープ**：自動購入確定（決済）／不特定多数への提供（SaaS化）

---

## 非機能要件

**信頼性**  
- 監視間隔は通常 30 分。ピーク帯（例：11:00 / 12:00 / 17:30–19:00）は 5 分粒度も可。

**可観測性**  
- INFO / ERROR ログ、差分のみ通知、障害時リトライ（指数バックオフ）。

**保守性**  
- 設定は `.env` と `config/*.json` に集約。DOM セレクタは外出しで差し替え容易。

**性能/負荷**  
- 1 実行あたり対象 N 件（既定 10 件）を直列または軽い並列で処理。待機は最小限（`waitForSelector` など）。

**セキュリティ**  
- トークン/Cookie をリポジトリに含めない（`.gitignore`）。

---

## アーキテクチャ（概要）

CLI/cron → **App Core**  
　├─ TargetRegistry（商品URL/識別子/状態）  
　├─ Checker（Playwright：DOM 取得・在庫判定）  
　├─ DiffEngine（前回→今回の遷移判定）  
　├─ CartOperator（任意：カート投入）  
　├─ Notifier（LINE / Discord / ntfy）  
　└─ Store（JSON / SQLite）＋ Logger  

---

## 依存関係（例）

- **runtime**：Node.js 20+  
- **libs**：`playwright` / `dotenv` / `node-cron` / `axios` / `pino` / `sqlite3` or `better-sqlite3`  
- **types**：`typescript` / `ts-node` / `@types/node`

---

## 環境変数（.env 例）

```
NODE_ENV=production
TIMEZONE=Asia/Tokyo

# スケジュール
CHECK_INTERVAL_CRON=*/30 * * * *
PEAK_INTERVAL_CRON=*/5 11-12,17-19 * * *

# 通知（いずれか）
LINE_NOTIFY_TOKEN=xxxxx
DISCORD_WEBHOOK_URL=xxxxx
NTFY_TOPIC=xxxxx

# Playwright
PLAYWRIGHT_STORAGE=./secrets/pb_storage_state.json
MAX_CONCURRENT=3
```

---

## データ構造

**商品レジストリ（`config/targets.json`）**

```json
[
  {
    "id": "mg-nu-verka",
    "name": "MG νガンダム Ver.Ka",
    "url": "https://p-bandai.jp/item/item-XXXX/",
    "expect": ["在庫あり", "予約受付中"],
    "lastStatus": "在庫なし",
    "enabled": true
  }
]
```

**実行ログ（例：`logs/2025-10-22.log`）**  
- `timestamp, id, prevStatus, currStatus, tookMs, result, note`

**SQLite（任意）**  
- `targets(id PK, name, url, last_status, updated_at)`  
- `events(id PK, target_id, prev_status, curr_status, created_at)`

---

## DOM / 判定方針

- 在庫表示要素（ボタン文言・バッジ・ARIA）を **複数キー** で判定。  
  - 例：`購入手続きへ` / `カートに入れる` / `予約受付中` / `在庫なし` / `完売` / `受付終了`  
- 文字揺らぎ（改行・全角半角）を正規化。  
- **フェイルセーフ**：DOM 未取得は「不明」。通知は抑止（WARN ログのみ）。

---

## 処理フロー

1. 起動 → `.env` / 設定読込  
2. （初回）ユーザーが手動ログイン → `storageState` に保存  
3. 対象一覧を順次チェック  
　- 遷移 → 最小限の待機（`networkidle` / 必須セレクタ）  
　- 現在ステータス抽出・正規化  
　- `lastStatus` と比較  
4. 遷移が **なし → あり/予約** の場合：  
　- （任意）カート投入（数量 1、成功判定まで）  
　- 通知送信（商品名/状態/カート結果/URL/時刻）  
5. `lastStatus` 更新・イベント記録  
6. 終了

---

## カート投入（任意）

**事前**：手動ログインして `storageState` に Cookie 保存（2 要素は都度対応）。  
**手順**：商品ページ → 規約チェック等 → 「カートに入れる」 → カート画面で成功確認。  
**失敗時**：スクリーンショットを `screenshots/` に保存＋ WARN 通知。  
**注意**：**決済は行わない**（誤購入防止）。

---

## 通知仕様

**メッセージ例（LINE）**  
- タイトル：`🛒 在庫復活：MG νガンダム Ver.Ka`  
- 本文：`状態: 在庫あり / カート: 成功 / 2025-10-22 16:45 JST`  
- URL：商品URL / （任意）カートURL

**バースト抑制**  
- 同一商品・同一状態の再通知は **一定時間（例：3 時間）** 抑制。

**障害通知**  
- 連続エラー 3 回でアラート（「セレクタ要確認」など）。

---

## 運用

**スケジュール**  
- 通常：`*/30 * * * *`  
- ピーク帯（推定）：`*/5 11-12,17-19 * * *`

**更新追従**  
- DOM 変更に備えてセレクタは `selectors.json` に外出し＋フォールバック。

**バックアップ**  
- `storageState` / `config/targets.json` は `secrets/` 配下（Git 管理外）。

---

## セキュリティ / コンプライアンス

- 人間相当のレートに抑制し、過剰並列禁止。  
- 個人用・検証目的に限定（公開配布しない）。  
- 認証情報（トークン/Cookie）は暗号化ストレージや OS キーチェーン利用を検討。

---

## リスクと対応

- **DOM 変更**：スクショ＋エラーログ → セレクタ更新。  
- **セッション切れ**：ログイン再実施ガイドを通知。  
- **誤検知**：キーを多重化、2 回連続一致で確定（デバウンス）。  
- **429 等**：指数バックオフ＋間隔延長、UA 固定。

---

## 未来拡張

- 監視ダッシュボード（Next.js）  
- 予約開始予測（過去時刻の学習／ヒートマップ）  
- Telegram/Slack/Web Push 通知  
- Docker 化、GitHub Actions で定時実行

---

## 開発コマンド（参考）

```bash
# 初期化
npm init -y
npm i -D typescript ts-node @types/node
npm i playwright dotenv node-cron pino axios better-sqlite3

# Playwright ログイン（codegen）
npx playwright codegen https://p-bandai.jp/

# TypeScript 設定
npx tsc --init

# 実行（ts-node）
npx ts-node src/main.ts
```

---

## 疑似コード（要点）

```ts
for (const t of targets) {
  const page = await ctx.newPage();
  await page.goto(t.url, { waitUntil: 'domcontentloaded' });

  const status = await readStatus(page);       // DOM から正規化文字列
  const changed = isRise(t.lastStatus, status); // なし→あり/予約 を検知

  if (changed) {
    let cart = 'skipped';
    if (config.autoCart) {
      cart = await tryAddToCart(page);         // 成功/失敗/skip
    }
    await notify({ title: t.name, status, cart, url: t.url, at: nowJST() });
  }

  await store.updateStatus(t.id, status);
  await page.close();
}
```
