# セットアップガイド

このガイドでは、ガンプラ在庫監視Botをゼロからセットアップする手順を説明します。

## 必要なもの

- LINEアカウント
- GitHubアカウント
- Supabaseアカウント（GitHubアカウントでサインアップ可能）
- Node.js v18以上（ローカルPC上）
- Deno v1.25以上（ローカルPC上, Supabase Functionsのテスト用）

---

## Step 1: LINE公式アカウントの作成

1.  [LINE Developers](https://developers.line.biz/ja/) にアクセスし、LINEアカウントでログインします。
2.  **プロバイダーを作成**します（例: `MyBots`）。
3.  作成したプロバイダー内で、**Messaging APIチャネルを作成**します。
4.  作成したチャネルの「**Messaging API設定**」タブで、以下の2つの情報を取得してメモしておきます。
    - **チャネルアクセストークン（長期）**
    - **チャネルシークレット**

---

## Step 2: Supabaseプロジェクトの作成

1.  [Supabase](https://supabase.com/) にGitHubアカウントでサインアップ/ログインします。
2.  「**New Project**」を作成します。
    - **Name**: `gunpla-stock-bot` など任意
    - **Database Password**: 強力なパスワードを設定し、必ずメモしておきます。
    - **Region**: `Japan (Tokyo)` など任意
3.  プロジェクトが作成されたら、左メニューの「**Project Settings**」（歯車アイコン）>「**Database**」を開きます。
4.  「Connection string」の項目で、「**URI**」タブを選択し、表示されている接続文字列をコピーしてメモしておきます。これが`DATABASE_URL`になります。
5.  次に、左メニューの「**Project Settings**」>「**API**」を開きます。
6.  「Project API keys」の項目にある「**service_role**」のキーをコピーしてメモしておきます。これが`SUPABASE_SERVICE_ROLE_KEY`になります。

---

## Step 3: プロジェクトのフォークと設定

1.  このGitHubリポジトリを自分のアカウントに**Fork**し、ローカルPCにクローンします。
2.  `config/targets.json` を開き、監視したい商品を記述します。
3.  プロジェクトのルートに `.env` ファイルを作成し、Supabaseの接続情報を記述します。（このファイルはGitで追跡されません）
    ```
    DATABASE_URL="Step 2-4で取得したURI"
    ```
4.  ローカルPCで `npm install` を実行し、`npx prisma db push` を実行して、`config/targets.json`の内容をデータベースに反映させます。
    ```bash
    npm install
    npx prisma db push
    ```

---

## Step 4: LINE対話サーバーのデプロイ (Supabase Edge Functions)

1.  ローカルPCに[Supabase CLI](https://supabase.com/docs/guides/cli)をインストールします。
2.  ターミナルで `supabase login` を実行し、表示される手順に従ってSupabaseにログインします。
3.  `supabase link --project-ref YOUR_PROJECT_ID` を実行して、ローカルリポジトリとSupabaseプロジェクトを連携させます。（`YOUR_PROJECT_ID`はSupabaseのプロジェクトURL `https://YOUR_PROJECT_ID.supabase.co` の部分です）
4.  対話サーバーに必要な環境変数をSupabaseに設定します。
    ```bash
    supabase secrets set --env-file ./.env.production
    ```
    `.env.production` というファイルを一時的に作成し、以下を記述してから上記コマンドを実行してください。
    ```
    LINE_CHANNEL_ACCESS_TOKEN="Step 1で取得したトークン"
    LINE_CHANNEL_SECRET="Step 1で取得したシークレット"
    DATABASE_URL="Step 2-4で取得したURI"
    SUPABASE_SERVICE_ROLE_KEY="Step 2-6で取得したキー"
    ```
5.  `supabase functions deploy` コマンドで、LINE対話サーバーをデプロイします。
    ```bash
    supabase functions deploy line-webhook
    ```
6.  デプロイが完了すると、関数のURLが表示されます。これがWebhook URLになります。

---

## Step 5: LINE Webhookの設定

1.  [LINE Developers](https://developers.line.biz/ja/)のチャネル設定画面に戻ります。
2.  「**Messaging API設定**」タブの「**Webhook設定**」で、「Webhook URL」に `Step 4` で取得したSupabaseの関数URLを入力します。
3.  「**Webhookの利用**」をオンにし、「検証」ボタンを押して「成功」と表示されれば連携完了です。

---

## Step 6: GitHub Actionsの設定

1.  フォークした自分のGitHubリポジトリの「**Settings**」>「**Secrets and variables**」>「**Actions**」を開きます。
2.  「**New repository secret**」をクリックし、以下の**2つ**のシークレットを登録します。
    - `DATABASE_URL`: Step 2で取得したSupabaseの**URI**
    - `LINE_CHANNEL_ACCESS_TOKEN`: Step 1で取得した**チャネルアクセストークン**

これで全てのセットアップは完了です！

---

## 動作確認

1. GitHubリポジトリの「**Actions**」タブを開きます。
2. 「**ガンプラ在庫チェック**」ワークフローを選択します。
3. 「**Run workflow**」をクリックして手動実行します。
4. 実行が完了したら、ログを確認して正常に動作していることを確認します。

在庫が復活すると、登録したLINEアカウントに通知が届きます。