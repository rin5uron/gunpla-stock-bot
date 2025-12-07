// supabase/functions/line-webhook/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { PrismaClient } from '../../../generated/client/deno/edge.ts';
import { verifySignature } from './line-verify.ts';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: Deno.env.get('DATABASE_URL'),
    },
  },
});

serve(async (req) => {
  // LINEの署名検証
  const signature = req.headers.get('x-line-signature');
  const body = await req.text();
  const channelSecret = Deno.env.get('LINE_CHANNEL_SECRET')!;

  if (!signature || !await verifySignature(body, channelSecret, signature)) {
    return new Response('Invalid signature', { status: 401 });
  }

  const events = JSON.parse(body).events;
  console.log(`${events.length} event(s) received.`);

  // 各イベントを処理
  for (const event of events) {
    try {
      if (event.type === 'follow') {
        await handleFollow(event);
      } else if (event.type === 'unfollow') {
        await handleUnfollow(event);
      } else if (event.type === 'message' && event.message.type === 'text') {
        await handleMessage(event);
      }
    } catch (err) {
      console.error(`Failed to handle event: ${err}`);
      // 1つのイベントで失敗しても、他のイベント処理を続ける
    }
  }

  return new Response('OK', { status: 200 });
});

// --- イベントハンドラー ---

async function handleFollow(event: any) {
  const userId = event.source.userId;
  if (!userId) return;

  console.log(`Handling follow event for user: ${userId}`);
  const profile = await getLineProfile(userId);

  await prisma.user.upsert({
    where: { userId },
    update: { displayName: profile.displayName },
    create: { userId, displayName: profile.displayName },
  });
  console.log(`User ${profile.displayName} (${userId}) saved to DB.`);

  await replyMessage(event.replyToken, '友だち追加ありがとうございます！在庫が復活したら自動で通知します。');
}

async function handleUnfollow(event: any) {
  const userId = event.source.userId;
  if (!userId) return;

  console.log(`Handling unfollow event for user: ${userId}`);
  try {
    await prisma.user.delete({ where: { userId } });
    console.log(`User ${userId} deleted from DB.`);
  } catch (err) {
    console.error(`Failed to delete user ${userId}: ${err.message}`);
  }
}

async function handleMessage(event: any) {
  await replyMessage(event.replyToken, 'メッセージありがとうございます。在庫が復活したら自動で通知しますので、お待ちください。');
}


// --- LINE API 呼び出し ---

async function getLineProfile(userId: string): Promise<{ displayName: string }> {
  const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
    headers: {
      'Authorization': `Bearer ${Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to get LINE profile: ${res.statusText}`);
  }
  return await res.json();
}

async function replyMessage(replyToken: string, text: string) {
  const body = {
    replyToken,
    messages: [{ type: 'text', text }],
  };
  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Failed to reply message: ${res.statusText}`);
  }
  console.log('Successfully replied to message.');
}
