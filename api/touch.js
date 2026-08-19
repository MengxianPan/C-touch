import { createClient } from 'redis';
import { NextResponse } from 'next/server';

let client;

async function getRedis() {
  if (!client || !client.isOpen) {
    client = createClient({ url: process.env.REDIS_URL });
    client.on('error', (err) => console.error('Redis error:', err));
    await client.connect();
  }
  return client;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const pressure = body.pressure;
    const timestamp = new Date().toISOString();

    const redis = await getRedis();
    const touchData = JSON.stringify({ pressure, timestamp });

    await redis.lPush('touches', touchData);
    await redis.lTrim('touches', 0, 99);

    return NextResponse.json({
      success: true,
      message: '摸摸记录已保存~',
      pressure,
      timestamp
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const redis = await getRedis();
    const touches = await redis.lRange('touches', 0, 49);
    const parsed = touches.map(t => JSON.parse(t));
    return NextResponse.json({ touches: parsed });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
