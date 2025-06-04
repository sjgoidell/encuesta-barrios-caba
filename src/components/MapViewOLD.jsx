import React, { useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import groupBy from 'lodash.groupby';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const debug = true;

const palette = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728',
  '#9467bd', '#8c564b', '#e377c2', '#7f7f7f',
  '#bcbd22', '#17becf', '#aec7e8', '#ffbb78',
  '#98df8a', '#ff9896', '#c5b0d5', '#c49c94',
];

const hexToRgb = (hex) => {
  const [, r, g, b] = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i) || [];
  return r && g && b ? [parseInt(r, 16), parseInt(g, 16), parseInt(b, 16)] : [0, 0, 0];
};

const rgbToHex = (r, g, b) =>
  '#' + [r, g, b].map(x => (x < 16 ? '0' : '') + x.toString(16)).join('');

// ✅ Cleaned + modular enrichment logic
const enrichManzana = (feature, responseFeatures, barrioColors, palette, cleanedBarrios, pinPoints) => {
  const centroid = turf.centroid(feature);
  const barrios = {};
  let count = 0;

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

  useEffect(() => {
    const initializeMap = async () => {
      const mapInstance = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [-58.45, -34.61],
        zoom: 12,
      });

      setMap(mapInstance);

      const [manzanasRes, responsesRes, cleanedBarriosRes] = await Promise.all([
        fetch('/data/merged-manzanas.geojson'),
        fetch('/data/responses.geojson'),
        fetch('/data/cleanedBarrios.json'),
      ]);

      const manzanasGeo = await manzanasRes.json();
      const responsesGeo = await responsesRes.json();
      const cleanedBarrios = new Set(await cleanedBarriosRes.json());

      if (debug) {
        const bbox = turf.bboxPolygon([-58.53, -34.58, -58.35, -34.54]);
        manzanasGeo.features = manzanasGeo.features.filter(f => turf.booleanIntersects(f, bbox));
      }

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
          centroid.properties = { barrio: slug };
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

      mapInstance.addLayer({
        id: 'manzanas-fill',
        type: 'fill',
        source: 'manzanas',
        paint: {
          'fill-color': ['get', 'blendedColor'],
          'fill-opacity': 1,
        },
      });

      mapInstance.addLayer({
        id: 'hover-outline',
        type: 'line',
        source: 'manzanas',
        paint: {
          'line-color': '#ffffff',
          'line-width': 2,
        },
        filter: ['==', 'id', -1],
      });

      mapInstance.addLayer({
        id: 'pin-points-layer',
        type: 'circle',
        source: 'pin-points',
        paint: {
          'circle-radius': 4,
          'circle-color': '#00ffff',
          'circle-opacity': 0.7,
        },
      });

      mapInstance.addLayer({
        id: 'barrio-label-layer',
        type: 'symbol',
        source: 'barrio-labels',
        layout: {
          'text-field': ['get', 'barrio'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10, 14, 16],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-anchor': 'center',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#000000',
          'text-halo-width': 1.5,
        },
      });

      const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false });

      mapInstance.on('mousemove', 'manzanas-fill', (e) => {
        mapInstance.getCanvas().style.cursor = e.features?.length ? 'pointer' : '';
        const feature = e.features?.[0];
        if (!feature) return;

        const id = feature.properties.id;
        mapInstance.setFilter('hover-outline', ['==', 'id', id]);

        const props = feature.properties;
        const barriosRaw = props.barrios || {};
        const barrios = typeof barriosRaw === 'string'
          ? JSON.parse(barriosRaw)
          : barriosRaw;

        const total = Object.values(barrios)
          .map(w => Number(w))
          .filter(w => !isNaN(w))
          .reduce((sum, w) => sum + w, 0);

        let barrioList = '';
        if (total > 0) {
          barrioList = Object.entries(barrios)
            .map(([name, weight]) => {
              const w = Number(weight);
              const pct = total > 0 ? (w / total) * 100 : 0;
              const color = barrioColors[name] || '#ccc';
              return {
                name,
                percent: Math.round(pct),
                color,
              };
            })
            .filter(entry => isFinite(entry.percent) && entry.name)
            .sort((a, b) => b.percent - a.percent)
            .map(({ name, percent, color }) => {
              return `
                <div style="margin-bottom:8px;">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:600; color:${color}; font-size:14px;">${name}</span>
                    <span style="font-size:13px; color:${color};">${percent}%</span>
                  </div>
                  <div style="background:#eee; height:6px; border-radius:3px; overflow:hidden;">
                    <div style="background:${color}; width:${percent}%; height:6px;"></div>
                  </div>
                </div>
              `;
            })
            .join('');
        } else {
          barrioList = '<div style="font-style: italic;">Sin datos para esta manzana</div>';
        }

        popup
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="background:white; color:black; padding:12px 16px; border-radius:6px; font-family:sans-serif; width:175px; box-shadow: 0 0 5px rgba(0,0,0,0.25);">
              <div style="font-size:13px; font-weight:700; text-transform:uppercase; margin-bottom:10px; color:#666;">¿A qué barrio pertenece?</div>
              ${barrioList}
            </div>
          `)
          .addTo(mapInstance);
      });

      mapInstance.on('mouseleave', 'manzanas-fill', () => {
        mapInstance.setFilter('hover-outline', ['==', 'id', -1]);
        mapInstance.getCanvas().style.cursor = '';
        popup.remove();
      });
    };

    initializeMap();
  }, []);

  return <div id="map" style={{ width: '100%', height: '100vh' }} />;
};

export default MapView;
