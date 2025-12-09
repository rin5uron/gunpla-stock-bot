import * as dotenv from 'dotenv';
import { StockChecker } from './checker';
import { LineMessagingClient } from './lineMessaging';
import { NotificationMessage, CheckResult, Target, StockStatus } from './types';
import { loadTargets, loadUsers, updateTargetStatus } from './csvHelper';

// 環境変数を読み込み
dotenv.config();

/**
 * コマンドライン引数を解析
 */
function parseArgs(): { testBroadcast: boolean; testPush: boolean; testStatus: boolean } {
  const args = process.argv.slice(2);
  return {
    testBroadcast: args.includes('--test-broadcast'),
    testPush: args.includes('--test-push'),
    testStatus: args.includes('--test-status'),
  };
}

/**
 * メイン処理
 */
async function main() {
  const { testBroadcast, testPush, testStatus } = parseArgs();

  console.log('🚀 ガンプラ在庫監視Bot 起動');
  console.log(`⏰ 実行時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);

  // 環境変数チェック
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) {
    console.error('❌ LINE_CHANNEL_ACCESS_TOKEN が設定されていません');
    process.exit(1);
  }

  // クライアント初期化
  const lineClient = new LineMessagingClient(channelAccessToken);

  // =============================================
  // テストモード: 一斉配信テスト（--test-broadcast）
  // =============================================
  if (testBroadcast) {
    console.log('\n📢 一斉配信テストモード');
    console.log('⚠️  友達全員にテストメッセージを送信します！\n');

    const testMessage: NotificationMessage = {
      title: '🧪 一斉配信テスト',
      body: 'これはテストメッセージです。\n友達全員に送信されています。',
      url: 'https://p-bandai.jp/',
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    };

    try {
      await lineClient.sendBroadcastMessage(testMessage);
      console.log('✅ 一斉配信テスト完了（友達全員に送信）');
    } catch (error) {
      console.error('❌ 一斉配信テスト失敗', error);
      process.exit(1);
    }
    return;
  }

  // =============================================
  // テストモード: 指定ユーザーテスト（--test-push）
  // =============================================
  if (testPush) {
    console.log('\n📤 指定ユーザーテストモード');
    console.log('📋 users.csv に登録されたユーザーにのみ送信します\n');

    const userRows = loadUsers();
    const users = userRows.map(row => ({
      userId: row.userId,
      displayName: row.displayName,
    }));

    if (users.length === 0) {
      console.log('❌ users.csv にユーザーが登録されていません');
      process.exit(1);
    }

    console.log(`👥 送信先: ${users.length}人`);
    users.forEach(u => console.log(`   - ${u.displayName || u.userId}`));

    const testMessage: NotificationMessage = {
      title: '🧪 指定ユーザーテスト',
      body: 'これはテストメッセージです。\nusers.csv に登録されたユーザーにのみ送信されています。',
      url: 'https://p-bandai.jp/',
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    };

    try {
      await lineClient.sendPushMessage(users, testMessage);
      console.log('✅ 指定ユーザーテスト完了');
    } catch (error) {
      console.error('❌ 指定ユーザーテスト失敗', error);
      process.exit(1);
    }
    return;
  }

  // =============================================
  // テストモード: 在庫状況配信（--test-status）
  // =============================================
  if (testStatus) {
    console.log('\n📊 在庫状況配信テストモード');
    console.log('📋 実際の在庫をチェックして、友達全員に配信します\n');

    const targetRows = loadTargets();
    const targets: Target[] = targetRows.map(row => ({
      id: row.id,
      name: row.name,
      url: row.url,
      lastStatus: row.lastStatus as StockStatus,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    if (targets.length === 0) {
      console.log('❌ targets.csv に商品が登録されていません');
      process.exit(1);
    }

    console.log(`📋 チェック対象: ${targets.length}件`);

    const checker = new StockChecker();
    
    try {
      await checker.init();

      const results: CheckResult[] = [];

      // 各ターゲットをチェック
      for (const target of targets) {
        const result = await checker.checkStock(target);
        results.push(result);
        await sleep(1000);
      }

      await checker.close();

      // 在庫状況をまとめてBroadcast
      const statusMessage: NotificationMessage = {
        title: '📊 テスト用手動配信',
        body: `これはテスト用の手動配信です。\n現在の実際の在庫を表示しています。\n\n${createStatusBody(results)}`,
        url: 'https://p-bandai.jp/',
        timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
      };

      await lineClient.sendBroadcastMessage(statusMessage);
      console.log('✅ 在庫状況配信完了（友達全員に送信）');

    } catch (error) {
      console.error('❌ 在庫状況配信失敗', error);
      await checker.close();
      process.exit(1);
    }
    return;
  }

  // =============================================
  // 通常モード: 在庫チェック
  // =============================================
  // CSVファイルから設定を読み込み
  const targetRows = loadTargets();
  const userRows = loadUsers();

  // CSV形式からTarget型に変換
  const targets: Target[] = targetRows.map(row => ({
    id: row.id,
    name: row.name,
    url: row.url,
    lastStatus: row.lastStatus as StockStatus,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  const users = userRows.map(row => ({
    userId: row.userId,
    displayName: row.displayName,
  }));

  console.log(`📋 監視対象: ${targets.length}件`);
  console.log(`👥 通知先（テスト用）: ${users.length}人`);

  if (targets.length === 0) {
    console.log('監視対象がないため、処理を終了します。');
    return;
  }

  // クライアント初期化
  const checker = new StockChecker();

  try {
    await checker.init();

    const results: CheckResult[] = [];

    // 各ターゲットをチェック
    for (const target of targets) {
      const result = await checker.checkStock(target);
      results.push(result);

      // 在庫復活を検知したら通知（Broadcast: 友達全員に送信）
      if (result.isStockRestored) {
        console.log(`🎉 在庫復活検知: ${result.name}`);

        const message: NotificationMessage = {
          title: `在庫復活: ${result.name}`,
          body: formatStatusChange(result.previousStatus, result.currentStatus),
          url: result.url,
          timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
        };

        try {
          // Broadcast で送信（友達全員に通知）
          await lineClient.sendBroadcastMessage(message);
          console.log(`✅ 通知送信完了: ${result.name}（友達全員）`);
        } catch (error) {
          console.error(`❌ 通知送信失敗: ${result.name}`, error);
        }
      }

      // ターゲットの lastStatus をCSVファイルで更新
      if (result.hasChanged) {
        updateTargetStatus(target.id, result.currentStatus);
      }

      // レート制限対策：1秒待機
      await sleep(1000);
    }

    console.log('💾 ターゲット情報を更新しました');

    // サマリー表示
    console.log('\n📊 実行結果サマリー');
    console.log(`  チェック済み: ${results.length}件`);
    console.log(`  変化あり: ${results.filter(r => r.hasChanged).length}件`);
    console.log(`  在庫復活: ${results.filter(r => r.isStockRestored).length}件`);

  } catch (error) {
    console.error('❌ エラーが発生しました', error);
    process.exit(1);
  } finally {
    await checker.close();
  }

  console.log('✅ 処理完了');
}

/**
 * 【テスト用】サマリー本文を作成
 */
function createSummaryBody(results: CheckResult[]): string {
  const statusMap: { [key: string]: string } = {
    in_stock: '🟢 在庫あり',
    out_of_stock: '🔴 在庫なし',
    pre_order: '🟡 予約受付中',
    sold_out: '⚫ 完売',
    unknown: '❓ 不明',
  };

  const lines = results.map(r => 
    `・${r.name}\n  ${statusMap[r.currentStatus] || r.currentStatus}`
  );

  return `在庫変化はありませんでした。\n\n${lines.join('\n\n')}`;
}

/**
 * 【在庫状況配信用】ステータス本文を作成
 */
function createStatusBody(results: CheckResult[]): string {
  const statusMap: { [key: string]: string } = {
    in_stock: '🟢 在庫あり',
    out_of_stock: '🔴 在庫なし',
    pre_order: '🟡 予約受付中',
    sold_out: '⚫ 完売',
    unknown: '❓ 不明',
  };

  const lines = results.map(r => 
    `・${r.name}\n  ${statusMap[r.currentStatus] || r.currentStatus}`
  );

  return `監視中の商品の在庫状況です。\n\n${lines.join('\n\n')}`;
}

/**
 * 在庫状態の変化をフォーマット
 */
function formatStatusChange(prev: string, curr: string): string {
  const statusMap: { [key: string]: string } = {
    in_stock: '在庫あり',
    out_of_stock: '在庫なし',
    pre_order: '予約受付中',
    sold_out: '完売',
    unknown: '不明',
  };

  return `${statusMap[prev] || prev} → ${statusMap[curr] || curr}`;
}

/**
 * スリープ関数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 実行
main();
