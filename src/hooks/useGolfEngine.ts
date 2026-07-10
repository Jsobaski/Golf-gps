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

  const watchIdRef = useRef<number | null>(null);

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

  const currentHole: HoleData | null = selectedCourse
    ? selectedCourse.holes[currentHoleIndex] ?? null
    : null;

  const distances: HoleDistances | null = useMemo(() => {
    if (!position || !currentHole) return null;

    const targets: Array<[keyof HoleDistances, { lat: number; lng: number; elevation?: number }]> = [
      ['front', currentHole.greenFront],
      ['center', currentHole.greenCenter],
      ['back', currentHole.greenBack],
    ];

    const userElevation = position.altitude ?? currentHole.greenCenter.elevation;

    const result = {} as HoleDistances;
    for (const [key, target] of targets) {
      const raw = calculateDistance(position.lat, position.lng, target.lat, target.lng);
      const bearing = calculateBearing(position.lat, position.lng, target.lat, target.lng);
      const targetElevation = target.elevation ?? currentHole.greenCenter.elevation;
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
  }, [position, currentHole, slopeEnabled, weather]);

  function selectCourse(courseId: string | null) {
    setManualCourseId(courseId);
  }

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
  };
}
