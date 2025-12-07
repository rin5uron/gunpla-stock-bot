import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { StockStatus } from './types';

export interface TargetRow {
  id: string;
  name: string;
  url: string;
  lastStatus: StockStatus;
  enabled: string;
}

export interface UserRow {
  userId: string;
  displayName: string;
}

const CONFIG_DIR = path.join(__dirname, '../config');
const TARGETS_CSV = path.join(CONFIG_DIR, 'targets.csv');
const USERS_CSV = path.join(CONFIG_DIR, 'users.csv');

/**
 * 監視対象商品をCSVファイルから読み込む
 */
export function loadTargets(): TargetRow[] {
  const content = fs.readFileSync(TARGETS_CSV, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
  }) as TargetRow[];
  return records.filter(r => r.enabled === 'true');
}

/**
 * 監視対象商品の在庫状態を更新する
 */
export function updateTargetStatus(targetId: string, newStatus: StockStatus): void {
  const content = fs.readFileSync(TARGETS_CSV, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
  }) as TargetRow[];

  // 該当のターゲットを更新
  const updated = records.map(r => {
    if (r.id === targetId) {
      return { ...r, lastStatus: newStatus };
    }
    return r;
  });

  // CSVに書き戻す
  const output = stringify(updated, {
    header: true,
    columns: ['id', 'name', 'url', 'lastStatus', 'enabled'],
  });
  fs.writeFileSync(TARGETS_CSV, output, 'utf-8');
}

/**
 * LINE通知先ユーザーをCSVファイルから読み込む
 */
export function loadUsers(): UserRow[] {
  const content = fs.readFileSync(USERS_CSV, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
  }) as UserRow[];
  return records;
}
