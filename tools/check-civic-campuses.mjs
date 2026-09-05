import { createWorld, CIVIC, ROAD, ZONE, civicAnchorOf, civicSideOf, siteTiles, jobsOf } from '../js/sim/world.js';
import { apply, costOf, undo } from '../js/sim/ops.js';
import { save, load, stateHash } from '../js/sim/save.js';
import { computeFields, served } from '../js/sim/fields.js';
import { lotReport } from '../js/sim/lots.js';
import { census } from '../js/sim/census.js';
import { createHousehold, placeHousehold } from '../js/sim/citizens.js';
import { arrest, custodyTick, bedsAt } from '../js/sim/justice.js';
import { KNOBS } from '../js/sim/rules.js';

function empty() {
  const w = createWorld({seed:'civic-campus', w:40, h:40});
  for (const k of ['terrain','road','zone','civic','civicSize','wall','rail','tier','big','rubble','burning']) w[k].fill(0);
  w.cash = 900000; w.roadsDirty = true; w.wallsDirty = true;
  return w;
}
const at = (w,x,y) => y*w.w+x;
const road = (w,x,y) => apply(w,{kind:'road',tiles:[at(w,x,y)]});
function resident(w,species='fox') {
  const i=at(w,4,5); w.zone[i]=ZONE.R; w.tier[i]=3;
  const hh=createHousehold(w,species,2); placeHousehold(w,hh,i);
  return w.byId.get(hh.members[0]);
}
function convict(w,c,cause) {
  const f={cause,tile:c.home,culpritId:c.id,closed:false};
  const line=arrest(w,f,c,false,[]);
  return {f,line};
}

