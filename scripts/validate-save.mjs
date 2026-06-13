import { readFileSync } from 'node:fs';
import { parseSave } from '../src/lib/saveParser.js';
const savePath = process.argv[2] || 'C:/Users/parke/Pokemon Docs/Pokemon Imperium v1.1.sav';
const buf = readFileSync(savePath);
const data = parseSave(new Uint8Array(buf));
console.log(`PARTY (${data.party.length}):`);
for (const m of data.party)
  console.log(`  ${m.speciesName.padEnd(12)} sp#${String(m.species).padEnd(4)} "${m.nickname}" Lv${m.level} | caught Lv${m.metLevel} @ ${m.metLocationName} (#${m.metLocation})${m.shiny?' ✨':''}${m.isEgg?' [EGG]':''}`);
console.log(`\nBOXES (${data.boxes.length} total). First 25:`);
for (const m of data.boxes.slice(0,25))
  console.log(`  Box${m.box} ${m.speciesName.padEnd(12)} sp#${String(m.species).padEnd(4)} "${m.nickname}" | caught Lv${m.metLevel} @ ${m.metLocationName} (#${m.metLocation})${m.shiny?' ✨':''}${m.isEgg?' [EGG]':''}`);
// distribution of met locations
const locs = {};
for (const m of data.all) locs[m.metLocationName]=(locs[m.metLocationName]||0)+1;
console.log('\nMet-location distribution:', locs);
