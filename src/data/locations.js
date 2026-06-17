// Canonical ordered list of places you can obtain a Pokemon in Pokemon Emerald Imperium
// (Hoenn progression order). In a randomized run the *species* at each spot change every
// playthrough, but the list of spots is stable — this is the backbone of the soul-link board.
//
// type: route | town | cave | water | gift | egg | fossil | legendary | static
// Gift/egg/legendary entries were sourced from the official Imperium documentation.

export const LOCATIONS = [
  { id: 'starter', name: 'Starter', type: 'static', note: 'Your chosen starter' },
  { id: 'route-101', name: 'Route 101', type: 'route' },
  { id: 'route-103', name: 'Route 103', type: 'route' },
  { id: 'route-102', name: 'Route 102', type: 'route' },
  { id: 'petalburg-city', name: 'Petalburg City', type: 'city', note: 'Fishing / Surf pond' },
  { id: 'petalburg-woods', name: 'Petalburg Woods', type: 'route' },
  { id: 'route-104', name: 'Route 104', type: 'route' },
  { id: 'rustboro-togepi-egg', name: 'Rustboro City — Togepi Egg', type: 'egg', note: 'In the Pokemon Center' },
  { id: 'route-116', name: 'Route 116', type: 'route' },
  { id: 'rusturf-tunnel', name: 'Rusturf Tunnel', type: 'cave' },
  { id: 'route-105', name: 'Route 105', type: 'water' },
  { id: 'route-106', name: 'Route 106', type: 'water' },
  { id: 'dewford-town', name: 'Dewford Town', type: 'city', note: 'Fishing / Surf' },
  { id: 'granite-cave', name: 'Granite Cave', type: 'cave' },
  { id: 'route-107', name: 'Route 107', type: 'water' },
  { id: 'route-108', name: 'Route 108', type: 'water' },
  { id: 'abandoned-ship', name: 'Abandoned Ship', type: 'cave', note: 'On Route 108 — interior & fishing' },
  { id: 'route-109', name: 'Route 109', type: 'water' },
  { id: 'route-109-charcadet', name: 'Route 109 — Charcadet (gift)', type: 'gift', note: 'After beating all trainers in the beach house' },
  { id: 'slateport-city', name: 'Slateport City', type: 'city', note: 'Fishing / Surf (beach)' },
  { id: 'route-110', name: 'Route 110', type: 'route' },
  { id: 'new-mauville', name: 'New Mauville', type: 'cave', note: 'Electric-type den (off Route 110)' },
  { id: 'route-117', name: 'Route 117', type: 'route' },
  { id: 'route-111', name: 'Route 111', type: 'route' },
  { id: 'route-111-riolu-egg', name: 'Route 111 — Riolu Egg', type: 'egg', note: "In the old man's house" },
  { id: 'route-111-tyrogue', name: 'Route 111 — Tyrogue (gift)', type: 'gift', note: 'After beating Daisuke' },
  { id: 'route-112', name: 'Route 112', type: 'route' },
  { id: 'fiery-path', name: 'Fiery Path', type: 'cave' },
  { id: 'route-113', name: 'Route 113', type: 'route' },
  { id: 'fallarbor-starter-egg', name: 'Fallarbor Town — Starter Egg', type: 'egg', note: 'Old man inside house, for shards' },
  { id: 'route-114', name: 'Route 114', type: 'route' },
  { id: 'meteor-falls', name: 'Meteor Falls', type: 'cave' },
  { id: 'route-115', name: 'Route 115', type: 'route' },
  { id: 'jagged-pass', name: 'Jagged Pass', type: 'route' },
  { id: 'mt-chimney', name: 'Mt. Chimney', type: 'route' },
  { id: 'lavaridge-eevee-egg', name: 'Lavaridge Town — Eevee Egg', type: 'egg', note: 'Old woman by the hot springs' },
  { id: 'route-118', name: 'Route 118', type: 'route' },
  { id: 'route-119', name: 'Route 119', type: 'route' },
  { id: 'route-120', name: 'Route 120', type: 'route' },
  { id: 'route-121', name: 'Route 121', type: 'route' },
  { id: 'route-121-meltan', name: 'Route 121 — Meltan (gift)', type: 'gift', note: 'After beating Byron' },
  { id: 'safari-zone', name: 'Safari Zone', type: 'route' },
  { id: 'route-122', name: 'Route 122', type: 'water' },
  { id: 'mt-pyre', name: 'Mt. Pyre', type: 'cave', note: 'Exterior grass & interior floors' },
  { id: 'route-123', name: 'Route 123', type: 'route' },
  { id: 'lilycove-city', name: 'Lilycove City', type: 'city', note: 'Fishing / Surf' },
  { id: 'lilycove-typenull-egg', name: 'Lilycove City — Type: Null Egg', type: 'egg', note: 'Old man inside house' },
  { id: 'route-124', name: 'Route 124', type: 'water' },
  { id: 'route-125', name: 'Route 125', type: 'water' },
  { id: 'route-126', name: 'Route 126', type: 'water' },
  { id: 'route-127', name: 'Route 127', type: 'water' },
  { id: 'route-128', name: 'Route 128', type: 'water' },
  { id: 'mossdeep-city', name: 'Mossdeep City', type: 'city', note: 'Fishing / Surf' },
  { id: 'mossdeep-mew', name: 'Mossdeep City — Mew (gift)', type: 'gift', note: 'After beating Sunbird' },
  { id: 'mossdeep-darkrai', name: 'Mossdeep City — Darkrai (gift)', type: 'gift', note: 'After beating Suneal' },
  { id: 'shoal-cave', name: 'Shoal Cave', type: 'cave' },
  { id: 'route-129', name: 'Route 129', type: 'water' },
  { id: 'route-130', name: 'Route 130', type: 'water' },
  { id: 'route-131', name: 'Route 131', type: 'water' },
  { id: 'pacifidlog-town', name: 'Pacifidlog Town', type: 'city', note: 'Fishing / Surf' },
  { id: 'seafloor-cavern', name: 'Seafloor Cavern', type: 'cave' },
  { id: 'sootopolis-city', name: 'Sootopolis City', type: 'city', note: 'Fishing / Surf (after Dive)' },
  { id: 'cave-of-origin', name: 'Cave of Origin', type: 'cave' },
  { id: 'route-132', name: 'Route 132', type: 'water' },
  { id: 'route-133', name: 'Route 133', type: 'water' },
  { id: 'route-134', name: 'Route 134', type: 'water' },
  { id: 'sky-pillar', name: 'Sky Pillar', type: 'cave' },
  { id: 'victory-road', name: 'Victory Road', type: 'cave' },
  { id: 'evergrande-kubfu', name: 'Ever Grande City — Kubfu (gift)', type: 'gift', note: 'After beating Dawn and Rival' },
  { id: 'evergrande-zeraora', name: 'Ever Grande City — Zeraora (gift)', type: 'gift', note: 'After beating Volkner' },
];

