import assert from "node:assert/strict";
import { createWorld, CIVIC, ZONE, TERRAIN, jobsOf } from "../js/sim/world.js";
import { apply, costOf, undo, replay } from "../js/sim/ops.js";
import { tick, refreshLast } from "../js/sim/tick.js";
import { computeFields } from "../js/sim/fields.js";
import { save, load, stateHash } from "../js/sim/save.js";
import { computeInfrastructure, progressionTick, sanitationTick, farmYield, floodplain, lockedReason } from "../js/sim/progression.js";
import { yearlyFigures } from "../js/sim/budget.js";
import { citizenDefaults } from "../js/sim/citizens.js";
import { TOOLS } from "../js/tools.js";

// Controlled terrain exercises exact boundaries without depending on a seed's
// river bends. The separate founding simulation below uses generated terrain.
function fixture() {
  const w = createWorld({ seed: "campaign", campaign: true });
  w.terrain.fill(TERRAIN.GRASS); w.road.fill(0);
  for (let y = 0; y < w.h; y++) w.terrain[y * w.w + 10] = TERRAIN.WATER;
  w.roadsDirty = true;
  apply(w, { kind: "road", tiles: Array.from({ length: 60 }, (_, y) => y * w.w + 14) });
  computeFields(w);
  return w;
}
const w = fixture();
const before = stateHash(w);
assert.match(costOf(w, {kind:"police",tx:15,ty:3}).reason, /Chapter 2/);
assert.equal(apply(w,{kind:"zone",zone:ZONE.C,density:1,x0:15,y0:0,x1:18,y1:0}).ok,false);
assert.equal(apply(w,{kind:"zone",zone:ZONE.R,density:3,x0:15,y0:0,x1:18,y1:0}).ok,false);
assert.equal(stateHash(w),before,"refused tools mutate nothing");
assert.match(costOf(w,{kind:"farm",tx:30,ty:30}).reason,/floodplain/);
w.terrain[30*w.w+30] = TERRAIN.WATER;
assert.equal(floodplain(w)[30*w.w+29],0,"an isolated pond does not qualify");
for(let y=2;y<=11;y+=3) assert.equal(apply(w,{kind:"farm",tx:12,ty:y}).ok,true);
assert.equal(w.infrastructure.food,100,"construction refreshes food immediately");
assert.equal(computeInfrastructure(w).food,100);
assert.equal(yearlyFigures(w).farms,4);
const farm = 2*w.w+12;
w.flooded[farm]=1;
assert.equal(computeInfrastructure(w).food,75,"flooded farms stop supplying food");
w.flooded[farm]=0;
const demolition=apply(w,{kind:"bulldoze",x0:12,y0:2,x1:12,y1:2});
assert.equal(demolition.ok,true); assert.equal(computeInfrastructure(w).food,75);
assert.equal(undo(w).ok,true); assert.equal(w.infrastructure.food,100,"undo refreshes food immediately");

// Transition fixtures use lightweight citizens; they never enter citizen AI.
w.citizens=Array.from({length:100},(_,id)=>({id,home:15*w.w+15}));
assert.equal(progressionTick(w).length,0);
w.citizens.pop(); progressionTick(w); assert.equal(w.flags.campaign.stable,0);
w.citizens.push({id:99,home:15*w.w+15});
progressionTick(w); progressionTick(w);
assert.match(progressionTick(w)[0],/CHAPTER 2/);
assert.equal(farmYield(w),50); assert.equal(computeInfrastructure(w).food,200);
w.citizens=[]; progressionTick(w); assert.equal(w.flags.campaign.chapter,1,"unlocks never regress");
assert.equal(lockedReason(w,{kind:"cemetery"}),"");
assert.equal(lockedReason(w,{kind:"interview"}),"");
assert.equal(lockedReason(w,{kind:"collect"}),"");
for (let stage=0;stage<5;stage++) {
  w.flags.campaign.chapter=stage;
  assert.equal(farmYield(w),[25,50,100,200,400][stage]);
  for(const t of TOOLS) {
    const reason=lockedReason(w,{...t.op,density:1});
    if(stage===4) assert.equal(reason,"",t.id);
  }
}
assert.equal(new Set(TOOLS.map(t=>t.key)).size,TOOLS.length);
assert.equal(TOOLS.some(t=>["W","A","S","D"].includes(t.key)),false,"build keys preserve WASD");

