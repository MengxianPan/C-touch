import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const { pressure, message } = req.body;
    const touch = {
      pressure,
      message,
      time: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
    };
    let touches = await kv.get('touches') || [];
    touches.unshift(touch);
    if (touches.length > 50) touches = touches.slice(0, 50);
    await kv.set('touches', touches);
    return res.status(200).json({ ok: true });
  }

  const touches = await kv.get('touches') || [];
  return res.status(200).json(touches);
}
