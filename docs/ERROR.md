# トラブルシューティング

このドキュメントでは、ガンプラ在庫監視Botの開発・運用中に発生する可能性のあるエラーとその解決方法をまとめています。

---

## ngrok関連のエラー

### ERR_NGROK_15013: dev domainが存在しない

**エラーメッセージ:**
```
ERROR:  failed to start tunnel: Your account is requesting a dev domain that does not exist.
ERROR:  Visit https://dashboard.ngrok.com/domains to request a dev domain.
ERROR:  ERR_NGROK_15013
```

**原因:**
ngrok v3では、無料アカウントでも静的ドメイン（dev domain）の作成と明示的な指定が必要になりました。
以前のバージョンのように `ngrok http 3000` だけでは起動できません。

**解決方法:**

1. **ngrokダッシュボードでドメインを作成**
   - ブラウザで https://dashboard.ngrok.com/domains を開く
   - 「New Domain」または「Create Domain」ボタンをクリック
   - 無料の静的ドメインを1つ作成（例: `your-name-1234.ngrok-free.dev`）

2. **作成したドメインを指定して起動**
   ```bash
   ngrok http 3000 --domain=<作成したドメイン名>
   ```

   例:
   ```bash
   ngrok http 3000 --domain=yareli-longtime-kittie.ngrok-free.dev
   ```

3. **成功時の表示**
   ```
   Forwarding    https://yareli-longtime-kittie.ngrok-free.dev -> http://localhost:3000
   ```

4. **LINE DevelopersでWebhook URLを設定**
   ```
   https://<あなたのドメイン>/webhook
   ```

**注意点:**
- ドメイン名は毎回同じものを使えるため、一度作成すれば再利用可能です
- コマンドは**1行で**入力してください（改行が入るとエラーになります）

---

### ERR_NGROK_4018: 認証エラー

**エラーメッセージ:**
```
ERROR:  authentication failed: Usage of ngrok requires a verified account and authtoken.
ERROR:  ERR_NGROK_4018
```

**原因:**
ngrokのauthtokenが設定されていないか、無効なトークンが設定されています。

**解決方法:**

1. **ngrokダッシュボードからauthtokenを取得**
   - https://dashboard.ngrok.com/get-started/your-authtoken にアクセス
   - 画面に表示される**あなた専用のauthtoken**をコピー

2. **authtokenを設定**
   ```bash
   ngrok config add-authtoken <コピーしたトークン>
   ```

3. **再度起動**
   ```bash
   ngrok http 3000 --domain=<あなたのドメイン>
   ```

**注意点:**
- ドキュメントやガイドに書かれている例のトークンは使えません
- 必ず自分のアカウントのトークンを使用してください

---

## LINE Messaging API関連のエラー

### Webhook通知が届かない

**原因:**
- LINE Channel Access Tokenの期限切れ
- Webhook URLの設定ミス
- Supabase Edge Functionのエラー

**解決方法:**

1. **トークンを確認**
   - LINE Developersコンソールでチャネルアクセストークンを確認
   - 必要に応じて再発行し、GitHub Secretsを更新

2. **Webhook URLを確認**
   - LINE Developersコンソールで正しいURLが設定されているか確認
   - 「Webhookの利用」がオンになっているか確認

3. **Supabase Edge Functionのログを確認**
   - Supabaseダッシュボードの「Edge Functions」→「Logs」でエラーを確認

---

## Prisma関連のエラー

### Prisma Clientの生成エラー

**エラーメッセージ:**
```
Error: @prisma/client did not initialize yet.
```

**原因:**
Prisma Clientが生成されていない、またはスキーマとの不一致

**解決方法:**

```bash
# Prisma Clientを再生成
npx prisma generate

# DBスキーマを同期
npx prisma db push
```

---

## GitHub Actions関連のエラー

### 在庫チェックが失敗する

**原因:**
- プレミアムバンダイのサイト構造変更
- ネットワークタイムアウト
- セレクタの変更

**解決方法:**

1. **GitHub Actionsのログを確認**
   - リポジトリの「Actions」タブでエラー詳細を確認

2. **`src/checker.ts`の在庫判定ロジックを修正**
   - `extractStockStatus()`メソッドのセレクタを確認
   - プレミアムバンダイのページ構造に合わせて更新

3. **タイムアウト設定を延長**
   - 必要に応じて待機時間を調整

---

## その他のエラー

### ポート3000が既に使用されている

**エラーメッセージ:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**原因:**
別のプロセスがポート3000を使用中

**解決方法:**

```bash
# ポート3000を使用しているプロセスを確認
lsof -i :3000

# プロセスを終了（PIDは上記コマンドで確認）
kill -9 <PID>
```

---

## サポート

上記で解決しない場合は、GitHub Issuesで報告してください。
