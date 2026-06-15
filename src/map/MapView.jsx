// MapView — the public choropleth at /map_test.
//
// On load it fetches merged-manzanas (city blocks), the privacy-safe responses
// (drawn barrio polygons + home pins), and the barrio whitelist, then RECOMPUTES
// the block colors in the browser via enrichManzana() and renders with Mapbox GL.
// (Note: it does not use the precomputed enriched-manzanas.geojson — see
// docs/ARCHITECTURE.md "Key pipeline observation".)
//
// To refresh the underlying data, see DEPLOY.md:
//   npm run export-geojson && npm run export-barrios && npm run preprocess-map

import React, { useEffect, useState, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import groupBy from 'lodash.groupby';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import { initAnalytics, logPageView, logEvent } from '../lib/analytics'
import barrioNames from '../../data/barrio-names.json'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

// Map a cleaned barrio slug (e.g. "villacrespo") to its grammatically-correct
// display name (e.g. "Villa Crespo") from data/barrio-names.json (P4A-NAMES /
// P2-NAMES-TABLE). Falls back to the raw slug if unmapped.
const displayBarrio = (slug) => barrioNames[slug] || slug;

// Normalize a raw barrio name to its slug (lowercase, no accents, no spaces) —
// same scheme as cleanedBarrios.json and the enrichment logic. Used to color
// the límites view, since the privacy-safe responses.geojson no longer carries
// a precomputed barrio_cleaned field.
const normalizeBarrio = (raw) =>
  typeof raw === 'string'
    ? raw.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '')
    : '';

const debug = false;

// P4A-NYT-LOOK: a balanced categorical palette — more saturated than the first
// pastel pass (which read too washed-out), but calmer than the original tab20.
const palette = [
  '#4a90b8', '#e08a35', '#54a866', '#d05656',
  '#9a6bb0', '#a86a4c', '#d36bb0', '#7d7d7d',
  '#c2bf3a', '#33a8a8', '#7aa6d6', '#eaa54e',
  '#74c07a', '#e87878', '#b394d8', '#b39a82',
];

//Mapbox labels layer
const knownLabelLayer = 'road-label-simple'; // to add more

const hexToRgb = (hex) => {
  const [, r, g, b] = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i) || [];
  return r && g && b ? [parseInt(r, 16), parseInt(g, 16), parseInt(b, 16)] : [0, 0, 0];
};

const rgbToHex = (r, g, b) =>
  '#' + [r, g, b].map(x => (x < 16 ? '0' : '') + x.toString(16)).join('');

// enrichManzana — assign a block (manzana) its barrio mix and color.
//
// For each response whose drawn polygon overlaps this block, we weight that
// "vote" by INVERSE DISTANCE from the respondent's home pin to the block centroid
// (w = 1/(d+0.01), capped at 5 km). Intent: people who live closest to a block
// understand it best and should have the most say; someone far away who included
// the block still counts, but at much lower weight. The per-barrio % shown in the
// tooltip is weight_barrio / total_weight. The fill is an RGB blend of the
// contributing barrio colors by their share. Full spec: docs/FORMULA.md.
//
// NOTE: this duplicates the logic in scripts/preprocess-map.mjs — they should be
// consolidated into a shared module (tracked for Phase 2/4C).
const enrichManzana = (feature, responseFeatures, barrioColors, palette, cleanedBarrios, pinPoints) => {
  const centroid = turf.centroid(feature);
  const barrios = {};            // barrio slug -> accumulated inverse-distance weight
  let count = 0;                 // total weight across all contributing responses

  responseFeatures.forEach(response => {
    if (!turf.booleanIntersects(feature, response)) return;

    const raw = response.properties.barrio ?? '';
    const barrio = typeof raw === 'string'
      ? raw
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // remove accents
          .replace(/\s+/g, '')
      : '';

    if (barrio.length < 5 || !cleanedBarrios.has(barrio)) return;

    try {
      const pin = JSON.parse(response.properties.pinLocation || '{}');
      if (!pin.lat || !pin.lng) return;

      const pinPoint = turf.point([pin.lng, pin.lat]);
      pinPoints.push(pinPoint);

      const distance = turf.distance(pinPoint, centroid, { units: 'kilometers' });
      if (distance > 5) return;

      const weight = 1 / (distance + 0.01);
      barrios[barrio] = (barrios[barrio] || 0) + weight;

      if (!barrioColors[barrio]) {
        barrioColors[barrio] = palette[Object.keys(barrioColors).length % palette.length];
      }

      count += weight;
    } catch (e) {
      console.warn('Invalid pinLocation:', response.properties.pinLocation);
    }
  });

  let blendedColor = '#444444';
  if (count > 0) {
    let r = 0, g = 0, b = 0;
    for (const [slug, weight] of Object.entries(barrios)) {
      const percent = weight / count;
      const [cr, cg, cb] = hexToRgb(barrioColors[slug] || '#888888');
      r += cr * percent;
      g += cg * percent;
      b += cb * percent;
    }
    blendedColor = rgbToHex(Math.round(r), Math.round(g), Math.round(b));
  }

  let majorityBarrio = 'desconocido';
  let maxWeight = 0;
  for (const [slug, weight] of Object.entries(barrios)) {
    if (weight > maxWeight) {
      majorityBarrio = slug;
      maxWeight = weight;
    }
  }
  
  return {
    type: 'Feature',
    id: feature.properties?.id || null,
    geometry: feature.geometry,
    properties: {
      id: feature.properties?.id || null,
      totalResponses: count,
      barrios,
      blendedColor,
      majorityBarrio,
    },
  };
};

