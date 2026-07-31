import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { resolveCalibrationPoint, CalibrationSubmission } from '@/utils/calibration';
import { REAL_HOLE_COORDINATES } from '@/data/courses';

const HASH_KEY = 'golf-gps-calibration';
const TARGETS = ['front', 'center', 'back'] as const;
const MAX_SUBMISSIONS_PER_POINT = 20;

interface StoredField {
  submissions: CalibrationSubmission[];
  locked: boolean;
}

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

function generateSubmissionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseStoredField(rawValue: unknown): StoredField {
  try {
    const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
    const submissions = Array.isArray(parsed?.submissions)
      ? (parsed.submissions.filter(
          (s: unknown): s is CalibrationSubmission =>
            typeof s === 'object' &&
            s !== null &&
            typeof (s as CalibrationSubmission).lat === 'number' &&
            typeof (s as CalibrationSubmission).lng === 'number' &&
            typeof (s as CalibrationSubmission).capturedAt === 'string' &&
            typeof (s as CalibrationSubmission).id === 'string'
        ) as CalibrationSubmission[])
      : [];
    return { submissions, locked: Boolean(parsed?.locked) };
  } catch {
    return { submissions: [], locked: false };
  }
}

// Spreadsheet-verified coordinates aren't stored in Redis — they live in
// courses.ts — but are folded in here as a regular submission (tagged
// 'manual') so they participate in the same averaging/outlier pool as
// tester GPS taps, per how this course's data collection is meant to work.
function manualSubmission(
  courseId: string,
  holeNumber: number,
  target: (typeof TARGETS)[number]
): CalibrationSubmission | null {
  const point = REAL_HOLE_COORDINATES[courseId]?.[holeNumber]?.[target];
  if (!point) return null;
  return {
    id: `manual:${courseId}:${holeNumber}:${target}`,
    lat: point.lat,
    lng: point.lng,
    capturedAt: '1970-01-01T00:00:00.000Z',
    source: 'manual',
  };
}

function manualFields(): string[] {
  const fields: string[] = [];
  for (const [courseId, holes] of Object.entries(REAL_HOLE_COORDINATES)) {
    for (const holeNumberStr of Object.keys(holes)) {
      for (const target of TARGETS) {
        fields.push(`${courseId}:${holeNumberStr}:${target}`);
      }
    }
  }
  return fields;
}

export async function GET() {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: 'Calibration sync is not configured' }, { status: 503 });
  }

  try {
    const raw = await redis.hgetall<Record<string, unknown>>(HASH_KEY);
    const allFields = new Set([...Object.keys(raw ?? {}), ...manualFields()]);

    const entries: Record<string, unknown> = {};

    for (const field of allFields) {
      const [courseId, holeNumberStr, target] = field.split(':');
      const holeNumber = Number(holeNumberStr);
      if (!courseId || Number.isNaN(holeNumber) || !isValidTarget(target)) continue;

      const stored = parseStoredField(raw?.[field]);
      const manual = manualSubmission(courseId, holeNumber, target);
      const combined = manual ? [manual, ...stored.submissions] : stored.submissions;

      const resolved = resolveCalibrationPoint(combined, stored.locked);
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

  try {
    const existingRaw = await redis.hget<unknown>(HASH_KEY, field);
    const stored = parseStoredField(existingRaw);

    if (stored.locked) {
      return NextResponse.json(
        { error: 'This point has been locked and is no longer accepting submissions' },
        { status: 423 }
      );
    }

    const submission: CalibrationSubmission = {
      id: generateSubmissionId(),
      lat,
      lng,
      capturedAt: new Date().toISOString(),
      source: 'tester',
    };

    const submissions = [...stored.submissions, submission].slice(-MAX_SUBMISSIONS_PER_POINT);
    await redis.hset(HASH_KEY, { [field]: JSON.stringify({ submissions, locked: stored.locked }) });

    const manual = manualSubmission(courseId, holeNumber, target);
    const combined = manual ? [manual, ...submissions] : submissions;
    return NextResponse.json({ ok: true, resolved: resolveCalibrationPoint(combined, stored.locked) });
  } catch {
    return NextResponse.json({ error: 'Failed to save calibration' }, { status: 502 });
  }
}

// Clears everything for a point (courseId+holeNumber+target only — used by
// the main app's "tap to clear"), or removes a single tester submission by
// id (courseId+holeNumber+target+submissionId — used by the review page).
export async function DELETE(req: NextRequest) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: 'Calibration sync is not configured' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const { courseId, holeNumber, target, submissionId } = body ?? {};

  if (typeof courseId !== 'string' || !courseId || typeof holeNumber !== 'number' || !isValidTarget(target)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const field = `${courseId}:${holeNumber}:${target}`;

  try {
    if (typeof submissionId !== 'string' || !submissionId) {
      await redis.hdel(HASH_KEY, field);
      return NextResponse.json({ ok: true });
    }

    const existingRaw = await redis.hget<unknown>(HASH_KEY, field);
    const stored = parseStoredField(existingRaw);
    const submissions = stored.submissions.filter((s) => s.id !== submissionId);

    if (submissions.length === 0 && !stored.locked) {
      await redis.hdel(HASH_KEY, field);
    } else {
      await redis.hset(HASH_KEY, { [field]: JSON.stringify({ submissions, locked: stored.locked }) });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to clear shared calibration' }, { status: 502 });
  }
}

// Locks or unlocks a point so it stops (or resumes) accepting tester
// submissions. Manual (spreadsheet) entries stay visible either way — the
// lock only governs whether new tester taps are accepted.
export async function PATCH(req: NextRequest) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: 'Calibration sync is not configured' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const { courseId, holeNumber, target, locked } = body ?? {};

  if (
    typeof courseId !== 'string' ||
    !courseId ||
    typeof holeNumber !== 'number' ||
    !isValidTarget(target) ||
    typeof locked !== 'boolean'
  ) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const field = `${courseId}:${holeNumber}:${target}`;

  try {
    const existingRaw = await redis.hget<unknown>(HASH_KEY, field);
    const stored = parseStoredField(existingRaw);
    await redis.hset(HASH_KEY, { [field]: JSON.stringify({ submissions: stored.submissions, locked }) });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to update lock state' }, { status: 502 });
  }
}
