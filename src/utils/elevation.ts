const METERS_TO_FEET = 3.28084;

export function metersToFeet(meters: number): number {
  return meters * METERS_TO_FEET;
}

export interface ElevationPoint {
  lat: number;
  lng: number;
}

// Open-Meteo's free Elevation API returns meters; results here are
// converted to feet to match the scale of the app's other elevation data.
export async function fetchElevationsFeet(points: ElevationPoint[]): Promise<number[]> {
  if (points.length === 0) return [];

  const url = new URL('https://api.open-meteo.com/v1/elevation');
  url.searchParams.set('latitude', points.map((p) => p.lat).join(','));
  url.searchParams.set('longitude', points.map((p) => p.lng).join(','));

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Elevation request failed (${res.status})`);

  const data = await res.json();
  const elevationsMeters: number[] = data.elevation;
  return elevationsMeters.map(metersToFeet);
}
