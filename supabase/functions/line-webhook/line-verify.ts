// supabase/functions/line-webhook/line-verify.ts

/**
 * LINEのWebhookリクエストの署名を検証する
 * @param body - リクエストボディ（文字列）
 * @param channelSecret - LINEチャネルシークレット
 * @param signature - x-line-signatureヘッダーの値
 * @returns 署名が有効な場合はtrue、それ以外はfalse
 */
export async function verifySignature(body: string, channelSecret: string, signature: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(channelSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const base64 = btoa(String.fromCharCode(...new Uint8Array(signed)));

    return base64 === signature;
  } catch (e) {
    console.error('Signature verification failed:', e);
    return false;
  }
}
