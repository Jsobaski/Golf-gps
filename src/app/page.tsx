'use client';

import { useGolfEngine, TargetDistances } from '@/hooks/useGolfEngine';
import { AimDirection } from '@/utils/playsLikeEngine';

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
        </span>
      </div>
    </div>
  );
}

function AimRecommendation({
  aimOffsetYards,
  aimDirection,
}: {
  aimOffsetYards: number;
  aimDirection: AimDirection;
}) {
  const isStraight = aimDirection === 'straight';

  return (
    <section className="flex items-center justify-between rounded-xl bg-surface p-4">
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
  } = useGolfEngine();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Vegas Golf GPS</h1>
          <p className="text-xs text-muted">
            {position
              ? `GPS locked ±${Math.round(position.accuracy)}m`
              : positionError
                ? positionError
                : 'Acquiring GPS signal…'}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-muted">
          Slope
          <button
            type="button"
            role="switch"
            aria-checked={slopeEnabled}
            onClick={() => setSlopeEnabled((v) => !v)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              slopeEnabled ? 'bg-accent' : 'bg-surface-alt'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-foreground transition-transform ${
                slopeEnabled ? 'translate-x-5' : 'translate-x-0.5'
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
            />
          )}

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
