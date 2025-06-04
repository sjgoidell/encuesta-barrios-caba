import React, { useEffect, useState } from 'react';

// Utility: normalize barrio name
const normalizeBarrio = (str) =>
  str
    .toLowerCase()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Strip accents
    .replace(/\s+/g, ''); // Remove all spaces

const QueriedDB = () => {
  const [counts, setCounts] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/data/responses.geojson');
        const data = await res.json();

        const barrioCounts = {};

        data.features.forEach((feature) => {
          const rawBarrio = feature.properties.barrio || 'desconocido';
          const barrio = normalizeBarrio(rawBarrio);

          // Filter out names 4 characters or shorter
          if (barrio.length <= 4) return;

          barrioCounts[barrio] = (barrioCounts[barrio] || 0) + 1;
        });

        // Sort by count descending
        const sorted = Object.fromEntries(
          Object.entries(barrioCounts).sort((a, b) => b[1] - a[1])
        );

        setCounts(sorted);
      } catch (err) {
        console.error('Failed to load responses.geojson:', err);
      }
    };

    fetchData();
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h2>Frecuencia de barrios (normalizados)</h2>
      <table style={{ borderCollapse: 'collapse', marginTop: '1rem' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', paddingRight: '1rem' }}>Barrio</th>
            <th style={{ textAlign: 'right' }}>Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(counts).map(([barrio, count]) => (
            <tr key={barrio}>
              <td style={{ paddingRight: '1rem' }}>{barrio}</td>
              <td style={{ textAlign: 'right' }}>{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default QueriedDB;
