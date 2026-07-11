import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { resolveCalibrationPoint, CalibrationSubmission } from '@/utils/calibration';

const HASH_KEY = 'golf-gps-calibration';
const TARGETS = ['front', 'center', 'back'] as const;
const MAX_SUBMISSIONS_PER_POINT = 20;

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

function parseSubmissions(rawValue: unknown): CalibrationSubmission[] {
  try {
    const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is CalibrationSubmission =>
        s && typeof s.lat === 'number' && typeof s.lng === 'number' && typeof s.capturedAt === 'string'
    );
  } catch {
    return [];
  }
}

export async function GET() {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: 'Calibration sync is not configured' }, { status: 503 });
  }

  try {
    const raw = await redis.hgetall<Record<string, unknown>>(HASH_KEY);
    const entries: Record<string, unknown> = {};

    for (const [field, rawValue] of Object.entries(raw ?? {})) {
      const submissions = parseSubmissions(rawValue);
      const resolved = resolveCalibrationPoint(submissions);
      if (resolved) entries[field] = resolved;
    }

    return NextResponse.json({ entries });
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
  const submission: CalibrationSubmission = { lat, lng, capturedAt: new Date().toISOString() };

  try {
    const existingRaw = await redis.hget<unknown>(HASH_KEY, field);
    const submissions = parseSubmissions(existingRaw);
    submissions.push(submission);
    // Keep only the most recent N so a heavily-recalibrated point doesn't
    // grow the hash field unboundedly.
    const capped = submissions.slice(-MAX_SUBMISSIONS_PER_POINT);

    await redis.hset(HASH_KEY, { [field]: JSON.stringify(capped) });
    return NextResponse.json({ ok: true, resolved: resolveCalibrationPoint(capped) });
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
