'use client';

import { useEffect, useState } from 'react';
import { LAS_VEGAS_COURSES } from '@/data/courses';
import {
  fetchSharedCalibration,
  deleteCalibrationSubmission,
  setCalibrationLocked,
  CalibrationSyncUnavailableError,
} from '@/utils/calibrationSync';
import { CalibrationStore, CalibrationTarget, CalibrationPoint } from '@/utils/calibration';

const TARGETS: CalibrationTarget[] = ['front', 'center', 'back'];
const TARGET_LABELS: Record<CalibrationTarget, string> = { front: 'Front', center: 'Center', back: 'Back' };
const READY_THRESHOLD = 5;

function formatTimestamp(iso: string): string {
  if (iso === '1970-01-01T00:00:00.000Z') return 'from spreadsheet';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function PointDetail({
  courseId,
  holeNumber,
  target,
  point,
  onChanged,
}: {
  courseId: string;
  holeNumber: number;
  target: CalibrationTarget;
  point: CalibrationPoint;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function handleDelete(submissionId: string) {
    setBusy(submissionId);
    try {
      await deleteCalibrationSubmission(courseId, holeNumber, target, submissionId);
      await onChanged();
    } finally {
      setBusy(null);
    }
  }

  async function handleToggleLock() {
    setBusy('lock');
    try {
      await setCalibrationLocked(courseId, holeNumber, target, !point.locked);
      await onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-2 rounded-lg bg-background p-2">
      <div className="flex flex-col gap-1">
        {point.submissions.map((s) => (
          <div
            key={s.id}
            className={`flex items-center justify-between gap-2 rounded px-2 py-1 text-[10px] ${
              s.isOutlier ? 'bg-red-950 text-red-300' : 'text-muted'
            }`}
          >
            <span>
              <span
                className={`mr-1 rounded px-1 py-0.5 ${
                  s.source === 'manual' ? 'bg-blue-950 text-blue-300' : 'bg-surface-alt'
                }`}
              >
                {s.source === 'manual' ? 'manual' : 'tester'}
              </span>
              {s.lat.toFixed(5)}, {s.lng.toFixed(5)} · {formatTimestamp(s.capturedAt)}
              {s.isOutlier ? ' · flagged as outlier' : ''}
            </span>
            {s.source === 'tester' && (
              <button
                type="button"
                disabled={busy === s.id}
                onClick={() => handleDelete(s.id)}
                className="shrink-0 rounded bg-surface-alt px-2 py-0.5 text-foreground disabled:opacity-40"
              >
                {busy === s.id ? '…' : 'Remove'}
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={busy === 'lock'}
        onClick={handleToggleLock}
        className={`mt-2 w-full rounded-lg px-2 py-1.5 text-[10px] font-medium disabled:opacity-40 ${
          point.locked ? 'bg-surface-alt text-foreground' : 'bg-accent text-background'
        }`}
      >
        {busy === 'lock' ? '…' : point.locked ? '🔓 Unlock this point' : '🔒 Lock this point (stop new submissions)'}
      </button>
    </div>
  );
}

function PointCard({
  courseId,
  holeNumber,
  target,
  point,
  onChanged,
}: {
  courseId: string;
  holeNumber: number;
  target: CalibrationTarget;
  point: CalibrationPoint;
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasManual = point.submissions.some((s) => s.source === 'manual');
  const readyToReview = point.submissionCount >= READY_THRESHOLD && !point.locked;

  return (
    <div className="rounded-lg bg-surface-alt p-2 text-xs">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="w-full text-left">
        <div className="flex items-center justify-between">
          <span className="font-medium text-foreground">{TARGET_LABELS[target]}</span>
          <span className="text-[10px] text-muted">{expanded ? '▲' : '▼'}</span>
        </div>
        <div className="text-muted">
          {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {point.locked && (
            <span className="rounded bg-accent px-1.5 py-0.5 text-[9px] font-medium text-background">🔒 locked</span>
          )}
          {hasManual && (
            <span className="rounded bg-blue-950 px-1.5 py-0.5 text-[9px] text-blue-300">manually added</span>
          )}
          <span className="rounded bg-background px-1.5 py-0.5 text-[9px] text-muted">
            {point.submissionCount} reading{point.submissionCount === 1 ? '' : 's'}
            {point.outlierCount > 0 ? ` · ${point.outlierCount} flagged` : ''}
          </span>
          {readyToReview && (
            <span className="rounded bg-yellow-950 px-1.5 py-0.5 text-[9px] text-yellow-300">ready to review</span>
          )}
        </div>
      </button>
      {expanded && (
        <PointDetail courseId={courseId} holeNumber={holeNumber} target={target} point={point} onChanged={onChanged} />
      )}
    </div>
  );
}

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

  const allPoints = courseEntries.flatMap((c) =>
    c.holes.flatMap((h) =>
      TARGETS.map((t) => h.targets[t]).filter((p): p is CalibrationPoint => Boolean(p))
    )
  );
  const totalPoints = allPoints.length;
  const totalSubmissions = allPoints.reduce((sum, p) => sum + p.submissionCount, 0);
  const lockedCount = allPoints.filter((p) => p.locked).length;
  const readyCount = allPoints.filter((p) => p.submissionCount >= READY_THRESHOLD && !p.locked).length;
  const manualCount = allPoints.filter((p) => p.submissions.some((s) => s.source === 'manual')).length;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Calibration Status</h1>
          <p className="text-xs text-muted">Review, clean up, and lock down green coordinates</p>
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
              <span className="text-muted">of {LAS_VEGAS_COURSES.length} courses have coordinate data</span>
            </p>
            <p className="mt-1 text-xs text-muted">
              {totalPoints} point{totalPoints === 1 ? '' : 's'} · {totalSubmissions} total submission
              {totalSubmissions === 1 ? '' : 's'} · {manualCount} manually added · {lockedCount} locked
            </p>
            {readyCount > 0 && (
              <p className="mt-2 rounded-lg bg-yellow-950 px-3 py-2 text-xs text-yellow-300">
                {readyCount} point{readyCount === 1 ? '' : 's'} ready for review — 5+ readings and not locked yet.
              </p>
            )}
          </section>

          {courseEntries.length === 0 ? (
            <div className="rounded-xl bg-surface p-6 text-center text-sm text-muted">No calibration data yet.</div>
          ) : (
            courseEntries.map((course) => (
              <section key={course.courseId} className="rounded-xl bg-surface p-4">
                <h2 className="mb-2 text-sm font-semibold">{course.name}</h2>
                <div className="flex flex-col gap-3">
                  {course.holes.map((hole) => (
                    <div key={hole.holeNumber}>
                      <div className="mb-1 text-xs font-semibold text-foreground">Hole {hole.holeNumber}</div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {TARGETS.map((target) => {
                          const point = hole.targets[target];
                          if (!point) return null;
                          return (
                            <PointCard
                              key={target}
                              courseId={course.courseId}
                              holeNumber={hole.holeNumber}
                              target={target}
                              point={point}
                              onChanged={load}
                            />
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
