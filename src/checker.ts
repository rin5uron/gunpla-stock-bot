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
    try {
      // 1. ボタンのテキストで判定（最優先）
      const buttonSelectors = [
        'button[type="submit"]',
        'button.add-to-cart',
        'button.btn-primary',
        '.product-buy-button button',
        'button:has-text("カート")',
        'button:has-text("予約")',
      ];

      for (const selector of buttonSelectors) {
        const buttons = await page.$$(selector);
        for (const button of buttons) {
          const text = await button.textContent();
          if (!text) continue;

          const normalized = text.replace(/\s+/g, '').toLowerCase();

          // ボタンに「カートに入れる」がある場合
          if (normalized.includes('カートに入れる') || normalized.includes('カートへ')) {
            return 'in_stock';
          }

          // ボタンに「予約する」がある場合
          if (normalized.includes('予約する') || normalized.includes('予約')) {
            return 'pre_order';
          }
        }
      }

      // 2. タグで判定
      const tagSelectors = [
        '.product-tag',
        '.tag',
        '.badge',
        '[class*="tag"]',
        '[class*="label"]',
      ];

      for (const selector of tagSelectors) {
        const tags = await page.$$(selector);
        for (const tag of tags) {
          const text = await tag.textContent();
          if (!text) continue;

          const normalized = text.replace(/\s+/g, '').toLowerCase();

          // タグに「予約終了」がある場合
          if (normalized.includes('予約終了')) {
            return 'sold_out';
          }

          // タグに「予約」がある場合
          if (normalized.includes('予約')) {
            return 'pre_order';
          }
        }
      }

      // 3. ページ全体のテキストで判定（フォールバック）
      const bodyText = await page.textContent('body');
      if (bodyText) {
        const normalized = bodyText.replace(/\s+/g, '').toLowerCase();

        if (normalized.includes('カートに入れる')) return 'in_stock';
        if (normalized.includes('予約する')) return 'pre_order';
        if (normalized.includes('予約終了') || normalized.includes('受付終了')) return 'sold_out';
        if (normalized.includes('在庫がありません') || normalized.includes('在庫なし')) return 'out_of_stock';
      }

      // 4. それ以外は売り切れとみなす
      console.warn('⚠️ 在庫ボタンが見つかりませんでした。売り切れとして判定します。');
      return 'out_of_stock';

    } catch (error) {
      console.error('❌ 在庫判定でエラーが発生しました:', error);
      console.warn('⚠️ 在庫状態を判定できませんでした。詳しくは商品ページをご覧ください。');
      return 'unknown';
    }
  }

  private isStockRestored(prev: StockStatus, curr: StockStatus): boolean {
    const unavailable: StockStatus[] = ['out_of_stock', 'sold_out', 'unknown'];
    const available: StockStatus[] = ['in_stock', 'pre_order'];
    return unavailable.includes(prev) && available.includes(curr);
  }
}
