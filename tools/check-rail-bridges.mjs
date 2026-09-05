import {createWorld,TERRAIN,ZONE,ROAD} from '../js/sim/world.js';
import {apply,undo} from '../js/sim/ops.js';
import {computeFields,commutePath,doorOf,RIDE} from '../js/sim/fields.js';
import {hallReach} from '../js/sim/meat.js';
import {yearlyFigures} from '../js/sim/budget.js';
import {KNOBS} from '../js/sim/rules.js';
import {save,load,stateHash} from '../js/sim/save.js';
import {tick} from '../js/sim/tick.js';
import {ROSTER} from '../js/sim/events.js';
import {art} from '../js/art/index.js';
export function checkRailBridges(check){
 for(const transpose of [false,true]){
  const w=createWorld({seed:'rail-water',w:24,h:24});
  for(const key of ['terrain','road','rail','zone','tier','civic','civicSize','wall','big','rubble','burning','flooded'])w[key].fill(0);
  w.cash=100000;w.events.noDisasters=true;
  const at=(x,y)=>transpose?x*w.w+y:y*w.w+x;
  for(let x=8;x<=11;x++)for(let y=0;y<24;y++)w.terrain[at(x,y)]=TERRAIN.WATER;
  const line=Array.from({length:16},(_,n)=>at(n+2,6)),wet=at(9,6),axis=transpose?'NS':'EW';
  const result=apply(w,{kind:'rail',tiles:line}),cash=w.cash;
  check('rail bridge '+axis+': construction quotes and charges dry/wet tiles',result.ok&&result.cost===12*KNOBS.COST.rail+4*KNOBS.COST.railBridge&&line.every(i=>w.rail[i]===1));
  check('rail bridge '+axis+': undo restores the entire span and treasury',undo(w).ok&&line.every(i=>!w.rail[i])&&w.cash===cash+result.cost);
  apply(w,{kind:'rail',tiles:line});
  const xy=i=>({tx:i%w.w,ty:Math.floor(i/w.w)});
  check('rail bridge '+axis+': stations and road crossings are refused on water',!apply(w,{kind:'station',...xy(wet)}).ok&&!apply(w,{kind:'road',tiles:[wet]}).ok&&!w.road[wet]&&w.rail[wet]===1);
  for(let x=2;x<=17;x++)if(x<8||x>11)w.road[at(x,7)]=ROAD.ROAD;
  apply(w,{kind:'station',...xy(at(2,6))});apply(w,{kind:'station',...xy(at(17,6))});
  const home=at(2,8),hall=at(17,8);w.zone[home]=ZONE.R;w.tier[home]=1;w.zone[hall]=ZONE.M;w.tier[hall]=2;
  w.roadsDirty=true;w.wallsDirty=true;computeFields(w);
  const commute=commutePath(w,'rabbit',doorOf(w,home),doorOf(w,hall),100),freight=hallReach(w,home,Infinity);
  check('rail bridge '+axis+': commuters and freight ride across the river',commute?.path.some(i=>(i&RIDE)&&(i&~RIDE)===wet)&&freight?.path.some(i=>(i&RIDE)&&(i&~RIDE)===wet));
  const figures=yearlyFigures(w);w.terrain[wet]=TERRAIN.GRASS;const dry=yearlyFigures(w);w.terrain[wet]=TERRAIN.WATER;
  check('rail bridge '+axis+': annual upkeep counts each water tile once',figures.railBridges===4&&figures.upkeepYr-dry.upkeepYr===KNOBS.UPKEEP_RAIL_BRIDGE-KNOBS.UPKEEP_RAIL);
  const restored=load(save(w));check('rail bridge '+axis+': save reload preserves the span',stateHash(w)===stateHash(restored)&&restored.rail[wet]===1&&restored.terrain[wet]===TERRAIN.WATER);
  const before=stateHash(w);apply(w,{kind:'bulldoze',x0:xy(wet).tx,y0:xy(wet).ty,x1:xy(wet).tx,y1:xy(wet).ty});
  check('rail bridge '+axis+': demolition severs freight and undo restores it',!hallReach(w,home,Infinity)&&undo(w).ok&&!!hallReach(w,home,Infinity));
  const continued=load(save(w));for(let n=0;n<12;n++){tick(w);tick(continued);}
  check('rail bridge '+axis+': continuation after reload is deterministic',stateHash(w)===stateHash(continued));
 }
 for(const [layer,value] of [['rail',1],['rail',2],['wall',1]]){
  const dam=createWorld({seed:'bridge-dam',w:8,h:8});
  for(const key of ['road','rail','wall','zone','tier','civic'])dam[key].fill(0);
  dam.terrain.fill(TERRAIN.WATER);for(const i of [27,28,35,36])dam.terrain[i]=TERRAIN.GRASS;
  dam[layer][27]=value;
  check('rail bridges: beaver ponds cannot flood '+layer+' '+value,ROSTER.find(e=>e.id==='beaverDam').fire(dam)===null&&dam.terrain[27]===TERRAIN.GRASS&&dam[layer][27]===value);
 }
 check('rail bridges: both axes have distinct raised art at both resolutions',[5,10].every(mask=>art.railBridge(mask)!==art.rail(mask)&&art.railBridge(mask).tags.includes('bridge')&&art.hires(art.railBridge(mask))));
}
