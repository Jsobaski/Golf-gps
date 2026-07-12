'use client';

import { useEffect, useState } from 'react';
import { LAS_VEGAS_COURSES } from '@/data/courses';
import { fetchSharedCalibration, CalibrationSyncUnavailableError } from '@/utils/calibrationSync';
import { CalibrationStore, CalibrationTarget } from '@/utils/calibration';

const TARGETS: CalibrationTarget[] = ['front', 'center', 'back'];
const TARGET_LABELS: Record<CalibrationTarget, string> = { front: 'Front', center: 'Center', back: 'Back' };

export default function CalibrationStatusPage() {
  const [store, setStore] = useState<CalibrationStore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setStore(await fetchSharedCalibration());
    } catch (err) {
      setError(
        err instanceof CalibrationSyncUnavailableError
          ? 'Shared calibration sync is not configured (no database connected).'
          : 'Could not reach the calibration server.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const courseNameById = new Map(LAS_VEGAS_COURSES.map((c) => [c.id, c.name]));

  const courseEntries = store
    ? Object.entries(store)
        .map(([courseId, holes]) => ({
          courseId,
          name: courseNameById.get(courseId) ?? courseId,
          holes: Object.entries(holes)
            .map(([holeNumberStr, targets]) => ({ holeNumber: Number(holeNumberStr), targets }))
            .filter((h) => TARGETS.some((t) => h.targets[t]))
            .sort((a, b) => a.holeNumber - b.holeNumber),
        }))
        .filter((c) => c.holes.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const totalPoints = courseEntries.reduce(
    (sum, c) => sum + c.holes.reduce((s, h) => s + TARGETS.filter((t) => h.targets[t]).length, 0),
    0
  );
  const totalSubmissions = courseEntries.reduce(
    (sum, c) =>
      sum +
      c.holes.reduce(
        (s, h) => s + TARGETS.reduce((ss, t) => ss + (h.targets[t]?.submissionCount ?? 0), 0),
        0
      ),
    0
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Calibration Status</h1>
          <p className="text-xs text-muted">What testers have calibrated so far</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="shrink-0 rounded-lg bg-surface-alt px-3 py-2 text-xs font-medium"
        >
          Refresh
        </button>
      </header>

      {loading && <div className="rounded-xl bg-surface p-6 text-center text-sm text-muted">Loading…</div>}

      {!loading && error && (
        <div className="rounded-xl bg-surface p-6 text-center text-sm text-muted">{error}</div>
      )}

      {!loading && !error && (
        <>
          <section className="rounded-xl bg-surface p-4 text-sm">
            <p>
              <span className="font-mono text-2xl font-bold text-accent">{courseEntries.length}</span>{' '}
              <span className="text-muted">of {LAS_VEGAS_COURSES.length} courses have calibration data</span>
            </p>
            <p className="mt-1 text-xs text-muted">
              {totalPoints} point{totalPoints === 1 ? '' : 's'} calibrated · {totalSubmissions} total submission
              {totalSubmissions === 1 ? '' : 's'}
            </p>
          </section>

          {courseEntries.length === 0 ? (
            <div className="rounded-xl bg-surface p-6 text-center text-sm text-muted">
              No calibration submissions yet.
            </div>
          ) : (
            courseEntries.map((course) => (
              <section key={course.courseId} className="rounded-xl bg-surface p-4">
                <h2 className="mb-2 text-sm font-semibold">{course.name}</h2>
                <div className="flex flex-col gap-2">
                  {course.holes.map((hole) => (
                    <div key={hole.holeNumber} className="rounded-lg bg-surface-alt p-3 text-xs">
                      <div className="mb-1 font-semibold text-foreground">Hole {hole.holeNumber}</div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {TARGETS.map((target) => {
                          const point = hole.targets[target];
                          if (!point) return null;
                          return (
                            <div key={target} className="text-muted">
                              <span className="font-medium text-foreground">{TARGET_LABELS[target]}</span>
                              <br />
                              {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                              <br />
                              {point.submissionCount} reading{point.submissionCount === 1 ? '' : 's'}
                              {point.outlierCount > 0 ? ` · ${point.outlierCount} flagged` : ''}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}
