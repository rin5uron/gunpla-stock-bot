、# セットアップガイド

このガイドでは、ガンプラ在庫監視Botをゼロからセットアップする手順を説明します。

## 必要なもの

- GitHubアカウント
- LINEアカウント
- LINE Messaging APIのチャネル

---

## Step 1: LINE公式アカウントの作成

1.  [LINE Developers](https://developers.line.biz/ja/) にアクセスし、LINEアカウントでログインします。
2.  **プロバイダーを作成**します（例: `MyBots`）。
3.  作成したプロバイダー内で、**Messaging APIチャネルを作成**します。
4.  作成したチャネルの「**Messaging API設定**」タブで、以下の情報を取得してメモしておきます。
    - **チャネルアクセストークン（長期）**

---

## Step 2: プロジェクトのフォークと設定

1.  このGitHubリポジトリを自分のアカウントに**Fork**します。
2.  Forkしたリポジトリをローカル環境にクローンします。
    ```bash
    git clone https://github.com/YOUR_USERNAME/gunpla-stock-bot.git
    cd gunpla-stock-bot
    ```

3.  監視対象商品を設定します。
    - `config/targets.csv` を編集し、監視したい商品を追加します。
    ```csv
    id,name,url,lastStatus,enabled
    item-1,ガンダムバルバトス,https://p-bandai.jp/item/item-1000242190/,out_of_stock,true
    item-2,別の商品,https://p-bandai.jp/item/item-XXXXXXXX/,out_of_stock,true
    ```

4.  LINE通知先ユーザーを設定します。
    - `config/users.csv` を編集し、通知先のLINE ユーザーIDを追加します。
    - LINE ユーザーIDの取得方法は  を参照してください。
    ```csv
    userId,displayName
    U1234567890abcdef1234567890abcdef,あなたの名前
    ```

5.  変更をコミットしてGitHubにプッシュします。
    ```bash
    git add config/
    git commit -m "Add monitoring targets and notification users"
    git push origin main
    ```

---

## Step 3: GitHub Actionsの設定

1.  Forkした自分のGitHubリポジトリの「**Settings**」>「**Secrets and variables**」>「**Actions**」を開きます。
2.  「**New repository secret**」をクリックし、以下のシークレットを登録します。
    - `LINE_CHANNEL_ACCESS_TOKEN`: Step 1で取得した**チャネルアクセストークン**

3.  「**Actions**」タブを開き、ワークフローを有効化します。

これで全てのセットアップは完了です！

---

## 動作確認

1. GitHubリポジトリの「**Actions**」タブを開きます。
2. 「**ガンプラ在庫チェック**」ワークフローを選択します。
3. 「**Run workflow**」をクリックして手動実行します。
4. 実行が完了したら、ログを確認して正常に動作していることを確認します。

在庫が復活すると、`config/users.csv` に登録したLINEアカウントに通知が届きます。

---

## 商品やユーザーの追加・削除

### 監視対象商品の追加

1. `config/targets.csv` を編集し、新しい行を追加します。
2. 変更をコミットしてGitHubにプッシュします。

### 通知先ユーザーの追加

1. `config/users.csv` を編集し、新しい行を追加します。
2. 変更をコミットしてGitHubにプッシュします。

---

## トラブルシューティング

### 通知が届かない
- GitHub Secretsの `LINE_CHANNEL_ACCESS_TOKEN` が正しいか確認してください。
- LINE Developersでチャネルアクセストークンを再発行し、GitHub Secretsを更新してください。

### 在庫チェックが失敗する
- GitHub Actionsのログを確認し、エラーメッセージを確認してください。
- プレミアムバンダイのBot検出システムによってブロックされている可能性があります。実行頻度を減らすことを検討してください。

### CSVファイルの形式エラー
- CSVファイルのヘッダー行が正しいか確認してください。
- カンマ区切りになっているか、不要なスペースがないか確認してください。
