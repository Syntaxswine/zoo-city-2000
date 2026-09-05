import {createWorld,ZONE} from '../js/sim/world.js';
import {createHousehold,placeHousehold,startCamping,rehouseCampers,citizensTick,removeCitizen,evictFromLot} from '../js/sim/citizens.js';
import {computeFields} from '../js/sim/fields.js';
import {census} from '../js/sim/census.js';
import {apply,undo} from '../js/sim/ops.js';
import {campAt,addCamp} from '../js/sim/camps.js';
import {save,load,stateHash} from '../js/sim/save.js';
import {tick} from '../js/sim/tick.js';
function fixture() {
 const w=createWorld({seed:'camp-test',w:32,h:32});
 for(const k of ['terrain','road','rail','zone','tier','civic','civicSize','wall','big','rubble','burning','flooded'])w[k].fill(0);
 w.cash=100000; w.roadsDirty=true;w.wallsDirty=true;
 const i=5*w.w+10; w.road[i-1]=1; w.zone[i]=ZONE.R; w.tier[i]=3;
 const h=createHousehold(w,'rabbit',2);placeHousehold(w,h,i);
 for(const c of w.citizens){c.deathAge=99999;c.fixed=true;}
 computeFields(w);w.valves.R=-1;
 return {w,h,i};
}
export function checkCamping(check) {
 const {w,h,i}=fixture(),ids=h.members.slice();
 check('camping: downturn retains citizens, names, family and frees the home',startCamping(w,h)&&h.home===-1&&w.occupants[i]===0&&ids.every(id=>w.byId.has(id)&&w.byId.get(id).home===-1)&&w.campers.length===1);
 check('camping: homeless residents do not consume vacant housing capacity',census(w).vacantR===24);
 const cp=w.campers[0],x=cp.tile%w.w,y=Math.floor(cp.tile/w.w);
 const before=stateHash(w);
 const ops=[...['road','rail','wall','tree'].map(kind=>({kind,tiles:[cp.tile]})),...['zone','bulldoze'].map(kind=>({kind,zone:ZONE.R,x0:x,y0:y,x1:x,y1:y})),...['park','largePark','fire','police','centre','zoo','station'].map(kind=>({kind,tx:x,ty:y}))];
 check('camping: construction and bulldozing refuse occupied tents atomically',ops.every(op=>!apply(w,op).ok)&&stateHash(w)===before);
 check('camping: a far corner of a campus also blocks the whole purchase',!apply(w,{kind:'largePark',tx:x-2,ty:y-2}).ok&&stateHash(w)===before);
 w.tick+=100;check('camping: downturn tents never time out',rehouseCampers(w)===0&&w.campers.length===1);
 const loaded=load(save(w));
 check('camping: save/load keeps tent location, family and identity',stateHash(loaded)===stateHash(w)&&loaded.campers[0].tile===cp.tile&&loaded.hhById.get(h.id).members.join()===ids.join());
 for(let n=0;n<12;n++){tick(w);tick(loaded);}
 check('camping: continuation is deterministic',stateHash(w)===stateHash(loaded));
 const r=fixture();startCamping(r.w,r.h);const site=r.w.campers[0].tile;
 r.w.valves.R=1;
 check('camping: recovery rehouses the same family and releases its site',rehouseCampers(r.w)===2&&r.h.home===r.i&&!campAt(r.w,site)&&r.w.occupants[r.i]===2&&apply(r.w,{kind:'park',tx:site%r.w.w,ty:Math.floor(site/r.w.w)}).ok);
 const d=fixture();d.w.rng.chance=()=>true;
 const out=citizensTick(d.w,census(d.w),{});
 check('camping: the actual downturn departure path creates a tent without emigration',out.left===0&&d.w.citizens.length===2&&d.w.campers.some(cp=>cp.householdId===d.h.id));
 const full=fixture();full.w.terrain.fill(1);const fullHash=stateHash(full.w);
 check('camping: no legal site leaves the family housed and state unchanged',!startCamping(full.w,full.h)&&stateHash(full.w)===fullHash);
 const decay=fixture();decay.w.tier[decay.i]=0;evictFromLot(decay.w,decay.i,0);
 check('camping: economic housing decay keeps displaced residents in tents',decay.w.citizens.every(c=>!c.dead)&&decay.w.campers.some(cp=>cp.householdId===decay.h.id)&&decay.w.occupants[decay.i]===0);

 const dead=fixture();startCamping(dead.w,dead.h);for(const id of dead.h.members.slice())removeCitizen(dead.w,dead.w.byId.get(id),'died');
 check('camping: empty households immediately release their campsites',dead.w.campers.length===0);
 const temp=fixture();addCamp(temp.w,{id:10000,name:'Visitor',species:'fox',kind:'camper',until:9});addCamp(temp.w,{id:10001,name:'Visitor 2',species:'fox',kind:'camper',until:9});
 check('camping: visitor tents have distinct saved sites and block building',temp.w.campers[0].tile!==temp.w.campers[1].tile&&!!campAt(temp.w,temp.w.campers[0].tile));
 const restore=fixture(), back=8*restore.w.w+8;
 apply(restore.w,{kind:'park',tx:8,ty:8});apply(restore.w,{kind:'bulldoze',x0:8,y0:8,x1:8,y1:8});
 restore.w.campers.push({id:9001,name:'Camper',species:'fox',kind:'camper',tile:back,until:99});
 check('camping: undo cannot restore a building over an occupied tent',!undo(restore.w).ok&&!restore.w.civic[back]&&!!campAt(restore.w,back));
 const legacy=JSON.parse(save(temp.w));delete legacy.campers[0].tile;delete legacy.campers[1].tile;
 const migrated=load(JSON.stringify(legacy));
 check('camping: old decorative tents migrate to distinct physical sites',migrated.campers.every(c=>c.tile>=0)&&migrated.campers[0].tile!==migrated.campers[1].tile);
}
