// Display helpers for boss weather + stats, shared by the guide and detail pages.
export const WEATHER_ICON = {
  Sun: '☀️', 'Harsh Sun': '🔆', Rain: '🌧️', 'Heavy Rain': '⛈️',
  Sandstorm: '🏜️', Snow: '❄️',
};

export const STAT_LABELS = ['HP', 'Atk', 'Def', 'Spe', 'SpA', 'SpD'];
export const statColor = (v) =>
  v >= 130 ? '#3fae6a' : v >= 100 ? '#7bbf57' : v >= 70 ? '#c79b3b' : '#c0444a';
export const bst = (s) => (s ? s.reduce((a, b) => a + b, 0) : 0);
