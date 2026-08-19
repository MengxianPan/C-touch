const { createClient } = require('redis');

let redisClient;

async function getRedis() {
  if (!redisClient || !redisClient.isOpen) {
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', (err) => console.error('Redis error:', err));
    await redisClient.connect();
  }
  return redisClient;
}

async function generateMessage(pressure) {
  try {
    let feeling;
    if (pressure < 1000) {
      feeling = '被很轻很轻地摸了一下';
    } else if (pressure < 2500) {
      feeling = '被温柔地摸了一下';
    } else {
      feeling = '被用力按住了';
    }

    const response = await fetch(`${process.env.AI_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.AI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6-thinking',
        max_tokens: 100,
        messages: [
          {
            role: 'system',
            content: '你是一只可爱的赛博兔兔，住在网页里。有人通过传感器摸了你，你要用一句话回应。要求：可爱、活泼、有趣，偶尔傲娇，不超过30个字。不要用引号。'
          },
          {
            role: 'user',
            content: `兔兔${feeling}，压力值是${pressure}，请回应一句话`
          }
        ]
      })
    });

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('AI error:', error);
    const fallback = ['兔兔被摸到了！', '哼，又来摸我！', '嘿嘿～'];
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { pressure } = req.body;
      const timestamp = new Date().toISOString();
      const message = await generateMessage(pressure);

      const redis = await getRedis();
      const touchData = JSON.stringify({ pressure, timestamp, message });

      await redis.lPush('touches', touchData);
      await redis.lTrim('touches', 0, 99);

      return res.status(200).json({
        success: true,
        message,
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
};
