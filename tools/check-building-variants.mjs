import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {roster,cityPanel} from './review-building-variants.mjs';
import {art} from '../js/art/index.js';
import {RECIPES} from '../js/art/solid.js';
import {rasterize} from '../js/art/format.js';
const all=roster();let count=0;
for(const f of all){
  const expected=f.group==='zoned'?6:f.group==='civics'?3:f.group==='stations'?2:4;
  assert.equal(f.entries.length,expected,`${f.key} family count`);
  const rows=new Set();
  for(const e of f.entries){
    const s=e.sprite;assert.ok(e.reachableBytes.length,`${s.name} unreachable through registry`);
    assert.deepEqual(s.footprint,[f.side,f.side],`${s.name} footprint`);
    assert.equal(f.select(e.byte),s,`${s.name} deterministic selection`);
    const key=s.rows.join('\n');assert.ok(!rows.has(key),`${s.name} duplicate pixels within family`);rows.add(key);
    for(const scale of [1,2,4]){const sp=scale===1?s:art.hires(s,scale);assert.ok(sp,`${s.name} missing ${scale}x`);rasterize(sp.rows);}
    const r=RECIPES.get(s);assert.ok(r?.boxes,`${s.name} missing authored solid recipe`);
    for(const b of r.boxes)assert.ok(b.a0>=0&&b.b0>=0&&b.c0>=0&&b.a1<=16*f.side&&b.b1<=16*f.side,`${s.name} box outside footprint`);
    count++;
  }
}
const forbiddenRandom=Math.random;Math.random=()=>{throw Error('render requested nondeterministic randomness');};
try {const selection=all.filter(f=>['zoned','blocks','landmarks','mansion','civics','stations'].includes(f.group)).filter((f,i,a)=>a.findIndex(g=>g.group===f.group)===i).map(f=>({family:f,entry:f.entries.at(-1)}));const panel=cityPanel(selection);assert.equal(panel.before,panel.after,'render must preserve saved state');}finally{Math.random=forbiddenRandom;}
for(const file of ['building-plans.js','civic-variations.js'])assert.doesNotMatch(readFileSync(new URL(`../js/art/${file}`,import.meta.url),'utf8'),/Math\.random\s*\(/,`${file} cannot use random draws`);
console.log(`Building variants: ${all.length} families, ${count} sprites, reachable/unique/footprint/palette/detail/render checks passed.`);