const MapView = () => {
  const [map, setMap] = useState(null);
  const [viewMode, setViewMode] = useState('blocks'); // or 'borders'
  const [loading, setLoading] = useState(true);
  const [dots, setDots] = useState('');
  const [lockedManzanaId, setLockedManzanaId] = useState(null);
  const lockedRef = useRef(null);

  // ✅ Google Analytics page view
  useEffect(() => {
    initAnalytics();         // Only initializes once
    logPageView('/map');     // Logs the map view
  }, []);

  useEffect(() => {
    if (!loading) return;

    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);

    return () => clearInterval(interval);
  }, [loading]);

const handleShare = (mode = 'copy') => {
  if (!map) return;

const features = map.queryRenderedFeatures({ layers: ['manzanas-fill'] });

let targetFeature = null;

if (lockedManzanaId) {
  targetFeature = features.find(f => f.properties.id === lockedManzanaId);
} else {
  targetFeature = features.find(f => f.layer.id === 'manzanas-fill');
}

if (!targetFeature || !targetFeature.properties?.barrios) {
  const fallback = '¿En qué barrio está mi manzana? Descubrilo en https://dondevivocaba.com/map';
  navigator.clipboard.writeText(fallback);
  showToast('📋 Texto copiado!');
  return;
}

  const barriosRaw = targetFeature.properties.barrios;
  const barrios = typeof barriosRaw === 'string' ? JSON.parse(barriosRaw) : barriosRaw;
  const total = Object.values(barrios).reduce((sum, v) => sum + Number(v), 0);

  const sorted = Object.entries(barrios)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, weight]) => {
      const pct = Math.round((Number(weight) / total) * 100);
      return `${pct}% ${name}`;
    });

  const summary = sorted.join(', ');
  const message = `Yo vivo en ${sorted[0]}. (${summary}). Buscá tu manzana: 👉 https://dondevivocaba.com/map`;

  if (mode === 'whatsapp') {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  } else if (mode === 'x') {
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(message)}`, '_blank');
  } else {
    navigator.clipboard.writeText(message).then(() => {
      showToast('📋 Copiado!');
    });
  }

  logEvent("Map", "Share", mode);
};

  const shareButtonStyle = {
    flex: 1,
    padding: '10px',
    fontWeight: '600',
    fontSize: '18px',
    textAlign: 'center',
    background: '#222',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  };

  const toggleView = (mode) => {
    if (!map) return;

    const safeToggle = (layerId, visibility) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visibility);
      }
    };

    if (mode === 'blocks') {
      safeToggle('manzanas-fill', 'visible');
      safeToggle('hover-outline', 'visible');
      safeToggle('barrio-borders-outline', 'none');
    }

    if (mode === 'borders') {
      safeToggle('manzanas-fill', 'none');
      safeToggle('hover-outline', 'none');
      safeToggle('barrio-borders-outline', 'visible');
    }

    setViewMode(mode); // ✅ add this to update the selected style

  };

  useEffect(() => {
    let escHandler;
    const initializeMap = async () => {
    const mapInstance = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/sgoidell/cmb5t01od00oj01sde1ltcr97',
      center: [-58.45, -34.61],
      zoom: 10,
      minZoom: 10,
      maxZoom: 16,
      maxBounds: [
        [-58.53, -34.70], // southwest
        [-58.34, -34.53] // northeast
      ],
    });

      setMap(mapInstance);

      const geocoder = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        mapboxgl,
        marker: false,
        placeholder: 'Buscar dirección...',
        bbox: [-58.53, -34.70, -58.34, -34.53], // CABA bounds
        proximity: {
          longitude: -58.45,
          latitude: -34.61
        }
      });
      document.getElementById('geocoder-container').innerHTML = '';
      document.getElementById('geocoder-container')?.appendChild(
        geocoder.onAdd(mapInstance)
      );

      const [manzanasRes, responsesRes, cleanedBarriosRes] = await Promise.all([
        fetch('/data/merged-manzanas.geojson'),
        fetch('/data/responses.geojson'),
        fetch('/data/cleanedBarrios.json'),
      ]);

      const manzanasGeo = await manzanasRes.json();
      const responsesGeo = await responsesRes.json();
      const cleanedBarrios = new Set(await cleanedBarriosRes.json());

      // Derive the normalized slug on each response so the límites (borders)
      // view can color-match the blocks view. The privacy-safe responses.geojson
      // ships only id/barrio/pinLocation (no barrio_cleaned), so compute it here.
      responsesGeo.features.forEach((f) => {
        f.properties.barrio_cleaned = normalizeBarrio(f.properties.barrio);
      });

      if (debug) {
        const bbox = turf.bboxPolygon([-58.53, -34.58, -58.35, -34.54]);
        manzanasGeo.features = manzanasGeo.features.filter(f => turf.booleanIntersects(f, bbox));
      }

      // Client-side geometry simplification of every block before rendering.
      // Runs in the browser on the full ~94MB merged-manzanas set each load —
      // a load-speed cost (relevant to Phase 4D). Higher tolerance = simpler
      // polygons = faster but coarser borders (relevant to the Phase 4A "crisp
      // geometry" look). Tune deliberately + re-measure.
      const simplificationTolerance = 0.00005;
      manzanasGeo.features = manzanasGeo.features.map(f =>
        turf.simplify(f, { tolerance: simplificationTolerance, highQuality: false })
      );

      const barrioColors = {};
      const pinPoints = [];
      const responseFeatures = responsesGeo.features.map(f =>
        turf.feature(f.geometry, f.properties)
      );

      const enrichedFeatures = manzanasGeo.features.map(feature =>
        enrichManzana(feature, responseFeatures, barrioColors, palette, cleanedBarrios, pinPoints)
      );

      const enrichedGeoJSON = {
        type: 'FeatureCollection',
        features: enrichedFeatures.filter(f => f.properties.totalResponses > 0),
      };

      const labelPoints = [];
      const grouped = groupBy(enrichedFeatures, f => f.properties.majorityBarrio);
      Object.entries(grouped).forEach(([slug, features]) => {
        if (!slug || slug === 'desconocido') return;
        try {
          const collection = turf.featureCollection(features);
          const combined = turf.combine(collection);
          const centroid = turf.centroid(combined);
          centroid.properties = { barrio: displayBarrio(slug) }; // P4A-NAMES: show real name, not slug
          labelPoints.push(centroid);
        } catch (e) {
          console.warn(`Failed centroid for ${slug}`);
        }
      });

      mapInstance.addSource('manzanas', {
        type: 'geojson',
        data: enrichedGeoJSON,
      });

      mapInstance.addSource('pin-points', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: pinPoints,
        },
      });

      mapInstance.addSource('barrio-labels', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: labelPoints,
        },
      });

      // ── Map layer stack (the surface Phase 4A restyles) ──
      // 1. manzanas-fill        block choropleth — fill = per-block RGB BLEND of
      //                         contributing barrio colors (the "muddy" mix),
      //                         50% opacity. NYT-look target: muted/consistent
      //                         ramp, crisper edges, less blend mud.
      // 2. hover-outline        white 1.25px outline of the hovered/locked block.
      // 3. pin-points-layer     cyan dots at every home pin (visual noise in the
      //                         blocks view; candidate to drop/restyle).
      // 4. barrio-label-layer   barrio name labels, white text + black halo.
      // 5. barrio-borders-outline (added below) — the "límites" view; P4A-LIMITES
      //                         wants ~80% transparency, color matched to the
      //                         block color, and a tooltip re-added.
      // Insert the choropleth BENEATH the base map's first symbol (label) layer
      // so street labels render ON TOP of the fill (P4A-STREETS fix). Falls back
      // to top-of-stack if no symbol layer is found.
      const firstSymbolId = (mapInstance.getStyle().layers || [])
        .find(l => l.type === 'symbol')?.id;

      mapInstance.addLayer({
        id: 'manzanas-fill',
        type: 'fill',
        source: 'manzanas',
        paint: {
          'fill-color': ['get', 'blendedColor'],
          'fill-opacity': 0.62, // P4A-NYT-LOOK: slightly richer fill
        },
      }, firstSymbolId);

      // P4A-NYT-LOOK: thin, consistent hairline between blocks for crisp geometry.
      mapInstance.addLayer({
        id: 'manzanas-border',
        type: 'line',
        source: 'manzanas',
        paint: {
          'line-color': '#ffffff',
          'line-width': 0.4,
          'line-opacity': 0.45,
        },
      }, firstSymbolId);

      mapInstance.addLayer({
        id: 'hover-outline',
        type: 'line',
        source: 'manzanas',
        paint: {
          'line-color': '#ffffff',
          'line-width': 1.25,
        },
        filter: ['==', 'id', -1],
      });

      // Home pin dots — hidden by default in the NYT-look (raw cyan dots read as
      // noise over the choropleth). Flip visibility to 'visible' to show them.
      mapInstance.addLayer({
        id: 'pin-points-layer',
        type: 'circle',
        source: 'pin-points',
        paint: {
          'circle-radius': 4,
          'circle-color': '#00ffff',
          'circle-opacity': 0.7,
        },
        layout: {
          'visibility': 'none', // P4A-NYT-LOOK
        },
      });
      

      mapInstance.addLayer({
        id: 'barrio-label-layer',
        type: 'symbol',
        source: 'barrio-labels',
        layout: {
          'text-field': ['get', 'barrio'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 12, 14, 18], // P4A: a bit larger
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-anchor': 'center',
          'text-allow-overlap': false,
          'text-letter-spacing': 0.04, // P4A-NYT-LOOK: airier label spacing
        },
        paint: {
          // P4A-NYT-LOOK: dark label with a soft, dimmed halo (less bright than pure white)
          'text-color': '#2b2b2b',
          'text-halo-color': 'rgba(245,245,245,0.7)',
          'text-halo-width': 1.4,
        },
      });

      mapInstance.addSource('response-borders', {
      type: 'geojson',
      data: responsesGeo,
    });

    // Límites (borders) view: each respondent's drawn barrio outline, colored to
    // match that barrio's color in the blocks view (via barrio_cleaned -> barrioColors).
    // P4A-LIMITES: semi-transparent so overlaps stay legible but colors still read.
    mapInstance.addLayer({
      id: 'barrio-borders-outline',
      type: 'line',
      source: 'response-borders',
      paint: {
        'line-color': [
          'match',
          ['get', 'barrio_cleaned'],
          ...Object.entries(barrioColors).flatMap(([b, c]) => [b, c]),
          '#ccc',
        ],
        'line-width': 2,
        'line-opacity': 0.6,
      },
      layout: {
        'visibility': 'none',
      },
    });

      const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false });

    // Shared "¿A qué barrio pertenece?" popup HTML for a manzana's weighted
    // barrio mix. Was duplicated in hover/click/address-search; now one place.
    // Renders grammatically-correct names via displayBarrio() (P4A-NAMES).
    const buildBarrioPopupHTML = (barriosRaw) => {
      const barrios = typeof barriosRaw === 'string'
        ? JSON.parse(barriosRaw)
        : (barriosRaw || {});
      const total = Object.values(barrios)
        .map(w => Number(w)).filter(w => !isNaN(w))
        .reduce((sum, w) => sum + w, 0);

      let barrioList;
      if (total > 0) {
        barrioList = Object.entries(barrios)
          .map(([slug, weight]) => ({
            name: displayBarrio(slug),
            percent: Math.round((Number(weight) / total) * 100),
            color: barrioColors[slug] || '#ccc',
          }))
          .filter(e => isFinite(e.percent) && e.name)
          .sort((a, b) => b.percent - a.percent)
          .map(({ name, percent, color }) => `
            <div style="margin-bottom:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:600; color:${color}; font-size:14px;">${name}</span>
                <span style="font-size:13px; color:${color};">${percent}%</span>
              </div>
              <div style="background:#eee; height:6px; border-radius:3px; overflow:hidden;">
                <div style="background:${color}; width:${percent}%; height:6px;"></div>
              </div>
            </div>`).join('');
      } else {
        barrioList = '<div style="font-style: italic;">Sin datos para esta manzana</div>';
      }

      return `
        <div style="background:white; color:black; padding:12px 16px; border-radius:6px; font-family:sans-serif; width:175px; box-shadow: 0 0 5px rgba(0,0,0,0.25);">
          <div style="font-size:13px; font-weight:700; text-transform:uppercase; margin-bottom:10px; color:#666;">¿A qué barrio pertenece?</div>
          ${barrioList}
        </div>`;
    };

let hoverTimeout = null;

mapInstance.on('mousemove', 'manzanas-fill', (e) => {
  if (lockedRef.current !== null) return;

  clearTimeout(hoverTimeout);
  hoverTimeout = setTimeout(() => {
    const feature = e.features?.[0];
    if (!feature) return;

    const id = feature.properties.id;
    mapInstance.setFilter('hover-outline', ['==', 'id', id]);

    popup
      .setLngLat(e.lngLat)
      .setHTML(buildBarrioPopupHTML(feature.properties.barrios))
      .addTo(mapInstance);
  }, 30);
});

mapInstance.on('click', 'manzanas-fill', (e) => {
  const feature = e.features?.[0];
  if (!feature) return;

  const id = feature.properties.id;
  setLockedManzanaId(id);
  lockedRef.current = id; // 🔒 Also store in ref
  mapInstance.setFilter('hover-outline', ['==', 'id', id]);

  popup
    .setLngLat(e.lngLat)
    .setHTML(buildBarrioPopupHTML(feature.properties.barrios))
    .addTo(mapInstance);
});

mapInstance.on('click', (e) => {
  const features = mapInstance.queryRenderedFeatures(e.point, {
    layers: ['manzanas-fill'],
  });

  if (!features.length) {
    setLockedManzanaId(null);
    lockedRef.current = null;
    popup.remove();
    mapInstance.setFilter('hover-outline', ['==', 'id', -1]);
  }
});

geocoder.on('result', (e) => {
  const lngLat = e.result.center;
  // P4A-FLYTO: smooth, eased fly-to (replaces the abrupt 250ms timed jump).
  mapInstance.flyTo({
    center: lngLat,
    zoom: 15,
    speed: 1.2,        // a touch faster than default
    curve: 1.42,       // gentle zoom-out-then-in arc
    essential: true,   // honor the animation even with reduced-motion
  });

  // Clear any previously-selected manzana + its popup so the searched one
  // replaces it instead of leaving the old tooltip open (#5).
  popup.remove();
  setLockedManzanaId(null);
  lockedRef.current = null;

  const point = turf.point(lngLat);
  const hit = enrichedGeoJSON.features.find(f => turf.booleanPointInPolygon(point, f));

  if (hit) {
    const id = hit.properties.id;
    // Lock to the searched manzana so its tooltip stays put after the fly-to.
    setLockedManzanaId(id);
    lockedRef.current = id;
    if (mapInstance.getLayer('hover-outline')) {
      mapInstance.setFilter('hover-outline', ['==', 'id', id]);
    }
    const centroid = turf.centroid(hit);
    popup
      .setLngLat(centroid.geometry.coordinates)
      .setHTML(buildBarrioPopupHTML(hit.properties.barrios))
      .addTo(mapInstance);
  } else if (mapInstance.getLayer('hover-outline')) {
    mapInstance.setFilter('hover-outline', ['==', 'id', -1]);
  }
});

mapInstance.on('mouseleave', 'manzanas-fill', () => {
  mapInstance.getCanvas().style.cursor = '';

  if (lockedRef.current === null) {
    mapInstance.setFilter('hover-outline', ['==', 'id', -1]);
    popup.remove();
  }
});

// P4A-LIMITES: tooltip for the borders view (manzanas-fill is hidden there, so
// these only fire in the límites view). Shows the hovered outline's barrio name.
mapInstance.on('mousemove', 'barrio-borders-outline', (e) => {
  const f = e.features?.[0];
  if (!f) return;
  mapInstance.getCanvas().style.cursor = 'pointer';
  const slug = f.properties.barrio_cleaned || normalizeBarrio(f.properties.barrio);
  const color = barrioColors[slug] || '#ccc';
  popup
    .setLngLat(e.lngLat)
    .setHTML(`<div style="background:white; color:#000; padding:8px 12px; border-radius:6px; font-family:sans-serif; font-size:14px; font-weight:600; box-shadow:0 0 5px rgba(0,0,0,0.25);"><span style="color:${color};">${displayBarrio(slug)}</span></div>`)
    .addTo(mapInstance);
});
mapInstance.on('mouseleave', 'barrio-borders-outline', () => {
  mapInstance.getCanvas().style.cursor = '';
  popup.remove();
});

// P4A-STREETS: declutter the base map — keep street/road labels, hide other
// symbol labels (POI, places, transit, water, etc.). Heuristic on layer id;
// our own 'barrio-label-layer' is preserved. Refine the keep-rule on the preview.
mapInstance.on('load', () => {
  const baseLayers = mapInstance.getStyle()?.layers || [];
  baseLayers.forEach((layer) => {
    if (layer.type !== 'symbol' || layer.id === 'barrio-label-layer') return;
    const id = layer.id.toLowerCase();
    const isStreet = id.includes('road') || id.includes('street') || id.includes('motorway');
    const isLabel = id.includes('label') || id.includes('text');
    if (isLabel && !isStreet) {
      try { mapInstance.setLayoutProperty(layer.id, 'visibility', 'none'); } catch (e) { /* layer not togglable */ }
    }
  });
});

mapInstance.on('idle', () => {
  const layer = mapInstance.getLayer('manzanas-fill');
  if (layer && mapInstance.isStyleLoaded()) {
    setLoading(false); // ✅ hide only when filled
  }
});

// P4A-ESC: Escape closes an open tooltip and clears the locked selection.
// (Clicking an empty area already closes it via the map 'click' handler above.)
escHandler = (ev) => {
  if (ev.key !== 'Escape') return;
  popup.remove();
  setLockedManzanaId(null);
  lockedRef.current = null;
  if (mapInstance.getLayer('hover-outline')) {
    mapInstance.setFilter('hover-outline', ['==', 'id', -1]);
  }
};
window.addEventListener('keydown', escHandler);

  setLoading(false);

    };

    initializeMap();
    return () => {
      if (escHandler) window.removeEventListener('keydown', escHandler);
    };
  }, []);

return (
  <>

<div
  className="map-sidebar"
  style={{
    position: 'absolute',
    top: 20,
    left: 20,
    width: 350,
    background: '#111',
    color: 'white',
    padding: '20px',
    borderRadius: '8px',
    zIndex: 1000,
    fontFamily: 'sans-serif',
    boxShadow: '0 0 10px rgba(0,0,0,0.5)',
  }}
>
      <h2 style={{
        fontSize: '20px',
        fontWeight: '700',
        lineHeight: '1.4',
        marginBottom: '16px'
      }}>
        Dónde Vivo CABA<br />
        <span style={{ fontWeight: 400 }}>
          Mapa de la ciudad según los porteños
        </span>
      </h2>

      <div id="geocoder-container" style={{ marginBottom: '16px' }}></div>

      <div style={{ display: 'flex', marginBottom: '12px' }}>
        <button
          onClick={() => toggleView('blocks')}
          style={{
            flex: 1,
            padding: '10px',
            fontWeight: '600',
            background: viewMode === 'blocks' ? 'white' : '#333',
            color: viewMode === 'blocks' ? 'black' : 'white',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease-in-out',
          }}
        >
          MANZANAS
        </button>

        <button
          onClick={() => toggleView('borders')}
          style={{
            flex: 1,
            padding: '10px',
            fontWeight: '600',
            background: viewMode === 'borders' ? 'white' : '#333',
            color: viewMode === 'borders' ? 'black' : 'white',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease-in-out',
          }}
        >
          LÍMITES
        </button>
      </div>

<hr style={{ margin: '16px 0', borderColor: '#444' }} />

<div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
  <button
    style={{
      flex: 1,
      padding: '10px',
      fontWeight: '600',
      background: '#25D366', // WhatsApp green
      color: 'white',
      border: 'none',
      cursor: 'pointer',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
    onClick={() => {
      handleShare('whatsapp')
      window.open(`https://wa.me/?text=${message}`, '_blank');
    }}
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="20" height="20" fill="white" style={{ marginRight: 8 }}>
      <path d="M16.04 2.01C8.58 2.01 2.38 8.19 2.38 15.63c0 2.71.74 5.3 2.15 7.58L2.02 30l6.94-2.27c2.2 1.2 4.69 1.83 7.08 1.83h.01c7.46 0 13.64-6.18 13.64-13.64 0-3.64-1.42-7.06-4-9.64a13.61 13.61 0 00-9.65-4zM16.03 28c-2.12 0-4.36-.59-6.25-1.7l-.45-.26-4.13 1.35 1.36-4.03-.29-.47A11.64 11.64 0 014.4 15.63c0-6.4 5.22-11.62 11.64-11.62 3.11 0 6.02 1.21 8.21 3.4a11.53 11.53 0 013.41 8.21c0 6.41-5.23 11.63-11.63 11.63zm6.35-8.78c-.35-.18-2.06-1.02-2.38-1.14-.31-.11-.54-.18-.77.18-.22.35-.88 1.14-1.08 1.38-.2.24-.4.27-.75.09-.35-.18-1.48-.55-2.82-1.76-1.04-.93-1.74-2.09-1.95-2.44-.2-.35-.02-.54.16-.71.17-.17.35-.4.53-.6.18-.2.24-.35.36-.6.12-.24.06-.45-.03-.63-.1-.18-.77-1.86-1.06-2.55-.28-.67-.56-.58-.76-.59h-.65c-.24 0-.63.09-.96.45s-1.26 1.23-1.26 3c0 1.77 1.29 3.48 1.47 3.73.18.24 2.52 3.85 6.1 5.25.85.37 1.52.59 2.04.75.85.27 1.63.23 2.25.14.69-.1 2.06-.84 2.35-1.64.3-.81.3-1.5.21-1.64-.09-.15-.31-.23-.66-.4z" />
    </svg>
  </button>

  <button
    style={{
      flex: 1,
      padding: '10px',
      fontWeight: '600',
      background: '#000000',
      color: 'white',
      border: 'none',
      cursor: 'pointer',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
    onClick={() => {
      handleShare('x')
      window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
    }}
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="white" style={{ marginRight: 8 }}>
      <path d="M14.71 10.32l6.05-6.85h-1.43l-5.28 5.97-4.2-5.97H2.91l6.41 9.1-6.41 7.25h1.43l5.64-6.38 4.49 6.38h7.43l-6.19-9.5zM10.86 13.1l-.65-.9-5.22-7.41h2.22l4.21 5.97.65.9 5.47 7.77h-2.22l-4.46-6.33z" />
    </svg>
  </button>

  <button
    style={{
      flex: 1,
      padding: '10px',
      fontWeight: '600',
      background: '#444',
      color: 'white',
      border: 'none',
      cursor: 'pointer',
      borderRadius: '4px'
    }}
    onClick={() => handleShare('copy')}
  >
    📋
  </button>
</div>


<button
  onClick={() => window.open('https://dondevivocaba.com', '_blank')}
  style={{
    width: '100%',
    padding: '10px',
    fontWeight: '600',
    background: '#B2FFFF',
    color: 'black',
    border: 'none',
    cursor: 'pointer',
    borderRadius: '4px'
  }}
>
  📝 Sumá mi respuesta
</button>
</div>

{loading && (
  <div style={{
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(0,0,0,0.5)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    zIndex: 999,
    fontStyle: 'italic',
    pointerEvents: 'none',
    fontFamily: 'sans-serif'
  }}>
    Cargando mapa{dots}
  </div>
)}


    <div id="map" style={{ width: '100%', height: '100vh' }} />
  </>
);

};

const showToast = (message) => {
  const toast = document.createElement('div');
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '30px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#333',
    color: '#fff',
    padding: '10px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    zIndex: 9999,
    opacity: 0,
    transition: 'opacity 0.3s ease-in-out',
  });

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = 1;
  });

  setTimeout(() => {
    toast.style.opacity = 0;
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 2000);
};

export default MapView;
