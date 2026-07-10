import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const HASH_KEY = 'golf-gps-calibration';
const TARGETS = ['front', 'center', 'back'] as const;

function getRedis(): Redis | null {
  // Support both the plain Upstash marketplace naming and Vercel's legacy
  // "KV" naming (what the Vercel Storage integration actually provisions).
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function isValidTarget(value: unknown): value is (typeof TARGETS)[number] {
  return typeof value === 'string' && (TARGETS as readonly string[]).includes(value);
}

export async function GET() {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: 'Calibration sync is not configured' }, { status: 503 });
  }

  try {
    const entries = await redis.hgetall<Record<string, unknown>>(HASH_KEY);
    return NextResponse.json({ entries: entries ?? {} });
  } catch {
    return NextResponse.json({ error: 'Failed to load shared calibration' }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: 'Calibration sync is not configured' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const { courseId, holeNumber, target, lat, lng } = body ?? {};

  if (
    typeof courseId !== 'string' ||
    !courseId ||
    typeof holeNumber !== 'number' ||
    !isValidTarget(target) ||
    typeof lat !== 'number' ||
    typeof lng !== 'number'
  ) {
    return NextResponse.json({ error: 'Invalid calibration payload' }, { status: 400 });
  }

  const field = `${courseId}:${holeNumber}:${target}`;
  const value = { lat, lng, capturedAt: new Date().toISOString() };

  try {
    await redis.hset(HASH_KEY, { [field]: JSON.stringify(value) });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to save calibration' }, { status: 502 });
  }
}

export async function DELETE(req: NextRequest) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: 'Calibration sync is not configured' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const { courseId, holeNumber, target } = body ?? {};

  if (typeof courseId !== 'string' || !courseId || typeof holeNumber !== 'number' || !isValidTarget(target)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const field = `${courseId}:${holeNumber}:${target}`;

  try {
    await redis.hdel(HASH_KEY, field);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to clear shared calibration' }, { status: 502 });
  }
}
