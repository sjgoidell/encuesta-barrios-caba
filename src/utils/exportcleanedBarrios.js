// scripts/exportCleanedBarrios.js
import fs from 'fs';
import path from 'path';

const normalizeBarrio = (str) =>
  str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .trim();

const main = async () => {
  const raw = fs.readFileSync('./public/data/responses.geojson', 'utf-8');
  const data = JSON.parse(raw);

  const barrioCounts = {};

  data.features.forEach((feature) => {
    const rawBarrio = feature.properties.barrio || '';
    const barrio = normalizeBarrio(rawBarrio);
    if (barrio.length <= 4) return;
    barrioCounts[barrio] = (barrioCounts[barrio] || 0) + 1;
  });

  const sorted = Object.entries(barrioCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([barrio]) => barrio);

  const outputPath = path.resolve('./public/data/cleanedBarrios.json');
  fs.writeFileSync(outputPath, JSON.stringify(sorted, null, 2));
  console.log(`✅ Exported ${sorted.length} cleaned barrios to cleanedBarrios.json`);
};

main();