// Fallarbor sells unlimited starter eggs; runs typically register 3–9. Expand that single
// row into `eggCount` rows. The first keeps its original id so existing catches stay linked;
// extras get `-2`, `-3`, … The board and save-import build their location list through this.
const FALLARBOR_EGG_ID = 'fallarbor-starter-egg';
export function buildLocations(eggCount = 6) {
  const n = Math.max(1, Math.min(24, eggCount | 0));
  const out = [];
  for (const loc of LOCATIONS) {
    if (loc.id !== FALLARBOR_EGG_ID) { out.push(loc); continue; }
    for (let i = 1; i <= n; i++) {
      out.push(i === 1
        ? { ...loc, name: n > 1 ? `${loc.name} #1` : loc.name }
        : { ...loc, id: `${FALLARBOR_EGG_ID}-${i}`, name: `${loc.name} #${i}` });
    }
  }
  return out;
}

export const LOCATION_TYPES = {
  route: { label: 'Route', color: '#6b9e4f' },
  town: { label: 'Town', color: '#9e8b4f' },
  city: { label: 'City', color: '#4f9e9e' },
  cave: { label: 'Cave', color: '#8a6f4f' },
  water: { label: 'Surf/Fish', color: '#4f7d9e' },
  gift: { label: 'Gift', color: '#c0567a' },
  egg: { label: 'Egg', color: '#c79b3b' },
  fossil: { label: 'Fossil', color: '#7a7a7a' },
  legendary: { label: 'Legendary', color: '#8e5bc0' },
  static: { label: 'Starter', color: '#4f9e8a' },
  reward: { label: 'Reward', color: '#c79b3b' }, // manually-added reward pairs (not a game location)
};
