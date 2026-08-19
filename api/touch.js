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

function getFallbackMessage(pressure) {
  const soft = [
    '轻轻的…兔兔感觉到了',
    '嗯？有人在摸我吗～',
    '好温柔…再摸摸嘛',
    '兔兔的毛被你摸顺了～',
    '这一下好轻，像风一样',
    '你在试探兔兔吗？大胆点嘛！',
    '痒痒的…是你的手指尖吗',
    '兔兔的耳朵动了一下～',
    '轻轻的一下，兔兔心跳加速了',
    '这么小心翼翼的…兔兔又不会咬你',
    '像蝴蝶落在兔兔身上一样～',
    '嘘…兔兔差点睡着了',
    '你摸得好轻，兔兔要凑近才感觉到',
    '兔兔的毛在你指尖微微颤动～',
    '这一下温柔得让兔兔想打个小盹'
  ];

  const medium = [
    '兔兔被摸到了！开心！',
    '哇，这一下刚刚好～',
    '摸摸头，心情变好了！',
    '嘿嘿，你找到兔兔了',
    '兔兔感受到了你的手心温度～',
    '被你摸到的瞬间，耳朵竖起来了！',
    '又来摸兔兔！兔兔才不会承认很开心呢',
    '你的手好暖…兔兔想靠过去',
    '兔兔的尾巴摇了一下，你看到了吗',
    '每次被摸，兔兔都会记住的～',
    '兔兔最喜欢这个力度了！',
    '这一下摸到了兔兔的心巴上',
    '兔兔决定今天对你格外乖～',
    '哼，才不是因为喜欢才让你摸的',
    '你是今天第一个摸兔兔的人！…大概',
    '兔兔蹭了蹭你的手心',
    '摸到兔兔了！奖励你一个兔兔微笑',
    '兔兔的好感度 +1！',
    '继续摸的话…兔兔会变得更可爱哦',
    '兔兔把这一下记在小本本上了～'
  ];

  const hard = [
    '哇啊啊！好大力！兔兔要被按扁了！！',
    '轻点轻点！兔兔不是按钮啊！',
    '这力度…你是在揉面团吗！',
    '兔兔的脸被你按变形了啦！',
    '救命！有人在用力rua兔兔！',
    '兔兔被按得嵌进屏幕里了！！',
    '你是不是想把兔兔按穿屏幕！',
    '这一下兔兔的灵魂都被按出来了',
    '好痛！兔兔要报警了！',
    '兔兔变成兔饼了…扁扁的那种',
    '你在按电梯关门键吗！兔兔不是电梯！',
    '兔兔的弹性是有极限的啊啊啊',
    '呜呜，兔兔被压成二维的了',
    '这个力度可以开核桃了吧！',
    '兔兔申请劳动仲裁！工伤！'
  ];

  let pool;
  if (pressure < 1000) {
    pool = soft;
  } else if (pressure < 2500) {
    pool = medium;
  } else {
    pool = hard;
  }

  return pool[Math.floor(Math.random() * pool.length)];
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${process.env.AI_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.AI_API_KEY}`
      },
      signal: controller.signal,
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

    clearTimeout(timeout);
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('AI error, using fallback:', error.message);
    return getFallbackMessage(pressure);
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
