'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LAS_VEGAS_COURSES, GolfCourse, HoleData } from '@/data/courses';
import {
  calculateDistance,
  calculateBearing,
  computePlaysLike,
  PlaysLikeResult,
  WeatherData,
} from '@/utils/playsLikeEngine';
import { fetchElevationsFeet, metersToFeet } from '@/utils/elevation';
import {
  loadCalibration,
  saveCalibrationPoint,
  clearCalibrationPoint,
  mergeCalibrationStores,
  persistCalibration,
  CalibrationStore,
  CalibrationTarget,
  HoleCalibration,
} from '@/utils/calibration';
import {
  fetchSharedCalibration,
  pushCalibrationPoint,
  pushClearCalibration,
  CalibrationSyncUnavailableError,
} from '@/utils/calibrationSync';

export type CalibrationSyncStatus = 'unknown' | 'synced' | 'unavailable' | 'offline';

const AUTO_DETECT_RADIUS_MILES = 5;
const YARDS_PER_MILE = 1760;

export interface CourseWithDistance {
  course: GolfCourse;
  distanceMiles: number | null;
}

export interface TargetDistances {
  raw: number;
  playsLike: PlaysLikeResult;
}

export interface HoleDistances {
  front: TargetDistances;
  center: TargetDistances;
  back: TargetDistances;
}

interface PositionState {
  lat: number;
  lng: number;
  altitude: number | null;
  accuracy: number;
}

interface HoleElevationFeet {
  front: number;
  center: number;
  back: number;
}

function courseAnchor(course: GolfCourse) {
  return course.holes[0].greenCenter;
}

