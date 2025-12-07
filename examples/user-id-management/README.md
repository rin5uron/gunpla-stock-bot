# ユーザーID管理機能（ユーザーごとに通知を変えたい場合用）

このディレクトリには、**ユーザーごとに監視商品や通知を変えたい場合**に使用するユーザーID管理機能の実装が保存されています。

## 概要

現在のメインブランチ（`main`）では、**全友だちに同じ在庫復活通知を送る**シンプルな実装（Broadcast API使用）になっています。

しかし、将来的に以下のような機能が必要になった場合、このディレクトリの実装を参考にできます：

- ユーザーごとに監視する商品を変える
- 特定のユーザーにだけ通知を送る
- ユーザーごとに通知のON/OFF設定を持つ

## このディレクトリの内容

```
examples/user-id-management/
├── README.md                 # このファイル
├── getUserId.js              # Webhookサーバー（ユーザーIDを手動取得）
├── csvHelper.ts              # CSV読み書きヘルパー
└── docs/
    ├── GET_USER_ID.md        # ユーザーID取得の詳細手順書
    └── ERROR.md              # トラブルシューティングガイド
```

## 実装の詳細

詳細な実装とコミット履歴は、以下のブランチを参照してください：

### ブランチ: `feature/user-specific-notifications`

```bash
# ブランチを確認
git checkout feature/user-specific-notifications

# ブランチの差分を確認
git diff main...feature/user-specific-notifications
```

### 主な実装内容

1. **ユーザーID手動取得の仕組み**
   - `getUserId.js`: Express.jsでWebhookサーバーを実装
   - ngrokでローカルサーバーを一時的に公開
   - LINEからのメッセージイベントでユーザーIDを取得

2. **CSV形式でユーザー管理**
   - `config/users.csv`: ユーザーID、表示名を保存
   - `src/csvHelper.ts`: CSV読み書き機能

3. **個別通知の実装**
   - `src/lineMessaging.ts`: Push Message APIで個別送信

### コミット履歴

```bash
# ブランチのコミット履歴を確認
git log feature/user-specific-notifications --oneline
```

主なコミット:
- `3f0a125` - ユーザーID手動取得機能を実装（2025/12/7）

## 使い方

### 1. ブランチを切り替える

```bash
git checkout feature/user-specific-notifications
```

### 2. ユーザーIDを取得する

詳細な手順は `docs/GET_USER_ID.md` を参照：

```bash
# 1. Webhookサーバーを起動
node getUserId.js

# 2. 別ターミナルでngrokを起動
ngrok http 3000 --domain=<あなたのドメイン>

# 3. LINE DevelopersでWebhook URLを設定
# 4. 友だちにメッセージを送ってもらう
# 5. ターミナルにユーザーIDが表示される
```

### 3. メインブランチに戻る

```bash
git checkout main
```

## 参考資料

- [LINE Developersドキュメント - ユーザーIDの取得](https://developers.line.biz/ja/docs/messaging-api/getting-user-ids/)
- [ngrok公式ドキュメント](https://ngrok.com/docs)
- [GitHub Issue #11](https://github.com/rin5uron/gunpla-stock-bot/issues/11) - 実装過程とエラー対応の記録

## 注意事項

- この実装は「手動でユーザーIDを取得する」運用を前提としています
- 自動的な友だち登録/削除を実装する場合は、Supabase Edge FunctionsやVercelなどのサーバーレス環境が必要です
- LINE Messaging APIの無料プランは月5000通まで送信可能です

---

**最終更新**: 2025/12/7