export function checkCivicCampuses(check) {
  for (const kind of ['fire','police','centre','zoo']) {
    const w=empty(), a=at(w,10,10);
    const hash=stateHash(w);
    check(`${kind}: a gap/diagonal is insufficient and refusal is atomic`,
      !apply(w,{kind,tx:10,ty:10}).ok && stateHash(w)===hash);
    road(w,9,9);
    const diagonal=!costOf(w,{kind,tx:10,ty:10}).tiles.length;
    road(w,12,13); // Only the far corner touches this road.
    const result=apply(w,{kind,tx:10,ty:10});
    const tiles=siteTiles(w,a);
    check(`${kind}: the far edge admits all nine tiles, one employer, one Inspect card`,
      diagonal && result.ok && tiles.length===9 && served(w,a) && w.roadDist[a]>1 &&
      tiles.every(i=>civicAnchorOf(w,i)===a && civicSideOf(w,i)===3 && lotReport(w,i).tx===10) &&
      tiles.filter(i=>jobsOf(w,i)>0).length===1);
    const built=stateHash(w);
    check(`${kind}: overlap is refused without changing any state`,
      !apply(w,{kind,tx:11,ty:10}).ok && stateHash(w)===built);
    const copy=load(save(w));
    check(`${kind}: save/load preserves every owner and side`,stateHash(copy)===built && tiles.every(i=>civicAnchorOf(copy,i)===a));
    const demo=apply(w,{kind:'bulldoze',x0:12,y0:12,x1:12,y1:12});
    check(`${kind}: any corner demolishes the whole site and undo restores it`,
      demo.ok && tiles.every(i=>w.civic[i]===0 && w.civicSize[i]===0) && undo(w).ok && stateHash(w)===built);
  }
  const w=empty();
  const p=apply(w,{kind:'largePark',tx:10,ty:10});
  computeFields(w);
  check('large park: nine tiles and amenities without a road',p.ok && census(w).largeParks===1 && census(w).zoos===0 && w.lv[at(w,10,10)]>0);
  const before=stateHash(w);
  check('campus: a map edge or blocked far corner refuses the entire purchase',
    !apply(w,{kind:'largePark',tx:39,ty:39}).ok && !apply(w,{kind:'largePark',tx:8,ty:8}).ok && stateHash(w)===before);
  const legacy=empty(); legacy.civic[at(legacy,5,5)]=CIVIC.LARGE_PARK;
  for(const [x,y] of [[6,5],[5,6],[6,6]]) legacy.civic[at(legacy,x,y)]=CIVIC.LARGE_PARK_PART;
  legacy.civic[at(legacy,9,9)]=CIVIC.FIRE;
  const old=load(save(legacy));
  check('legacy saves: existing garden and station keep their safe footprint',
    civicSideOf(old,at(old,6,6))===2 && civicSideOf(old,at(old,9,9))===1);

  const j=empty();
  apply(j,{kind:'road',tiles:Array.from({length:30},(_,x)=>at(j,x+1,4))});
  for(const [kind,x] of [['zoo',10],['centre',15]]) {
    const r=apply(j,{kind,tx:x,ty:5}); if(!r.ok) throw Error(r.reason);
  }
  j.zone[at(j,20,5)]=ZONE.M; j.tier[at(j,20,5)]=2;
  computeFields(j);
  const c=resident(j), zoo=at(j,10,5), centre=at(j,15,5);
  const first=convict(j,c,'burglary');
  check('sentencing: first theft enters the zoo prison',first.f.closed && c.heldAt===zoo && c.thefts===1 && bedsAt(j,zoo)===1 && c.job===-1);
  const saved=load(save(j)), savedC=saved.byId.get(c.id);
  saved.tick=savedC.held; custodyTick(saved,[]);
  check('prison: save/load and release preserve fertility and theft history',savedC.held===0 && !savedC.fixed && savedC.thefts===1);
  j.tick=c.held; custodyTick(j,[]);
  const second=convict(j,c,'burglary');
  check('sentencing: second theft goes to pacification',second.f.closed && c.heldAt===centre && c.thefts===2);
  j.tick=c.held; custodyTick(j,[]);
  check('pacification: completion fixes the citizen',c.fixed && c.held===0);
  const third=convict(j,c,'burglary');
  check('sentencing: third theft goes to a meat hall',third.f.closed && c.dead && j.events.justice.sold===1);
  const prey=resident(j,'rabbit');
  convict(j,prey,'killing');
  check('sentencing: murder goes to pacification regardless of species',prey.heldAt===centre);
  const petty=resident(j); convict(j,petty,'trespass');
  check('sentencing: minor crimes use the prison and do not count as theft',petty.heldAt===zoo && !petty.thefts);
  const no=empty(), waiting=resident(no), pending=convict(no,waiting,'burglary');
  check('sentencing: no facility keeps the case open without a conviction or invisible custody',
    !pending.f.closed && pending.f.waitingFor==='zoo' && waiting.record===0 && waiting.held===0);
  const max=KNOBS.ZOO_BEDS;
  KNOBS.ZOO_BEDS=bedsAt(j,zoo);
  const overflow=resident(j), full=convict(j,overflow,'burglary');
  KNOBS.ZOO_BEDS=max;
  check('prison: a full facility never exceeds capacity or changes the sentence',!full.f.closed && overflow.held===0);
  const innocent=resident(j), culprit=resident(j);
  const mistaken={cause:'burglary',tile:culprit.home,culpritId:culprit.id,closed:false};
  arrest(j,mistaken,innocent,true,[]);
  convict(j,culprit,'burglary');
  check('exoneration: a wrongful theft clears the count and releases the innocent',innocent.exonerated && innocent.thefts===0 && innocent.record===0 && innocent.held===0);
  const historic=JSON.parse(save(j)); delete historic.justiceVersion;
  for(const c of historic.citizens) delete c.thefts;
  const migrated=load(JSON.stringify(historic));
  check('legacy sentencing: retained thefts recover without counting exonerated cases',migrated.byId.get(innocent.id).thefts===0 && migrated.byId.get(culprit.id).thefts===1);
  const fixedThief=resident(j); fixedThief.fixed=true;
  convict(j,fixedThief,'burglary');
  check('sentencing: theft after pacification goes directly to a meat hall',fixedThief.dead);
  const demo=apply(j,{kind:'bulldoze',x0:12,y0:7,x1:12,y1:7});
  check('occupied prison: demolition releases inmates and cannot undo people',demo.ok && !demo.undoable && petty.held===0 && petty.heldAt===-1 && !undo(j).ok);
  const rail=empty(); apply(rail,{kind:'rail',tiles:[at(rail,5,5)]}); apply(rail,{kind:'station',tx:5,ty:5});
  check('platform: a wall cannot silently replace the building with a tunnel',!apply(rail,{kind:'wall',tiles:[at(rail,5,5)]}).ok && rail.rail[at(rail,5,5)]===2 && !rail.wall[at(rail,5,5)]);
}
