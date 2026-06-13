// Classifies abilities into filterable tags. Keyed by ability *name* (what we store on a catch).
// Two tag families requested: weather setters, and stat changers (Intimidate, the Ruin abilities, etc.).

// Weather-setting abilities -> the weather they summon (label matches bossMeta WEATHER_ICON where possible).
export const WEATHER_ABILITIES = {
  Drizzle: 'Rain', Drought: 'Sun', 'Sand Stream': 'Sandstorm', 'Snow Warning': 'Snow',
  'Primordial Sea': 'Heavy Rain', 'Desolate Land': 'Harsh Sun', 'Delta Stream': 'Strong Winds',
  'Orichalcum Pulse': 'Sun', 'Hadron Engine': 'Electric Terrain', 'Sand Spit': 'Sandstorm',
  'Snow Cloak': null, // not a setter — excluded by the null check below
};

// Abilities that raise or lower stats (on entry, on KO, reactively, or as a passive aura).
export const STAT_CHANGE_ABILITIES = new Set([
  'Intimidate', 'Download', 'Intrepid Sword', 'Dauntless Shield',
  'Sword of Ruin', 'Beads of Ruin', 'Tablets of Ruin', 'Vessel of Ruin',
  'Moxie', 'Beast Boost', 'Chilling Neigh', 'Grim Neigh', 'Soul-Heart',
  'Speed Boost', 'Protosynthesis', 'Quark Drive', 'Defiant', 'Competitive',
  'Justified', 'Berserk', 'Anger Point', 'Weak Armor', 'Steadfast', 'Rattled',
  'Cotton Down', 'Supreme Overlord', 'Anger Shell', 'Guard Dog', 'Costar',
  'Opportunist', 'Sharpness', 'Hadron Engine', 'Orichalcum Pulse',
]);

export function weatherOf(abilityName) {
  const w = WEATHER_ABILITIES[abilityName];
  return w || null;
}

export function abilityTags(abilityName) {
  if (!abilityName) return [];
  const tags = [];
  if (weatherOf(abilityName)) tags.push('weather');
  if (STAT_CHANGE_ABILITIES.has(abilityName)) tags.push('statChange');
  return tags;
}

export const TAG_LABELS = {
  weather: '🌦 Weather setters',
  statChange: '📊 Stat changers',
};
