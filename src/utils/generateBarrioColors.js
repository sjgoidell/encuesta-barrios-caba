// Generate deterministic color palette
const palette = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728',
  '#9467bd', '#8c564b', '#e377c2', '#7f7f7f',
  '#bcbd22', '#17becf', '#aec7e8', '#ffbb78',
  '#98df8a', '#ff9896', '#c5b0d5', '#c49c94',
];

export function generateBarrioColors(normalizedBarrios) {
  const colors = {};
  let i = 0;
  normalizedBarrios.forEach((barrio) => {
    if (!colors[barrio]) {
      colors[barrio] = palette[i % palette.length];
      i++;
    }
  });
  return colors;
}