import * as dotenv from 'dotenv';
import { StockChecker } from './checker';
import { LineMessagingClient } from './lineMessaging';
import { NotificationMessage, CheckResult, Target, StockStatus } from './types';
import { loadTargets, loadUsers, updateTargetStatus } from './csvHelper';

// 環境変数を読み込み
dotenv.config();

/**
 * メイン処理
 */
async function main() {
  console.log('🚀 ガンプラ在庫監視Bot 起動');
  console.log(`⏰ 実行時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);

  // 環境変数チェック
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) {
    console.error('❌ LINE_CHANNEL_ACCESS_TOKEN が設定されていません');
    process.exit(1);
  }

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
  console.log(`👥 通知先: ${users.length}人`);

  if (targets.length === 0 || users.length === 0) {
    console.log('監視対象または通知先がないため、処理を終了します。');
    return;
  }

  // クライアント初期化
  const checker = new StockChecker();
  const lineClient = new LineMessagingClient(channelAccessToken);

  try {
    await checker.init();

    const results: CheckResult[] = [];

    // 各ターゲットをチェック
    for (const target of targets) {
      const result = await checker.checkStock(target);
      results.push(result);

      // 在庫復活を検知したら通知
      if (result.isStockRestored) {
        console.log(`🎉 在庫復活検知: ${result.name}`);

        const message: NotificationMessage = {
          title: `在庫復活: ${result.name}`,
          body: formatStatusChange(result.previousStatus, result.currentStatus),
          url: result.url,
          timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
        };

        try {
          // Flex Message で送信（リッチな通知）
          await lineClient.sendFlexMessage(users, message);
          console.log(`✅ 通知送信完了: ${result.name}`);
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

    // 【テスト用】在庫復活がなかった場合も通知を送る
    const stockRestoredCount = results.filter(r => r.isStockRestored).length;
    if (stockRestoredCount === 0) {
      console.log('📤 テスト通知: 在庫変化なしの通知を送信します');
      
      const summaryMessage: NotificationMessage = {
        title: '📋 在庫チェック完了',
        body: createSummaryBody(results),
        url: 'https://p-bandai.jp/',
        timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
      };

      try {
        await lineClient.sendPushMessage(users, summaryMessage);
        console.log('✅ テスト通知送信完了');
      } catch (error) {
        console.error('❌ テスト通知送信失敗', error);
      }
    }

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
