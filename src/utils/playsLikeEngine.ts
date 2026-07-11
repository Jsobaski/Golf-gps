export interface WeatherData {
  windSpeed: number;
  windDirection: number;
  temperature: number;
  humidity: number;
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c * 1.09361; // Returns Yards
}

export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export type AimDirection = 'left' | 'right' | 'straight';

export interface PlaysLikeResult {
  playsLikeDistance: number;
  slopeImpact: number;
  windImpact: number;
  tempImpact: number;
  aimOffsetYards: number;
  aimDirection: AimDirection;
}

// Rough crosswind drift heuristic: ~1 yard of lateral push per mph of full
// crosswind per 100 yards carried. Matches the same rule-of-thumb spirit as
// the wind/slope constants above, not a physics model.
const CROSSWIND_YARDS_PER_MPH_PER_100YD = 1;

export function computePlaysLike(
  rawDistance: number,
  userElevation: number,
  targetElevation: number,
  slopeEnabled: boolean,
  weather: WeatherData | null,
  bearingToTarget: number
): PlaysLikeResult {
  let slopeImpact = 0;
  let windImpact = 0;
  let tempImpact = 0;
  let aimOffsetYards = 0;
  let aimDirection: AimDirection = 'straight';

  if (slopeEnabled) {
    slopeImpact = (targetElevation - userElevation) * 0.22;
  }

  if (weather && weather.windSpeed > 0) {
    const relativeAngle = ((weather.windDirection - bearingToTarget + 180) % 360) - 180;
    const relativeRad = (relativeAngle * Math.PI) / 180;

    const headwindComponent = weather.windSpeed * Math.cos(relativeRad);
    windImpact = headwindComponent > 0 ? headwindComponent * 1.0 : headwindComponent * 0.6;

    // Positive = wind is coming from the golfer's right (pushes the ball
    // left), so the golfer should aim right to compensate, and vice versa.
    const crosswindComponent = weather.windSpeed * Math.sin(relativeRad);
    aimOffsetYards = Math.round(
      Math.abs(crosswindComponent) * (rawDistance / 100) * CROSSWIND_YARDS_PER_MPH_PER_100YD
    );
    if (aimOffsetYards > 0) {
      aimDirection = crosswindComponent > 0 ? 'right' : 'left';
    }
  }

  if (weather) {
    tempImpact = (70 - weather.temperature) * 0.15;
  }

  return {
    playsLikeDistance: Math.max(0, Math.round(rawDistance + slopeImpact + windImpact + tempImpact)),
    slopeImpact: Math.round(slopeImpact),
    windImpact: Math.round(windImpact),
    tempImpact: Math.round(tempImpact),
    aimOffsetYards,
    aimDirection,
  };
}

// A finger held up at arm's length is a rough visual reference: about 1
// finger of aim adjustment per 10% of the shot's distance in lateral yards
// (e.g. ~20 yards left on a 200-yard shot is about 1 finger). Scales with
// distance since the ratio, not the raw yardage, is what stays visually
// consistent at arm's length.
const OFFSET_RATIO_PER_FINGER = 0.10;

export function estimateAimFingers(aimOffsetYards: number, rawDistanceYards: number): number {
  if (aimOffsetYards <= 0 || rawDistanceYards <= 0) return 0;
  const offsetRatio = aimOffsetYards / rawDistanceYards;
  return Math.max(1, Math.round(offsetRatio / OFFSET_RATIO_PER_FINGER));
}