export function useGolfEngine() {
  const [position, setPosition] = useState<PositionState | null>(null);
  const [positionError, setPositionError] = useState<string | null>(null);

  const [manualCourseId, setManualCourseId] = useState<string | null>(null);
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);
  const [slopeEnabled, setSlopeEnabled] = useState(true);

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const [holeElevations, setHoleElevations] = useState<Record<number, HoleElevationFeet>>({});
  const [elevationLoading, setElevationLoading] = useState(false);

  const [userElevationOverride, setUserElevationOverride] = useState<number | null>(null);
  const lastUserElevationFetchRef = useRef<string | null>(null);

  const [calibration, setCalibration] = useState<CalibrationStore>({});
  const [syncStatus, setSyncStatus] = useState<CalibrationSyncStatus>('unknown');

  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    const local = loadCalibration();
    setCalibration(local);

    let cancelled = false;

    async function syncFromServer() {
      try {
        const shared = await fetchSharedCalibration();
        if (cancelled) return;
        const merged = mergeCalibrationStores(local, shared);
        persistCalibration(merged);
        setCalibration(merged);
        setSyncStatus('synced');
      } catch (err) {
        if (cancelled) return;
        setSyncStatus(err instanceof CalibrationSyncUnavailableError ? 'unavailable' : 'offline');
      }
    }

    syncFromServer();
    const interval = setInterval(syncFromServer, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setPositionError('Geolocation is not supported on this device.');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          altitude: pos.coords.altitude,
          accuracy: pos.coords.accuracy,
        });
        setPositionError(null);
      },
      (err) => {
        setPositionError(err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const coursesWithDistance = useMemo<CourseWithDistance[]>(() => {
    return LAS_VEGAS_COURSES.map((course) => {
      if (!position) return { course, distanceMiles: null };
      const anchor = courseAnchor(course);
      const yards = calculateDistance(position.lat, position.lng, anchor.lat, anchor.lng);
      return { course, distanceMiles: yards / YARDS_PER_MILE };
    }).sort((a, b) => {
      if (a.distanceMiles === null) return 1;
      if (b.distanceMiles === null) return -1;
      return a.distanceMiles - b.distanceMiles;
    });
  }, [position]);

  const closestCourse = coursesWithDistance[0] ?? null;
  const isAutoDetected =
    manualCourseId === null &&
    closestCourse !== null &&
    closestCourse.distanceMiles !== null &&
    closestCourse.distanceMiles <= AUTO_DETECT_RADIUS_MILES;

  const selectedCourse: GolfCourse | null = useMemo(() => {
    if (manualCourseId) {
      return LAS_VEGAS_COURSES.find((c) => c.id === manualCourseId) ?? null;
    }
    return isAutoDetected ? closestCourse!.course : null;
  }, [manualCourseId, isAutoDetected, closestCourse]);

  useEffect(() => {
    setCurrentHoleIndex(0);
  }, [selectedCourse?.id]);

  // Applies any real GPS points captured on the course over the mock
  // hole data, so distance/elevation/wind math all key off real coordinates
  // wherever a target has been calibrated.
  const effectiveHoles: HoleData[] | null = useMemo(() => {
    if (!selectedCourse) return null;
    const courseCalibration = calibration[selectedCourse.id];
    if (!courseCalibration) return selectedCourse.holes;

    return selectedCourse.holes.map((hole) => {
      const cal = courseCalibration[hole.holeNumber];
      if (!cal) return hole;
      return {
        ...hole,
        greenFront: cal.front ?? hole.greenFront,
        greenCenter: cal.center ? { ...hole.greenCenter, ...cal.center } : hole.greenCenter,
        greenBack: cal.back ?? hole.greenBack,
      };
    });
  }, [selectedCourse, calibration]);

  useEffect(() => {
    if (!selectedCourse) {
      setWeather(null);
      return;
    }

    const anchor = courseAnchor(selectedCourse);
    let cancelled = false;

    async function fetchWeather() {
      setWeatherLoading(true);
      setWeatherError(null);
      try {
        const url = new URL('https://api.open-meteo.com/v1/forecast');
        url.searchParams.set('latitude', anchor.lat.toString());
        url.searchParams.set('longitude', anchor.lng.toString());
        url.searchParams.set('current', 'temperature_2m,wind_speed_10m,wind_direction_10m,relative_humidity_2m');
        url.searchParams.set('temperature_unit', 'fahrenheit');
        url.searchParams.set('wind_speed_unit', 'mph');

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
        const data = await res.json();

        if (cancelled) return;

        setWeather({
          windSpeed: data.current.wind_speed_10m,
          windDirection: data.current.wind_direction_10m,
          temperature: data.current.temperature_2m,
          humidity: data.current.relative_humidity_2m,
        });
      } catch (err) {
        if (!cancelled) {
          setWeatherError(err instanceof Error ? err.message : 'Failed to load weather');
        }
      } finally {
        if (!cancelled) setWeatherLoading(false);
      }
    }

    fetchWeather();
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedCourse]);

  useEffect(() => {
    if (!selectedCourse || !effectiveHoles) {
      setHoleElevations({});
      return;
    }

    let cancelled = false;

    async function fetchHoleElevations(holes: HoleData[]) {
      setElevationLoading(true);
      try {
        const points = holes.flatMap((hole) => [
          hole.greenFront,
          hole.greenCenter,
          hole.greenBack,
        ]);
        const elevationsFeet = await fetchElevationsFeet(points);
        if (cancelled) return;

        const result: Record<number, HoleElevationFeet> = {};
        holes.forEach((hole, i) => {
          result[hole.holeNumber] = {
            front: elevationsFeet[i * 3],
            center: elevationsFeet[i * 3 + 1],
            back: elevationsFeet[i * 3 + 2],
          };
        });
        setHoleElevations(result);
      } catch {
        if (!cancelled) setHoleElevations({});
      } finally {
        if (!cancelled) setElevationLoading(false);
      }
    }

    fetchHoleElevations(effectiveHoles);

    return () => {
      cancelled = true;
    };
    // effectiveHoles is a derived array (new reference on course/calibration
    // change only), safe to depend on directly here.
  }, [selectedCourse, effectiveHoles]);

  useEffect(() => {
    if (!position || position.altitude !== null) return;

    const key = `${position.lat.toFixed(3)},${position.lng.toFixed(3)}`;
    if (lastUserElevationFetchRef.current === key) return;
    lastUserElevationFetchRef.current = key;

    let cancelled = false;
    fetchElevationsFeet([{ lat: position.lat, lng: position.lng }])
      .then(([feet]) => {
        if (!cancelled && feet !== undefined) setUserElevationOverride(feet);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [position]);

  const currentHole: HoleData | null = effectiveHoles
    ? effectiveHoles[currentHoleIndex] ?? null
    : null;

  const distances: HoleDistances | null = useMemo(() => {
    if (!position || !currentHole) return null;

    const realElevation = holeElevations[currentHole.holeNumber];

    const targets: Array<[keyof HoleDistances, { lat: number; lng: number }, number]> = [
      ['front', currentHole.greenFront, realElevation?.front ?? currentHole.greenCenter.elevation],
      ['center', currentHole.greenCenter, realElevation?.center ?? currentHole.greenCenter.elevation],
      ['back', currentHole.greenBack, realElevation?.back ?? currentHole.greenCenter.elevation],
    ];

    // Device altitude is meters; hole elevations above are already feet.
    const deviceElevationFeet = position.altitude !== null ? metersToFeet(position.altitude) : null;

    const result = {} as HoleDistances;
    for (const [key, target, targetElevation] of targets) {
      const raw = calculateDistance(position.lat, position.lng, target.lat, target.lng);
      const bearing = calculateBearing(position.lat, position.lng, target.lat, target.lng);
      // Falling back to targetElevation (rather than 0) neutralizes slope
      // impact when we have no real reading for the golfer's own elevation.
      const userElevation = deviceElevationFeet ?? userElevationOverride ?? targetElevation;
      const playsLike = computePlaysLike(
        raw,
        userElevation,
        targetElevation,
        slopeEnabled,
        weather,
        bearing
      );
      result[key] = { raw: Math.round(raw), playsLike };
    }

    return result;
  }, [position, currentHole, slopeEnabled, weather, holeElevations, userElevationOverride]);

  function selectCourse(courseId: string | null) {
    setManualCourseId(courseId);
  }

  function calibrateTarget(target: CalibrationTarget) {
    if (!selectedCourse || !currentHole || !position) return;
    const point = { lat: position.lat, lng: position.lng };

    // Optimistic local save so this works even with a weak signal on the
    // course; the server push happens in the background.
    const updated = saveCalibrationPoint(selectedCourse.id, currentHole.holeNumber, target, point);
    setCalibration(updated);

    pushCalibrationPoint(selectedCourse.id, currentHole.holeNumber, target, point)
      .then(() => setSyncStatus('synced'))
      .catch((err) => {
        setSyncStatus(err instanceof CalibrationSyncUnavailableError ? 'unavailable' : 'offline');
      });
  }

  function clearCalibrationTarget(target: CalibrationTarget) {
    if (!selectedCourse || !currentHole) return;
    const updated = clearCalibrationPoint(selectedCourse.id, currentHole.holeNumber, target);
    setCalibration(updated);

    pushClearCalibration(selectedCourse.id, currentHole.holeNumber, target)
      .then(() => setSyncStatus('synced'))
      .catch((err) => {
        setSyncStatus(err instanceof CalibrationSyncUnavailableError ? 'unavailable' : 'offline');
      });
  }

  const holeCalibration: HoleCalibration | undefined =
    selectedCourse && currentHole ? calibration[selectedCourse.id]?.[currentHole.holeNumber] : undefined;

  function goToHole(index: number) {
    if (!selectedCourse) return;
    const clamped = Math.max(0, Math.min(selectedCourse.holes.length - 1, index));
    setCurrentHoleIndex(clamped);
  }

  return {
    position,
    positionError,
    coursesWithDistance,
    selectedCourse,
    isAutoDetected,
    selectCourse,
    currentHoleIndex,
    currentHole,
    goToHole,
    slopeEnabled,
    setSlopeEnabled,
    weather,
    weatherLoading,
    weatherError,
    distances,
    elevationLoading,
    hasRealElevation: currentHole ? holeElevations[currentHole.holeNumber] !== undefined : false,
    holeCalibration,
    calibrateTarget,
    clearCalibrationTarget,
    syncStatus,
  };
}
