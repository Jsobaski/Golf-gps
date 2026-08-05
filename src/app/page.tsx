'use client';

import dynamic from 'next/dynamic';
import { useGolfEngine, TargetDistances, CalibrationSyncStatus } from '@/hooks/useGolfEngine';
import { AimDirection, WeatherData, estimateAimFingers } from '@/utils/playsLikeEngine';
import { CalibrationTarget, HoleCalibration } from '@/utils/calibration';

// Leaflet touches window/document at import time, so it can only run in the
// browser — ssr:false keeps Next.js from trying to render it on the server.
const HoleMap = dynamic(() => import('./components/HoleMap'), {
  ssr: false,
  loading: () => <div className="h-[260px] animate-pulse rounded-xl bg-surface-alt" />,
});

// Angle (compass degrees) the wind is blowing TOWARD, expressed relative to
// the golfer's bearing to the target — 0 means "away from you, toward the
// pin" (tailwind), 180 means "at your face" (headwind), matching the
// up-pointing default orientation of <WindArrow>.
function windBlowRotation(windDirectionFrom: number, bearingToTarget: number): number {
  return (((windDirectionFrom + 180) - bearingToTarget) % 360 + 360) % 360;
}

function WindArrow({ rotationDeg }: { rotationDeg: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6 shrink-0 text-accent"
      style={{ transform: `rotate(${rotationDeg}deg)` }}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="20" x2="12" y2="5" />
      <polyline points="6,10 12,4 18,10" />
    </svg>
  );
}

function DistanceRow({
  label,
  raw,
  playsLike,
  slopeEnabled,
}: {
  label: string;
  raw: TargetDistances['raw'];
  playsLike: TargetDistances['playsLike'];
  slopeEnabled: boolean;
}) {
  return (
    <div className="grid grid-cols-2 items-center border-b border-border py-4 last:border-b-0">
      <div className="flex flex-col items-center gap-1 border-r border-border">
        <span className="text-xs uppercase tracking-widest text-muted">{label}</span>
        <span className="font-mono text-3xl font-semibold text-foreground sm:text-4xl">{raw}</span>
        <span className="text-xs text-muted">yds</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs uppercase tracking-widest text-muted">{label}</span>
        <span className="font-mono text-3xl font-bold text-accent sm:text-4xl">
          {playsLike.playsLikeDistance}
        </span>
        <span className="text-xs text-muted">
          yds{slopeEnabled && playsLike.slopeImpact !== 0 ? ` · slope ${playsLike.slopeImpact > 0 ? '+' : ''}${playsLike.slopeImpact}` : ''}
          {playsLike.windImpact !== 0 ? ` · wind ${playsLike.windImpact > 0 ? '+' : ''}${playsLike.windImpact}` : ''}
          {playsLike.tempImpact !== 0 ? ` · temp ${playsLike.tempImpact > 0 ? '+' : ''}${playsLike.tempImpact}` : ''}
        </span>
      </div>
    </div>
  );
}

function AimRecommendation({
  aimOffsetYards,
  aimDirection,
  rawDistance,
  bearing,
  weather,
}: {
  aimOffsetYards: number;
  aimDirection: AimDirection;
  rawDistance: number;
  bearing: number;
  weather: WeatherData | null;
}) {
  const isStraight = aimDirection === 'straight';
  const fingers = estimateAimFingers(aimOffsetYards, rawDistance);

  return (
    <section className="rounded-xl bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">Aim</span>
        <div className="flex items-center gap-2">
          {!isStraight && (
            <span className="font-mono text-2xl font-bold text-accent">
              {aimDirection === 'left' ? '←' : '→'}
            </span>
          )}
          <span className="text-sm font-semibold text-accent">
            {isStraight
              ? 'Straight at the pin'
              : `${aimOffsetYards} yds ${aimDirection === 'left' ? 'Left' : 'Right'} of pin`}
          </span>
        </div>
      </div>
      {!isStraight && (
        <p className="mt-1 text-right text-xs text-muted">
          ≈ {fingers} {fingers === 1 ? 'finger' : 'fingers'} {aimDirection} at arm's length
        </p>
      )}
      {weather && weather.windSpeed > 0 && (
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <div>
            <span className="text-xs text-muted">Wind direction</span>
            <p className="text-[10px] text-muted">↑ blowing toward pin · ↓ blowing at you</p>
          </div>
          <div className="flex items-center gap-2">
            <WindArrow rotationDeg={windBlowRotation(weather.windDirection, bearing)} />
            <span className="text-sm font-semibold text-foreground">{Math.round(weather.windSpeed)} mph</span>
          </div>
        </div>
      )}
    </section>
  );
}