for (const [stage, population] of [[1,500],[2,1500]]) {
  const town=fixture(); town.flags.campaign.chapter=stage;
  for(let y=0;y<45;y+=3) assert.equal(apply(town,{kind:"farm",tx:12,ty:y}).ok,true);
  town.citizens=Array.from({length:population},(_,id)=>({id,home:20*town.w+19}));
  for(let i=0;i<3;i++) progressionTick(town);
  assert.equal(town.flags.campaign.chapter,stage+1,`chapter ${stage+1} completes`);
}

const sanitary=fixture(); sanitary.flags.campaign.chapter=3;
for(const [kind,ty] of [["sanitation",17],["garbage",21],["cemetery",25]]) assert.equal(apply(sanitary,{kind,tx:15,ty}).ok,true,kind);
sanitary.citizens=Array.from({length:500},(_,id)=>({...citizenDefaults(),id,species:"rabbit",born:0,home:20*sanitary.w+19}));
computeFields(sanitary);
assert.equal(computeInfrastructure(sanitary).sanitationShare,1);
assert.equal(computeInfrastructure(sanitary).garbageShare,1);
sanitary.flags.campaign.waste=1000; sanitary.flags.campaign.sewage=1000;
sanitationTick(sanitary); assert.equal(sanitary.flags.campaign.waste,1000,"grace period");
sanitary.tick=6;
sanitationTick(sanitary); assert.equal(sanitary.flags.campaign.waste,750,"spare capacity clears backlog");
sanitary.road.fill(0); sanitary.roadsDirty=true; computeFields(sanitary);
sanitationTick(sanitary); assert.equal(sanitary.flags.campaign.waste,1250,"disconnected services stop collection");
assert.equal(computeInfrastructure(sanitary).garbageShare,0);
assert.equal(sanitary.civic[25*sanitary.w+15],CIVIC.CEMETERY);
// Final gate: population and food alone cannot bypass sanitation.
const final=fixture(); final.flags.campaign.chapter=3;
for(let y=0;y<45;y+=3) assert.equal(apply(final,{kind:"farm",tx:12,ty:y}).ok,true);
final.citizens=Array.from({length:3000},(_,id)=>({...citizenDefaults(),id,species:"rabbit",born:0,home:20*final.w+19}));
for(let i=0;i<4;i++) progressionTick(final);
assert.equal(final.flags.campaign.chapter,3);
for(let k=0;k<4;k++) {
  assert.equal(apply(final,{kind:"sanitation",tx:15,ty:12+k*3}).ok,true);
  assert.equal(apply(final,{kind:"garbage",tx:15,ty:25+k*2}).ok,true);
}
assert.equal(computeInfrastructure(final).garbageShare,1);
for(let i=0;i<3;i++) progressionTick(final);
assert.equal(final.flags.campaign.chapter,4);

