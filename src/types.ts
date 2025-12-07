import { Target as PrismaTarget } from '@prisma/client';

/**
 * 在庫状態
 */
export type StockStatus =
  | 'in_stock' // 在庫あり
  | 'out_of_stock' // 在庫なし
  | 'pre_order' // 予約受付中
  | 'sold_out' // 完売
  | 'unknown'; // 不明（エラーなど）

/**
 * チェック結果
 */
export interface CheckResult {
  /** ターゲットID */
  targetId: string;
  /** 商品名 */
  name: string;
  /** 商品URL */
  url: string;
  /** 前回の状態 */
  previousStatus: StockStatus;
  /** 現在の状態 */
  currentStatus: StockStatus;
  /** 状態が変化したか */
  hasChanged: boolean;
  /** 在庫復活（なし→あり/予約）か */
  isStockRestored: boolean;
  /** チェック日時 */
  checkedAt: string;
}

/**
 * 通知メッセージ
 */
export interface NotificationMessage {
  /** タイトル */
  title: string;
  /** 本文 */
  body: string;
  /** 商品URL */
  url: string;
  /** 日時 */
  timestamp: string;
}

// PrismaのTarget型をStockStatusで上書き
export type Target = Omit<PrismaTarget, 'lastStatus'> & {
  lastStatus: StockStatus;
};