function syncStatusLabel(status: CalibrationSyncStatus): { text: string; className: string } {
  switch (status) {
    case 'synced':
      return { text: 'Shared with everyone testing this course', className: 'text-accent' };
    case 'unavailable':
      return { text: 'Sharing not set up yet · saved on this device only', className: 'text-muted' };
    case 'offline':
      return { text: 'Could not reach server · saved on this device only', className: 'text-muted' };
    default:
      return { text: 'Checking sync status…', className: 'text-muted' };
  }
}

function CalibrationPanel({
  calibration,
  onCalibrate,
  onClear,
  disabled,
  syncStatus,
}: {
  calibration: HoleCalibration | undefined;
  onCalibrate: (target: CalibrationTarget) => void;
  onClear: (target: CalibrationTarget) => void;
  disabled: boolean;
  syncStatus: CalibrationSyncStatus;
}) {
  const targets: Array<{ key: CalibrationTarget; label: string }> = [
    { key: 'front', label: 'Front' },
    { key: 'center', label: 'Center' },
    { key: 'back', label: 'Back' },
  ];
  const status = syncStatusLabel(syncStatus);

  return (
    <section className="rounded-xl bg-surface p-4">
      <p className="mb-1 text-xs text-muted">
        Standing on the green? Tap a target to save your real GPS spot and improve accuracy for this hole.
      </p>
      <p className={`mb-3 text-[10px] ${status.className}`}>{status.text}</p>
      <div className="grid grid-cols-3 gap-2">
        {targets.map(({ key, label }) => {
          const point = calibration?.[key];
          const isSet = Boolean(point);
          const isLocked = Boolean(point?.locked);
          return (
            <button
              key={key}
              type="button"
              disabled={disabled || isLocked}
              onClick={() => (isSet ? onClear(key) : onCalibrate(key))}
              className={`flex flex-col items-center gap-1 rounded-lg px-2 py-3 text-xs font-medium disabled:opacity-60 ${
                isLocked
                  ? 'bg-surface-alt text-muted'
                  : isSet
                    ? 'bg-accent text-background'
                    : 'bg-surface-alt text-foreground'
              }`}
            >
              <span>{label}</span>
              {point && point.submissionCount > 1 && (
                <span className="text-[9px] opacity-70">
                  {point.submissionCount} reading{point.submissionCount === 1 ? '' : 's'}
                  {point.outlierCount > 0 ? ` · ${point.outlierCount} flagged` : ''}
                </span>
              )}
              <span className="text-[10px] opacity-80">
                {isLocked ? '🔒 locked · verified' : isSet ? '✓ calibrated · tap to clear' : 'tap to set'}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function Home() {
  const {
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
    distances,
    elevationLoading,
    hasRealElevation,
    currentHoleElevation,
    holeCalibration,
    calibrateTarget,
    clearCalibrationTarget,
    syncStatus,
  } = useGolfEngine();

  // currentHoleElevation carries the unrounded front/center/back feet
  // straight from the elevation fetch — used directly rather than backing
  // this out of the already-rounded slopeImpact numbers, which individually
  // round to the nearest yard and would amplify that rounding error by
  // ~4.5x once divided back out by the 0.22 yd/ft constant.
  const frontToBackFeet =
    slopeEnabled && currentHoleElevation
      ? Math.round(currentHoleElevation.back - currentHoleElevation.front)
      : null;
  const slopeLabel =
    frontToBackFeet === null || frontToBackFeet === 0
      ? null
      : frontToBackFeet > 0
        ? `▲ Green rises ${frontToBackFeet} ft, front to back`
        : `▼ Green drops ${Math.abs(frontToBackFeet)} ft, front to back`;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight">Vegas Golf GPS</h1>
          <p className="text-xs text-muted">
            {position
              ? `GPS locked ±${Math.round(position.accuracy)}m`
              : positionError
                ? positionError
                : 'Acquiring GPS signal…'}
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted">
          Slope
          <button
            type="button"
            role="switch"
            aria-checked={slopeEnabled}
            onClick={() => setSlopeEnabled((v) => !v)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              slopeEnabled ? 'bg-accent' : 'bg-surface-alt'
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-foreground transition-transform ${
                slopeEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </label>
      </header>

      <section className="rounded-xl bg-surface p-4">
        <select
          className="w-full rounded-lg bg-surface-alt px-3 py-2 text-sm text-foreground outline-none"
          value={selectedCourse?.id ?? ''}
          onChange={(e) => selectCourse(e.target.value || null)}
        >
          <option value="">
            {isAutoDetected ? 'Auto-detecting closest course…' : 'Select a course'}
          </option>
          {coursesWithDistance.map(({ course, distanceMiles }) => (
            <option key={course.id} value={course.id}>
              {course.name}
              {distanceMiles !== null ? ` (${distanceMiles.toFixed(1)} mi)` : ''}
            </option>
          ))}
        </select>
        {selectedCourse && (
          <p className="mt-2 text-xs text-muted">
            {selectedCourse.location} · {selectedCourse.type}
            {isAutoDetected ? ' · auto-detected' : ' · manual selection'}
          </p>
        )}
      </section>

      {!selectedCourse && (
        <div className="rounded-xl bg-surface p-6 text-center text-sm text-muted">
          No course auto-detected within 5 miles. Select one above to begin.
        </div>
      )}

      {selectedCourse && currentHole && (
        <>
          <section className="flex items-center justify-between rounded-xl bg-surface p-4">
            <button
              type="button"
              onClick={() => goToHole(currentHoleIndex - 1)}
              disabled={currentHoleIndex === 0}
              className="rounded-lg bg-surface-alt px-4 py-2 text-sm font-medium disabled:opacity-30"
            >
              Prev
            </button>
            <div className="text-center">
              <div className="text-3xl font-bold">Hole {currentHole.holeNumber}</div>
              <div className="text-xs text-muted">
                Par {currentHole.par}
                {slopeEnabled && (
                  <>
                    {' · '}
                    {hasRealElevation ? (
                      <span className="text-accent">live elevation</span>
                    ) : elevationLoading ? (
                      'loading elevation…'
                    ) : (
                      'estimated elevation'
                    )}
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => goToHole(currentHoleIndex + 1)}
              disabled={currentHoleIndex === selectedCourse.holes.length - 1}
              className="rounded-lg bg-surface-alt px-4 py-2 text-sm font-medium disabled:opacity-30"
            >
              Next
            </button>
          </section>

          <HoleMap
            front={currentHole.greenFront}
            center={currentHole.greenCenter}
            back={currentHole.greenBack}
            userPosition={position}
            slopeLabel={slopeLabel}
          />

          <section className="rounded-xl bg-surface">
            <div className="grid grid-cols-2 border-b border-border px-4 py-2 text-center text-[10px] font-semibold uppercase tracking-widest text-muted">
              <span>GPS Raw</span>
              <span className="text-accent">Plays-Like</span>
            </div>
            {distances ? (
              <div className="px-4">
                <DistanceRow label="Front" raw={distances.front.raw} playsLike={distances.front.playsLike} slopeEnabled={slopeEnabled} />
                <DistanceRow label="Center" raw={distances.center.raw} playsLike={distances.center.playsLike} slopeEnabled={slopeEnabled} />
                <DistanceRow label="Back" raw={distances.back.raw} playsLike={distances.back.playsLike} slopeEnabled={slopeEnabled} />
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-muted">Waiting for GPS position…</div>
            )}
          </section>

          {distances && (
            <AimRecommendation
              aimOffsetYards={distances.center.playsLike.aimOffsetYards}
              aimDirection={distances.center.playsLike.aimDirection}
              rawDistance={distances.center.raw}
              bearing={distances.center.bearing}
              weather={weather}
            />
          )}

          <CalibrationPanel
            calibration={holeCalibration}
            onCalibrate={calibrateTarget}
            onClear={clearCalibrationTarget}
            disabled={!position}
            syncStatus={syncStatus}
          />

          <section className="flex items-center justify-between rounded-xl bg-surface p-4 text-sm">
            <span className="text-muted">Conditions</span>
            {weatherLoading && !weather ? (
              <span className="text-muted">Loading…</span>
            ) : weather ? (
              <span>
                {Math.round(weather.temperature)}°F · Wind {Math.round(weather.windSpeed)} mph{' '}
                {compassFromDegrees(weather.windDirection)}
              </span>
            ) : (
              <span className="text-muted">Unavailable</span>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function compassFromDegrees(deg: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(deg / 45) % 8];
}
