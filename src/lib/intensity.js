const COLORS = {
  1: '#10b981',
  2: '#a3e635',
  3: '#dda85b',
  4: '#fb923c',
  5: '#ef4444',
};

const LABELS = {
  1: 'Light',
  2: 'Moderate',
  3: 'Medium',
  4: 'Intense',
  5: 'Very intense',
};

export function intensityColor(level) {
  const color = COLORS[level];
  if (!color) throw new RangeError(`intensity must be 1-5, got ${level}`);
  return color;
}

export function intensityLabel(level) {
  const label = LABELS[level];
  if (!label) throw new RangeError(`intensity must be 1-5, got ${level}`);
  return `Intensity ${level} — ${label}`;
}
