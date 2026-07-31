import { CalibrationStore, CalibrationTarget, CalibrationPoint, LatLng } from '@/utils/calibration';

function isCalibrationTarget(value: string): value is CalibrationTarget {
  return value === 'front' || value === 'center' || value === 'back';
}

// The shared store is not configured (no Upstash env vars set yet) — callers
// should treat this the same as a network failure and keep working locally.
export class CalibrationSyncUnavailableError extends Error {}

// The point has been locked by an admin reviewing submissions — no more
// tester taps are accepted for it.
export class CalibrationLockedError extends Error {}

function isCalibrationPoint(value: unknown): value is CalibrationPoint {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as CalibrationPoint).lat === 'number' &&
    typeof (value as CalibrationPoint).lng === 'number'
  );
}

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
    if (!isCalibrationPoint(rawValue)) continue;

    store[courseId] = store[courseId] ?? {};
    store[courseId][holeNumber] = { ...store[courseId][holeNumber], [target]: rawValue };
  }

  return store;
}

async function throwOnError(res: Response): Promise<void> {
  if (res.status === 503) throw new CalibrationSyncUnavailableError();
  if (res.status === 423) throw new CalibrationLockedError();
  if (!res.ok) throw new Error(`Calibration request failed (${res.status})`);
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
  await throwOnError(res);
}

// Clears every submission for a point — used by the main app's "tap to
// clear" on a target that isn't locked.
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
  await throwOnError(res);
}

// Removes one flagged tester submission — used by the calibration review
// page. Manual (spreadsheet) submissions can't be removed this way.
export async function deleteCalibrationSubmission(
  courseId: string,
  holeNumber: number,
  target: CalibrationTarget,
  submissionId: string
): Promise<void> {
  const res = await fetch('/api/calibration', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseId, holeNumber, target, submissionId }),
  });
  await throwOnError(res);
}

export async function setCalibrationLocked(
  courseId: string,
  holeNumber: number,
  target: CalibrationTarget,
  locked: boolean
): Promise<void> {
  const res = await fetch('/api/calibration', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseId, holeNumber, target, locked }),
  });
  await throwOnError(res);
}
