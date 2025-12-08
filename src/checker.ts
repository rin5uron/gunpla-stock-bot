import { chromium, Browser, Page } from 'playwright';
import { Target, StockStatus, CheckResult } from './types';

export class StockChecker {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async init(): Promise<void> {
    // GitHub Actions等のサーバー環境では headless: true が必須
    this.browser = await chromium.launch({ headless: true });
    this.page = await this.browser.newPage();
    console.log('🌐 ブラウザを起動しました');
  }

  async close(): Promise<void> {
    await this.browser?.close();
    console.log('🌐 ブラウザを終了しました');
  }

  async getPageHtml(): Promise<string> {
    if (!this.page) throw new Error('Page not initialized.');
    return await this.page.content();
  }

  async checkStock(target: Target): Promise<CheckResult> {
    if (!this.page) throw new Error('Page not initialized.');

    const startTime = Date.now();
    const previousStatus = target.lastStatus as StockStatus;

    try {
      console.log(`📦 チェック開始: ${target.name}`);
      await this.page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      const currentStatus = await this.extractStockStatus(this.page);
      const isStockRestored = this.isStockRestored(previousStatus, currentStatus);

      if (isStockRestored) {
        console.log('🎉 在庫復活を検知しました！');
      }

      const result: CheckResult = {
        targetId: target.id,
        name: target.name,
        url: target.url,
        previousStatus: previousStatus,
        currentStatus,
        hasChanged: previousStatus !== currentStatus,
        isStockRestored,
        checkedAt: new Date().toISOString(),
      };

      const elapsed = Date.now() - startTime;
      console.log(`✅ チェック完了: ${target.name} | ${previousStatus} → ${currentStatus} | ${elapsed}ms`);
      return result;

    } catch (error) {
      console.error(`❌ チェック失敗: ${target.name}`, error);
      return {
        targetId: target.id,
        name: target.name,
        url: target.url,
        previousStatus: previousStatus,
        currentStatus: 'unknown',
        hasChanged: false,
        isStockRestored: false,
        checkedAt: new Date().toISOString(),
      };
    }
  }


  private async extractStockStatus(page: Page): Promise<StockStatus> {
    const bodyText = await page.textContent('body');
    if (!bodyText) return 'unknown';

    const normalized = bodyText.replace(/\s+/g, '').toLowerCase();

    if (normalized.includes('カートに入れる') || normalized.includes('購入手続き')) return 'in_stock';
    if (normalized.includes('予約する') || normalized.includes('予約受付中')) return 'pre_order';
    if (normalized.includes('在庫がありません') || normalized.includes('在庫なし')) return 'out_of_stock';
    if (normalized.includes('完売') || normalized.includes('受付終了')) return 'sold_out';

    console.warn(`⚠️ 在庫状態を判定できませんでした`);
    return 'unknown';
  }

  private isStockRestored(prev: StockStatus, curr: StockStatus): boolean {
    const unavailable: StockStatus[] = ['out_of_stock', 'sold_out', 'unknown'];
    const available: StockStatus[] = ['in_stock', 'pre_order'];
    return unavailable.includes(prev) && available.includes(curr);
  }
}
