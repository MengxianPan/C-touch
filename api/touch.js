import { createClient } from 'redis';

let client;

async function getRedis() {
  if (!client || !client.isOpen) {
    client = createClient({ url: process.env.REDIS_URL });
    client.on('error', (err) => console.error('Redis error:', err));
    await client.connect();
  }
  return client;
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { pressure } = req.body;
      const timestamp = new Date().toISOString();

      const redis = await getRedis();
      const touchData = JSON.stringify({ pressure, timestamp });

      await redis.lPush('touches', touchData);
      await redis.lTrim('touches', 0, 99);

      return res.status(200).json({
        success: true,
        message: '摸摸记录已保存~',
        pressure,
        timestamp
      });
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'GET') {
    try {
      const redis = await getRedis();
      const touches = await redis.lRange('touches', 0, 49);
      const parsed = touches.map(t => JSON.parse(t));
      return res.status(200).json({ touches: parsed });
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
