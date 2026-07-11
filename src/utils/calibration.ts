import { calculateDistance } from '@/utils/playsLikeEngine';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface CalibrationSubmission extends LatLng {
  capturedAt: string;
}

export interface CalibrationPoint extends LatLng {
  submissionCount: number;
  outlierCount: number;
  capturedAt: string;
}

export type CalibrationTarget = 'front' | 'center' | 'back';

export type HoleCalibration = Partial<Record<CalibrationTarget, CalibrationPoint>>;

export type CourseCalibration = Record<number, HoleCalibration>;

export type CalibrationStore = Record<string, CourseCalibration>;

// Greens are typically well under this size across their whole surface, so a
// submission this far from the group's consensus is almost certainly a bad
// tap (wrong spot, GPS drift) rather than genuine variance in where people
// stood, and gets excluded from the average.
const OUTLIER_THRESHOLD_YARDS = 15;

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Averages a point's submissions, excluding outliers from the average (but
// keeping them counted) — unless excluding them would throw out everyone,
// in which case nobody is treated as an outlier.
export function resolveCalibrationPoint(submissions: CalibrationSubmission[]): CalibrationPoint | null {
  if (submissions.length === 0) return null;

  const mostRecent = submissions.reduce((latest, s) => (s.capturedAt > latest.capturedAt ? s : latest));

  if (submissions.length === 1) {
    return { lat: mostRecent.lat, lng: mostRecent.lng, submissionCount: 1, outlierCount: 0, capturedAt: mostRecent.capturedAt };
  }

  // The median (not the mean) is used as the reference point for outlier
  // detection — a single wild submission can drag a mean far enough that
  // even the good submissions end up looking like outliers relative to it.
  // The median stays anchored to wherever most submissions actually are.
  const medianPoint: LatLng = {
    lat: median(submissions.map((s) => s.lat)),
    lng: median(submissions.map((s) => s.lng)),
  };

  const inliers = submissions.filter(
    (s) => calculateDistance(s.lat, s.lng, medianPoint.lat, medianPoint.lng) <= OUTLIER_THRESHOLD_YARDS
  );

  const finalPoints = inliers.length > 0 ? inliers : submissions;
  const finalMean: LatLng = {
    lat: finalPoints.reduce((sum, p) => sum + p.lat, 0) / finalPoints.length,
    lng: finalPoints.reduce((sum, p) => sum + p.lng, 0) / finalPoints.length,
  };

  return {
    lat: finalMean.lat,
    lng: finalMean.lng,
    submissionCount: submissions.length,
    outlierCount: submissions.length - finalPoints.length,
    capturedAt: mostRecent.capturedAt,
  };
}

const STORAGE_KEY = 'golf-gps-calibration-v1';

export function loadCalibration(): CalibrationStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CalibrationStore) : {};
  } catch {
    return {};
  }
}

function persist(store: CalibrationStore) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) — calibration
    // just won't survive a reload.
  }
}

// Optimistic local save right after a tap, before the server round-trip
// resolves — treated as a single fresh submission until the next sync
// replaces it with the real (possibly averaged) shared result.
export function saveCalibrationPoint(
  courseId: string,
  holeNumber: number,
  target: CalibrationTarget,
  point: LatLng
): CalibrationStore {
  const store = loadCalibration();
  const course = store[courseId] ?? {};
  const hole = course[holeNumber] ?? {};

  const calibrationPoint: CalibrationPoint = {
    lat: point.lat,
    lng: point.lng,
    submissionCount: 1,
    outlierCount: 0,
    capturedAt: new Date().toISOString(),
  };

  const updated: CalibrationStore = {
    ...store,
    [courseId]: {
      ...course,
      [holeNumber]: { ...hole, [target]: calibrationPoint },
    },
  };

  persist(updated);
  return updated;
}

export function clearCalibrationPoint(
  courseId: string,
  holeNumber: number,
  target: CalibrationTarget
): CalibrationStore {
  const store = loadCalibration();
  const course = store[courseId];
  if (!course?.[holeNumber]?.[target]) return store;

  const hole = { ...course[holeNumber] };
  delete hole[target];

  const updated: CalibrationStore = {
    ...store,
    [courseId]: { ...course, [holeNumber]: hole },
  };

  persist(updated);
  return updated;
}

// Merges a store fetched from the shared backend over the local cache —
// incoming (shared) entries win, since they represent the pooled result of
// everyone's calibration, not just this device's.
export function mergeCalibrationStores(base: CalibrationStore, incoming: CalibrationStore): CalibrationStore {
  const merged: CalibrationStore = { ...base };

  for (const [courseId, courseCal] of Object.entries(incoming)) {
    merged[courseId] = { ...merged[courseId] };
    for (const [holeNumberStr, holeCal] of Object.entries(courseCal)) {
      const holeNumber = Number(holeNumberStr);
      merged[courseId][holeNumber] = { ...merged[courseId][holeNumber], ...holeCal };
    }
  }

  return merged;
}

export function persistCalibration(store: CalibrationStore) {
  persist(store);
}
