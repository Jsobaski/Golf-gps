import { CalibrationStore, CalibrationTarget, LatLng } from '@/utils/calibration';

function isCalibrationTarget(value: string): value is CalibrationTarget {
  return value === 'front' || value === 'center' || value === 'back';
}

// The shared store is not configured (no Upstash env vars set yet) — callers
// should treat this the same as a network failure and keep working locally.
export class CalibrationSyncUnavailableError extends Error {}

export async function fetchSharedCalibration(): Promise<CalibrationStore> {
  const res = await fetch('/api/calibration');
  if (res.status === 503) throw new CalibrationSyncUnavailableError();
  if (!res.ok) throw new Error(`Shared calibration fetch failed (${res.status})`);

  const data = await res.json();
  const store: CalibrationStore = {};

  for (const [field, rawValue] of Object.entries<unknown>(data.entries ?? {})) {
    const [courseId, holeNumberStr, target] = field.split(':');
    const holeNumber = Number(holeNumberStr);
    if (!courseId || Number.isNaN(holeNumber) || !target || !isCalibrationTarget(target)) continue;

    try {
      const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
      const { lat, lng } = parsed as LatLng;
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;
      store[courseId] = store[courseId] ?? {};
      store[courseId][holeNumber] = { ...store[courseId][holeNumber], [target]: { lat, lng } };
    } catch {
      // skip malformed entry
    }
  }

  return store;
}

export async function pushCalibrationPoint(
  courseId: string,
  holeNumber: number,
  target: CalibrationTarget,
  point: LatLng
): Promise<void> {
  const res = await fetch('/api/calibration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseId, holeNumber, target, lat: point.lat, lng: point.lng }),
  });
  if (res.status === 503) throw new CalibrationSyncUnavailableError();
  if (!res.ok) throw new Error(`Failed to sync calibration (${res.status})`);
}

export async function pushClearCalibration(
  courseId: string,
  holeNumber: number,
  target: CalibrationTarget
): Promise<void> {
  const res = await fetch('/api/calibration', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseId, holeNumber, target }),
  });
  if (res.status === 503) throw new CalibrationSyncUnavailableError();
  if (!res.ok) throw new Error(`Failed to clear shared calibration (${res.status})`);
}