// A real generated settlement: connect farms, zone cottages, then let the
// actual demand, employment, births, deaths and campaign run without cheats.
function found(seed) {
 const city=createWorld({seed,campaign:true,w:40,h:40});
 apply(city,{kind:"toggle",key:"noDisasters",value:true});
 const fertile=floodplain(city);
 let farms=0;
 for(let y=3;y<city.h-4 && farms<4;y++) for(let x=3;x<city.w-4 && farms<4;x++) {
   const i=y*city.w+x;
   if(!fertile[i] || city.civic[i]) continue;
   // Farm stays on the river side; road and homes grow on its other side.
   if([i,i+1,i+city.w,i+city.w+1,i+2,i+city.w+2].some(j=>city.terrain[j]===TERRAIN.WATER||city.civic[j])) continue;
   apply(city,{kind:"road",tiles:[i+2,i+city.w+2]});
   if(apply(city,{kind:"farm",tx:x,ty:y}).ok) farms++;
 }
 assert.equal(farms,4,`river supports founding farms: ${seed}`);
 // Road grid supplies reachable housing and employment on both banks.
 for(let y=4;y<city.h-3;y+=5) apply(city,{kind:"road",tiles:Array.from({length:city.w-4},(_,x)=>y*city.w+x+2)});
 for(let x=4;x<city.w-3;x+=5) apply(city,{kind:"road",tiles:Array.from({length:city.h-4},(_,y)=>(y+2)*city.w+x)});
 apply(city,{kind:"zone",zone:ZONE.R,density:1,x0:2,y0:2,x1:city.w-3,y1:city.h-3});
 return city;
}
for(const seed of ["river-story","7"]) {
 const city=found(seed);
 for(let i=0;i<180 && city.flags.campaign.chapter===0;i++) tick(city);
 console.log(`${seed}: chapter ${city.flags.campaign.chapter+1}, ${city.citizens.length} villagers, month ${city.tick}, cash ${Math.round(city.cash)}`);
 assert.ok(city.flags.campaign.chapter>=1,"starting tools can complete Chapter 1");
 const copy=load(save(city)); assert.equal(stateHash(copy),stateHash(city));
 for(let i=0;i<12;i++){tick(city);tick(copy);}
 assert.equal(stateHash(copy),stateHash(city),"campaign save/load continues identically");
 const played=createWorld({seed,campaign:true,w:40,h:40});
 for(let t=0;t<city.tick;t++) {
   for(const op of city.log.filter(e=>e.t===t)) replay(played,op);
   tick(played);
 }
 assert.equal(stateHash(played),stateHash(city),"campaign input replay is deterministic");
}
const legacy=createWorld({seed:"old-save"});
const mess=fixture(); mess.flags.campaign.chapter=3;
assert.equal(apply(mess,{kind:"sanitation",tx:15,ty:17}).ok,true);
mess.citizens=Array.from({length:8},(_,id)=>({...citizenDefaults(),id,species:"pig",born:0,home:20*mess.w+19}));
computeFields(mess);
const treatedPollution=mess.pol.reduce((sum,n)=>sum+n,0);
assert.equal(apply(mess,{kind:"bulldoze",x0:15,y0:17,x1:15,y1:17}).ok,true);
computeFields(mess);
assert.ok(mess.pol.reduce((sum,n)=>sum+n,0)>treatedPollution,"sanitation measurably cuts household mess emissions");
assert.equal(load(save(legacy)).flags.campaign,undefined);
assert.equal(lockedReason(legacy,{kind:"university"}),"");
const late=createWorld({seed:"late-save",campaign:true});
late.tick=10; late.flags.campaign={chapter:3,stable:1,entered:4,waste:60,sewage:40};
const lateCopy=load(save(late));
assert.deepEqual(lateCopy.flags.campaign,late.flags.campaign);
for(let i=0;i<12;i++){tick(late);tick(lateCopy);}
assert.equal(stateHash(late),stateHash(lateCopy),"waste and grace state survive continuation");
const invalid=JSON.parse(save(late)); invalid.flags.campaign.chapter=9;
assert.throws(()=>load(JSON.stringify(invalid)),/Invalid campaign state/);
const graveyard=fixture(); graveyard.flags.campaign.chapter=1;
assert.equal(apply(graveyard,{kind:"cemetery",tx:40,ty:40}).ok,true,"cemetery needs no road");
assert.equal(jobsOf(graveyard,40*graveyard.w+40),0,"cemeteries have no workers");
const {legacyCode}=await import("../js/sim/legacy.js");
graveyard.legacy.push(legacyCode({...citizenDefaults(),id:90,name:"Ada",surname:"River",species:"rabbit",born:-240,home:1,household:1},"died",0));
refreshLast(graveyard);
const {installDom,stubApp}=await import("./dom-shim.mjs");
const doc=installDom();
const {createUI}=await import("../js/ui.js");
const ui=createUI(stubApp(graveyard));
ui.updateHover({tile:40*graveyard.w+40,pinned:true});
const card=doc.getElementById("card");
assert.match(card.textContent,/Ada River/);
const search=card.querySelector("input");
search.value="nobody"; search.dispatch("input");
assert.match(card.textContent,/No matching records/);
search.value="rabbit"; search.dispatch("input");
assert.match(card.textContent,/Ada River/,"memorial search reads the permanent archive");
console.log("Campaign checks passed: gates, farming, floods, services, memorial, progression, founding, save/load and replay.");
