import { StockChecker } from './src/checker';
import { Target, StockStatus } from './src/types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * モックデータでStockCheckerをテストするスクリプト
 */
async function testStockChecker() {
  console.log('🧪 StockChecker テスト開始');
  console.log('========================================\n');

  // HTML保存用のディレクトリを作成
  const outputDir = path.join(__dirname, 'test-output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  // モックの監視対象商品データ
  const mockTargets: Target[] = [
    {
      id: 'test-1',
      name: '商品1',
      url: 'https://p-bandai.jp/item/item-1000242190/',
      lastStatus: 'out_of_stock' as StockStatus,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'test-2',
      name: '商品2',
      url: 'https://p-bandai.jp/item/item-1000147064/',
      lastStatus: 'out_of_stock' as StockStatus,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'test-3',
      name: '商品3',
      url: 'https://p-bandai.jp/item/item-1000212520/',
      lastStatus: 'out_of_stock' as StockStatus,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const checker = new StockChecker();

  try {
    // ブラウザ初期化
    await checker.init();
    console.log('✅ ブラウザ初期化完了\n');

    // 各商品をチェック
    for (const target of mockTargets) {
      console.log(`\n📦 チェック対象: ${target.name}`);
      console.log(`   URL: ${target.url}`);
      console.log(`   前回の状態: ${target.lastStatus}`);
      console.log('----------------------------------------');

      const result = await checker.checkStock(target);

      // ページのHTMLを取得して保存
      const html = await checker.getPageHtml();
      const filename = `page-${target.id}.html`;
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, html, 'utf-8');

      console.log('\n📊 チェック結果:');
      console.log(`   商品名: ${result.name}`);
      console.log(`   前回の状態: ${result.previousStatus}`);
      console.log(`   現在の状態: ${result.currentStatus}`);
      console.log(`   状態変化: ${result.hasChanged ? 'あり' : 'なし'}`);
      console.log(`   在庫復活: ${result.isStockRestored ? 'あり' : 'なし'}`);
      console.log(`   チェック日時: ${result.checkedAt}`);
      console.log(`   💾 HTML保存先: ${filepath}`);
      console.log('========================================\n');

      // 次のページに進む前に少し待つ
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    // ブラウザを閉じる
    await checker.close();
    console.log('✅ テスト完了');
  }
}

// テスト実行
testStockChecker();
