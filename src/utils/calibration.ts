export interface LatLng {
  lat: number;
  lng: number;
}

export type CalibrationTarget = 'front' | 'center' | 'back';

export type HoleCalibration = Partial<Record<CalibrationTarget, LatLng>>;

export type CourseCalibration = Record<number, HoleCalibration>;

export type CalibrationStore = Record<string, CourseCalibration>;

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

export function saveCalibrationPoint(
  courseId: string,
  holeNumber: number,
  target: CalibrationTarget,
  point: LatLng
): CalibrationStore {
  const store = loadCalibration();
  const course = store[courseId] ?? {};
  const hole = course[holeNumber] ?? {};

  const updated: CalibrationStore = {
    ...store,
    [courseId]: {
      ...course,
      [holeNumber]: { ...hole, [target]: point },
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
