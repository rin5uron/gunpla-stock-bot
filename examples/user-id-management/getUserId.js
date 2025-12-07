const express = require('express');
const app = express();
const port = 3000;

// リクエストのボディをJSONとしてパースするためのミドルウェア
// LINEからのWebhookはJSON形式で送られてくるため、これが必要
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  },
}));

app.get('/', (req, res) => {
  res.send('<h1>ガンプラBot: LINEユーザーID取得サーバー</h1><p>サーバーは正常に起動しています。</p><p>LINE Developersコンソールで、Webhook URLを <code>/webhook</code> エンドポイントに設定してください。</p>');
});

app.post('/webhook', (req, res) => {
  console.log('=============== Webhookリクエスト受信 ===============');
  
  // LINE以外からの不正なリクエストでないか、念のため確認
  if (!req.body.events) {
    console.log('これはLINEからの有効なリクエストではありません。');
    console.log('====================================================');
    res.status(400).send('Bad Request');
    return;
  }

  // リクエストボディ全体を整形して表示
  console.log('受信したデータ全体:');
  console.log(JSON.stringify(req.body, null, 2));
  console.log('----------------------------------------------------');

  // ユーザーIDを抽出して分かりやすく表示
  const events = req.body.events;
  if (events && events.length > 0) {
    events.forEach(event => {
      if (event.source && event.source.userId) {
        console.log('\n✨✨✨ ユーザーIDが見つかりました！ ✨✨✨');
        console.log('以下のIDをコピーして config/users.csv に追加してください。');
        console.log(`\nUserID: ${event.source.userId}\n`);
        console.log('✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨');
      }
    });
  } else {
    console.log('今回のリクエストにユーザーIDは含まれていませんでした。');
  }
  
  console.log('====================================================\n');

  // LINEプラットフォームに200 OKを返す
  res.status(200).send('OK');
});

app.listen(port, () => {
  console.log(`サーバーが http://localhost:${port} で起動しました。`);
  console.log('LINE Developersコンソールで、Webhook URLに ngrok が発行したURL + "/webhook" を設定してください。');
  console.log('例: https://xxxx-xxxx-xxxx.ngrok-free.app/webhook');
  console.log('準備ができたら、新しいユーザーにBotへ何かメッセージを送ってもらってください。');
  console.log('終了するときは、この画面で Ctrl + C を押してください。');
});