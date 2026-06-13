// Lookup tables for decoding Gen-3 (Ruby/Sapphire/Emerald) save data.
//
// NOTE on accuracy for Pokemon Emerald Imperium (an Emerald hack):
//  - Met-LOCATION indices use the vanilla Hoenn map, which the hack keeps, so these names
//    should be accurate.
//  - SPECIES indices 1-251 equal National Dex order (Gen 1-2) in the Gen-3 internal table and
//    are reliable. The hack remaps/extends indices >= 252 (Gen 3-9 mons), so those fall back to
//    "#<id>" and can be corrected against real saves over time.

// --- Gen-3 Western character map (only the printable entries we need) ---
const CHARMAP = {
  0x00: ' ', 0xa1: '0', 0xa2: '1', 0xa3: '2', 0xa4: '3', 0xa5: '4', 0xa6: '5', 0xa7: '6',
  0xa8: '7', 0xa9: '8', 0xaa: '9', 0xab: '!', 0xac: '?', 0xad: '.', 0xae: '-',
  0xb0: '…', 0xb1: '“', 0xb2: '”', 0xb3: '‘', 0xb4: '’', 0xb5: '♂', 0xb6: '♀',
  0xba: '/', 0xbb: 'A', 0xbc: 'B', 0xbd: 'C', 0xbe: 'D', 0xbf: 'E', 0xc0: 'F', 0xc1: 'G',
  0xc2: 'H', 0xc3: 'I', 0xc4: 'J', 0xc5: 'K', 0xc6: 'L', 0xc7: 'M', 0xc8: 'N', 0xc9: 'O',
  0xca: 'P', 0xcb: 'Q', 0xcc: 'R', 0xcd: 'S', 0xce: 'T', 0xcf: 'U', 0xd0: 'V', 0xd1: 'W',
  0xd2: 'X', 0xd3: 'Y', 0xd4: 'Z', 0xd5: 'a', 0xd6: 'b', 0xd7: 'c', 0xd8: 'd', 0xd9: 'e',
  0xda: 'f', 0xdb: 'g', 0xdc: 'h', 0xdd: 'i', 0xde: 'j', 0xdf: 'k', 0xe0: 'l', 0xe1: 'm',
  0xe2: 'n', 0xe3: 'o', 0xe4: 'p', 0xe5: 'q', 0xe6: 'r', 0xe7: 's', 0xe8: 't', 0xe9: 'u',
  0xea: 'v', 0xeb: 'w', 0xec: 'x', 0xed: 'y', 0xee: 'z', 0x2d: '&',
};
export function decodeGen3Text(bytes) {
  let s = '';
  for (const b of bytes) {
    if (b === 0xff) break; // terminator
    s += CHARMAP[b] ?? '';
  }
  return s;
}

// --- Hoenn met-location names (vanilla RSE map indices) ---
export const MET_LOCATIONS = {
  0: 'Littleroot Town', 1: 'Oldale Town', 2: 'Dewford Town', 3: 'Lavaridge Town',
  4: 'Fallarbor Town', 5: 'Verdanturf Town', 6: 'Pacifidlog Town', 7: 'Petalburg City',
  8: 'Slateport City', 9: 'Mauville City', 10: 'Rustboro City', 11: 'Fortree City',
  12: 'Lilycove City', 13: 'Mossdeep City', 14: 'Sootopolis City', 15: 'Ever Grande City',
  16: 'Route 101', 17: 'Route 102', 18: 'Route 103', 19: 'Route 104', 20: 'Route 105',
  21: 'Route 106', 22: 'Route 107', 23: 'Route 108', 24: 'Route 109', 25: 'Route 110',
  26: 'Route 111', 27: 'Route 112', 28: 'Route 113', 29: 'Route 114', 30: 'Route 115',
  31: 'Route 116', 32: 'Route 117', 33: 'Route 118', 34: 'Route 119', 35: 'Route 120',
  36: 'Route 121', 37: 'Route 122', 38: 'Route 123', 39: 'Route 124', 40: 'Route 125',
  41: 'Route 126', 42: 'Route 127', 43: 'Route 128', 44: 'Route 129', 45: 'Route 130',
  46: 'Route 131', 47: 'Route 132', 48: 'Route 133', 49: 'Route 134',
  50: 'Underwater (Route 124)', 51: 'Underwater (Route 126)', 52: 'Underwater (Route 127)',
  53: 'Underwater (Route 128)', 54: 'Underwater (Sootopolis)', 55: 'Granite Cave',
  56: 'Mt. Chimney', 57: 'Safari Zone', 58: 'Battle Tower', 59: 'Petalburg Woods',
  60: 'Rusturf Tunnel', 61: 'Abandoned Ship', 62: 'New Mauville', 63: 'Meteor Falls',
  64: 'Meteor Falls (2)', 65: 'Mt. Pyre', 66: 'Aqua Hideout', 67: 'Aqua Hideout (Old)',
  68: 'Magma Hideout', 69: 'Mirage Tower', 70: 'Cave of Origin', 71: "Southern Island",
  72: 'Fiery Path', 73: 'Fiery Path (2)', 74: 'Jagged Pass', 75: 'Jagged Pass (2)',
  76: 'Sealed Chamber', 77: 'Underwater (Sealed Chamber)', 78: 'Scorched Slab',
  79: 'Island Cave', 80: 'Desert Ruins', 81: 'Ancient Tomb', 82: 'Inside of Truck',
  83: 'Sky Pillar', 84: 'Secret Base', 85: 'Ferry', 86: 'Pokemon League',
  87: 'Seafloor Cavern', 88: 'Shoal Cave', 89: 'Victory Road',
  253: 'Gift / Egg / Fateful', 255: 'Unknown',
};
export const metLocationName = (i) => MET_LOCATIONS[i] ?? `Location #${i}`;

// --- Species names + base stats, extracted from the Imperium ROM (src/data/species.js) ---
import { SPECIES } from '../data/species.js';

export function speciesName(id) {
  if (id === 0) return '(none)';
  return SPECIES[id]?.n || `#${id}`;
}
export const speciesStats = (id) => SPECIES[id]?.s || null;
