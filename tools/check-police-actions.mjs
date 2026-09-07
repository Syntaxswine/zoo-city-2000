import assert from "node:assert/strict";
import { createWorld, ZONE, CIVIC } from "../js/sim/world.js";
import { apply, replay, undo } from "../js/sim/ops.js";
import { createHousehold, placeHousehold } from "../js/sim/citizens.js";
import { refreshLast, tick } from "../js/sim/tick.js";
import { openFile, sentenceFor, custodyTick } from "../js/sim/justice.js";
import { hasPolice, collectionSentence, policeActionPlan } from "../js/sim/police-actions.js";
import { save, load, stateHash } from "../js/sim/save.js";
import { KNOBS } from "../js/sim/rules.js";

function fixture() {
  const w = createWorld({ seed: "police-actions", w: 32, h: 32 });
  for (const key of ["terrain", "road", "rail", "zone", "tier", "civic", "civicSize", "wall", "big", "rubble", "burning", "flooded"]) w[key].fill(0);
  const at = (x,y) => y*w.w+x;
  for (let x=2;x<=22;x++) w.road[at(x,9)]=1;
  const home=at(5,8), police=at(3,10), centre=at(8,10), zoo=at(13,10), hall=at(18,8);
  w.zone[home]=ZONE.R; w.tier[home]=3;
  w.civic[police]=CIVIC.POLICE; w.civic[centre]=CIVIC.CENTRE; w.civic[zoo]=CIVIC.ZOO;
  w.zone[hall]=ZONE.M; w.tier[hall]=1;
  const hh=createHousehold(w,"rabbit",2); placeHousehold(w,hh,home);
  w.roadsDirty=true; w.wallsDirty=true; refreshLast(w);
  return {w,c:w.byId.get(hh.members[0]),home,police,centre,zoo,hall};
}
function draws(w, values) {
  const next=w.rng.next;
  w.rng.next=()=> { assert.ok(values.length,"unexpected RNG draw"); return values.shift(); };
  return ()=> { assert.equal(values.length,0,"missing RNG draw"); w.rng.next=next; };
}
const distribution={zoo:{},centre:{},hall:{}};
for(const normal of Object.keys(distribution)) for(let i=0;i<1000;i++) {
  const s=collectionSentence(normal,(i+.5)/1000); distribution[normal][s]=(distribution[normal][s]||0)+1;
}
assert.deepEqual(distribution,{zoo:{zoo:700,centre:200,hall:100},centre:{centre:600,hall:300,zoo:100},hall:{hall:900,centre:100}});
{
  const {w,c,police}=fixture(); w.civic[police]=0;
  assert.equal(hasPolice(w),false);
  const hash=stateHash(w), rng=w.rng.state;
  assert.equal(apply(w,{kind:"collect",citizenId:c.id}).ok,false);
  assert.equal(stateHash(w),hash); assert.equal(w.rng.state,rng);
  w.civic[police]=CIVIC.POLICE; w.burning[police]=1;
  assert.match(policeActionPlan(w,{kind:"interview",citizenId:c.id}).reason,/operational/);
  w.burning[police]=0;
  assert.equal(apply(w,{kind:"collect",citizenId:999999}).ok,false);
}
{
  const {w,c}=fixture(); c.record=3;
  const restore=draws(w,[0.05]);
  assert.equal(apply(w,{kind:"interview",citizenId:c.id}).collected,false); restore();
  assert.equal(c.record,3); assert.equal(c.held,0);
  const hash=stateHash(w);
  assert.equal(apply(w,{kind:"interview",citizenId:c.id}).ok,false);
  assert.equal(stateHash(w),hash);
  for(let i=0;i<220;i++) w.events.log.push({t:w.tick,id:"test",line:"noise"});
  const restored=load(save(w));
  assert.equal(apply(restored,{kind:"interview",citizenId:c.id}).ok,false,"cooldown survives news truncation and save/load");
}
{
  const {w,c,zoo}=fixture(); const restore=draws(w,[0.049,0.1]);
  assert.equal(apply(w,{kind:"interview",citizenId:c.id}).collected,true); restore();
  assert.equal(c.wrongful,true); assert.equal(c.heldAt,zoo); assert.equal(w.events.justice.wrongful,1);
  assert.equal(w.events.files.length,0,"wrongful interview does not fabricate a real culprit");
  assert.equal(undo(w).ok,false);
  assert.equal(apply(w,{kind:"collect",citizenId:c.id}).ok,false,"no collecting someone already held");
}
{
  const {w,c,home,centre}=fixture();
  const f=openFile(w,{tile:home,culpritId:c.id,cause:"killing"});
  const restore=draws(w,[0.899,0.1]);
  assert.equal(apply(w,{kind:"interview",citizenId:c.id}).collected,true); restore();
  assert.equal(c.heldAt,centre); assert.equal(f.closed,true); assert.equal(c.wrongful,false);
  w.tick=c.held; custodyTick(w,[]); assert.equal(c.fixed,true,"centre completes pacification");
}
{
  const {w,c,home}=fixture(); openFile(w,{tile:home,culpritId:c.id,cause:"burglary"});
  const restore=draws(w,[0.9]); assert.equal(apply(w,{kind:"interview",citizenId:c.id}).collected,false); restore();
}
for(const [roll,destination] of [[.1,"zoo"],[.7,"centre"],[.85,"zoo"],[.95,"hall"]]) {
  const f=fixture(), {w,c}=f, cash=w.cash;
  const restore=draws(w,[roll]); assert.equal(apply(w,{kind:"collect",citizenId:c.id}).collected,true); restore();
  if(destination==="hall") {
    assert.equal(w.byId.has(c.id),false); assert.equal(w.citizens.some(x=>x.id===c.id),false);
    assert.equal(w.cash,cash+KNOBS.SOLD_PRICE); assert.equal(w.events.justice.sold,1);
  } else assert.equal(c.heldAt,f[destination]);
}
{
  const {w,c,home}=fixture(); c.thefts=1;
  const f=openFile(w,{tile:home,culpritId:c.id,cause:"burglary",victimClass:2});
  assert.equal(sentenceFor(w,f,c).sentence,"hall","existing affluent-victim escalation is retained");
}
{
  const {w,c,zoo}=fixture(); w.civic[zoo]=0; refreshLast(w);
  const restore=draws(w,[.1]); const res=apply(w,{kind:"collect",citizenId:c.id}); restore();
  assert.equal(res.collected,false); assert.equal(c.record,0); assert.equal(c.held,0);
  assert.match(res.notices.join(" "),/free bed/);
  assert.equal(apply(w,{kind:"collect",citizenId:c.id}).ok,false,"missing facilities do not allow same-month sentence rerolls");
}
{
  const {w,c,zoo}=fixture();
  const hh=createHousehold(w,"rabbit",KNOBS.ZOO_BEDS);
  for(const id of hh.members){const inmate=w.byId.get(id);inmate.heldAt=zoo;inmate.held=w.tick+10;}
  refreshLast(w);
  const restore=draws(w,[.1]); assert.equal(apply(w,{kind:"collect",citizenId:c.id}).collected,false); restore();
  assert.equal(c.record,0,"full jail cannot silently become a centre");
}
{
  const {w,c}=fixture(); const restored=load(save(w));
  const op={kind:"interview",citizenId:c.id};
  assert.equal(apply(w,op).ok,true); assert.equal(replay(restored,{t:w.tick,op}).ok,true);
  assert.equal(stateHash(w),stateHash(restored),"input replay preserves rolls and results");
  const continued=load(save(w));
  for(let i=0;i<12;i++){tick(w);tick(continued);}
  assert.equal(stateHash(w),stateHash(continued),"custody continuation survives save/load");
}
console.log("Police actions: gating, selection, innocence/guilt, weighted sentences, custody, capacity, cooldown, replay and save/load passed.");
