'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LatLng {
  lat: number;
  lng: number;
}

interface HoleMapProps {
  front: LatLng;
  center: LatLng;
  back: LatLng;
  userPosition: LatLng | null;
  slopeLabel: string | null;
}

function pinIcon(background: string, label: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="background:${background};color:#121212;font-size:10px;font-weight:700;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #121212;box-shadow:0 1px 4px rgba(0,0,0,0.5)">${label}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

export default function HoleMap({ front, center, back, userPosition, slopeLabel }: HoleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Map + basemap are created once; markers are redrawn on prop changes
  // below without tearing down the map itself.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
    }).setView([center.lat, center.lng], 18);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 20,
      attribution: 'Imagery &copy; Esri',
    }).addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
    // Only ever initialized once — subsequent hole changes are handled by
    // the effect below, which redraws markers on the existing map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    layerGroup.addLayer(L.marker([front.lat, front.lng], { icon: pinIcon('#00E676', 'F') }));
    layerGroup.addLayer(L.marker([center.lat, center.lng], { icon: pinIcon('#00E676', 'C') }));
    layerGroup.addLayer(L.marker([back.lat, back.lng], { icon: pinIcon('#00E676', 'B') }));

    const bounds = L.latLngBounds([
      [front.lat, front.lng],
      [center.lat, center.lng],
      [back.lat, back.lng],
    ]);

    if (userPosition) {
      layerGroup.addLayer(L.marker([userPosition.lat, userPosition.lng], { icon: pinIcon('#42A5F5', '●') }));
      layerGroup.addLayer(
        L.polyline(
          [
            [userPosition.lat, userPosition.lng],
            [center.lat, center.lng],
          ],
          { color: '#00E676', weight: 2, dashArray: '4,6', opacity: 0.8 }
        )
      );
      bounds.extend([userPosition.lat, userPosition.lng]);
    }

    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 19 });
  }, [front.lat, front.lng, center.lat, center.lng, back.lat, back.lng, userPosition?.lat, userPosition?.lng]);

  return (
    <div className="relative overflow-hidden rounded-xl" style={{ height: 260 }}>
      <div ref={containerRef} className="h-full w-full" />
      {slopeLabel && (
        // Leaflet's own panes/controls use z-index up to ~1000 and don't
        // establish a stacking context on their container, so an unindexed
        // sibling here would silently render underneath them regardless of
        // DOM order — z-[1000] keeps this above all of Leaflet's layers.
        <div className="pointer-events-none absolute bottom-2 left-2 z-[1000] rounded-lg bg-black/70 px-2 py-1 text-[10px] font-medium text-accent backdrop-blur-sm">
          {slopeLabel}
        </div>
      )}
    </div>
  );
}
