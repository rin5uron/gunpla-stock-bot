import { Client, MessageAPIResponseBase } from '@line/bot-sdk';
import { NotificationMessage, User } from './types';

/**
 * LINE Messaging API クライアント
 */
export class LineMessagingClient {
  private client: Client;

  constructor(channelAccessToken: string) {
    this.client = new Client({
      channelAccessToken,
    });
  }

  /**
   * 友達全員にブロードキャストメッセージを送信（在庫復活通知用）
   * ※ユーザーID不要、Botの友達全員に届く
   */
  async sendBroadcastMessage(message: NotificationMessage): Promise<void> {
    const flexMessage = this.createFlexMessage(message);

    try {
      await this.client.broadcast(flexMessage);
      console.log('✅ ブロードキャスト送信成功（友達全員に通知）');
    } catch (error) {
      console.error('❌ ブロードキャスト送信失敗', error);
      throw error;
    }
  }

  /**
   * 指定ユーザーにプッシュメッセージを送信（テスト通知用）
   * ※users.csvに登録したユーザーのみに送信
   */
  async sendPushMessage(
    users: User[],
    message: NotificationMessage
  ): Promise<void> {
    const text = this.formatMessage(message);

    for (const user of users) {
      try {
        await this.client.pushMessage(user.userId, {
          type: 'text',
          text,
        });
        console.log(`✅ メッセージ送信成功: ${user.displayName || user.userId}`);
      } catch (error) {
        console.error(`❌ メッセージ送信失敗: ${user.displayName || user.userId}`, error);
        throw error;
      }
    }
  }

  /**
   * メッセージをフォーマット
   */
  private formatMessage(message: NotificationMessage): string {
    return `
🔔 ${message.title}

${message.body}

🔗 ${message.url}

⏰ ${message.timestamp}
`.trim();
  }

  /**
   * Flex Message 版（リッチなメッセージ）
   */
  async sendFlexMessage(
    users: User[],
    message: NotificationMessage
  ): Promise<void> {
    const flexMessage = this.createFlexMessage(message);

    for (const user of users) {
      try {
        await this.client.pushMessage(user.userId, flexMessage);
        console.log(`✅ Flexメッセージ送信成功: ${user.displayName || user.userId}`);
      } catch (error) {
        console.error(`❌ Flexメッセージ送信失敗: ${user.displayName || user.userId}`, error);
        throw error;
      }
    }
  }

  /**
   * Flex Message 構築
   */
  private createFlexMessage(message: NotificationMessage) {
    return {
      type: 'flex' as const,
      altText: message.title,
      contents: {
        type: 'bubble' as const,
        header: {
          type: 'box' as const,
          layout: 'vertical' as const,
          contents: [
            {
              type: 'text' as const,
              text: '🛒 ガンプラ在庫通知',
              weight: 'bold' as const,
              color: '#FF6B6B',
              size: 'sm' as const,
            },
          ],
        },
        hero: {
          type: 'box' as const,
          layout: 'vertical' as const,
          contents: [
            {
              type: 'text' as const,
              text: message.title,
              weight: 'bold' as const,
              size: 'xl' as const,
              wrap: true,
            },
          ],
          paddingAll: 'md' as const,
        },
        body: {
          type: 'box' as const,
          layout: 'vertical' as const,
          contents: [
            {
              type: 'text' as const,
              text: message.body,
              wrap: true,
              color: '#666666',
            },
            {
              type: 'separator' as const,
              margin: 'md' as const,
            },
            {
              type: 'text' as const,
              text: message.timestamp,
              size: 'xs' as const,
              color: '#AAAAAA',
              margin: 'md' as const,
            },
          ],
        },
        footer: {
          type: 'box' as const,
          layout: 'vertical' as const,
          contents: [
            {
              type: 'button' as const,
              action: {
                type: 'uri' as const,
                label: '商品ページを開く',
                uri: message.url,
              },
              style: 'primary' as const,
              color: '#FF6B6B',
            },
          ],
        },
      },
    };
  }
}
