import {createWorld,ROAD,ZONE,PART} from '../js/sim/world.js';
import {computeCamCover,computeFields} from '../js/sim/fields.js';
import {apply,undo} from '../js/sim/ops.js';
import {createHousehold,placeHousehold,moodTerms} from '../js/sim/citizens.js';
import {burglaryTick} from '../js/sim/justice.js';
import {KNOBS} from '../js/sim/rules.js';
import {save,load} from '../js/sim/save.js';
export function checkCameraIntegration(check){
 const w=createWorld({seed:'camera-ring',w:24,h:24});
 for(const key of ['terrain','road','rail','civic','wall','zone','tier','cam'])w[key].fill(0);
 w.cash=100000;
 for(let y=4;y<=18;y++)for(let x=4;x<=18;x++)w.road[y*w.w+x]=ROAD.ROAD;
 const sources=[6*w.w+6,16*w.w+16];for(const i of sources)w.cam[i]=1;
 const originalReach=KNOBS.CAM_REACH;KNOBS.CAM_REACH=12;
 const expected=new Uint8Array(w.road.length);
 for(const src of sources){
  const queue=[[src,0]],seen=new Set([src]);
  for(let q=0;q<queue.length;q++){
   const [i,d]=queue[q],x=i%w.w,y=Math.floor(i/w.w),eff=d<=KNOBS.CAM_NEAR?KNOBS.CAM_EFFECT:KNOBS.CAM_EFFECT/2;
   for(let yy=Math.max(0,y-KNOBS.ROAD_REACH);yy<=Math.min(w.h-1,y+KNOBS.ROAD_REACH);yy++)for(let xx=Math.max(0,x-KNOBS.ROAD_REACH);xx<=Math.min(w.w-1,x+KNOBS.ROAD_REACH);xx++)expected[yy*w.w+xx]=Math.max(expected[yy*w.w+xx],eff);
   if(d>=KNOBS.CAM_REACH)continue;
   for(const [xx,yy] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const j=yy*w.w+xx;if(xx>=0&&yy>=0&&xx<w.w&&yy<w.h&&w.road[j]&&!seen.has(j)){seen.add(j);queue.push([j,d+1]);}}
  }
 }
 let same=true;for(let n=0;n<5;n++){computeCamCover(w);same&&=w.camCov.every((v,i)=>v===expected[i]);}
 KNOBS.CAM_REACH=originalReach;
 check('camera integration: cyclic streets and multiple cameras match independent coverage repeatedly',same);
 const at=10*w.w+10;
 // A straight road through the scene allows a perpendicular rail crossing,
 // except when a camera occupies that road tile.
 w.cam.fill(0);w.road.fill(0);for(let x=3;x<20;x++)w.road[10*w.w+x]=ROAD.ROAD;
 w.roadsDirty=true;w.wallsDirty=true;computeFields(w);apply(w,{kind:'camera',tiles:[at]});
 check('camera integration: a camera prevents a tunnel being built around it',!apply(w,{kind:'wall',tiles:[at]}).ok&&!w.wall[at]&&w.cam[at]===1);
 apply(w,{kind:'rail',tiles:[at-w.w,at,at+w.w]});
 check('camera integration: a camera prevents a rail crossing on its road',!w.rail[at]&&w.cam[at]===1);
 const far=10*w.w+10+KNOBS.CAM_REACH+KNOBS.ROAD_REACH,before=w.camCov[far];apply(w,{kind:'wall',tiles:[at+1]});
 check('camera integration: a road-wall edit updates coverage immediately and undo restores it',before>0&&!w.camCov[far]&&undo(w).ok&&w.camCov[far]===before);
 w.wall[at]=1;computeCamCover(w);
 check('camera integration: invalid imported tunnel cameras cannot emit coverage',!w.camCov.some(Boolean));
 const b=createWorld({seed:'burgled-block',w:16,h:16});for(const key of ['terrain','road','rail','civic','wall','zone','tier','big','crime'])b[key].fill(0);
 const home=5*b.w+5,part=home+1; b.big[home]=2;
 for(const [dx,dy] of [[0,0],[1,0],[0,1],[1,1]]){const i=home+dy*b.w+dx;b.zone[i]=ZONE.R;b.tier[i]=3;if(dx||dy)b.big[i]=PART|dx|dy<<2;}
 const hh=createHousehold(b,'rabbit',2);placeHousehold(b,hh,home);for(const c of b.citizens)c.born=-300;
 const other=createHousehold(b,'rabbit',1);placeHousehold(b,other,home+3);b.citizens.at(-1).born=-300;
 b.crime[part]=100;b.rng.chance=()=>true;burglaryTick(b,{policeStations:0},[]);
 check('camera integration: burglary on a building part marks its anchor residents only',b.events.files.at(-1)?.tile===part&&hh.members.every(id=>b.byId.get(id).burgled)&&!b.byId.get(other.members[0]).burgled);
 b.camCov[home]=KNOBS.CAM_EFFECT;
 check('camera integration: joined-home victims keep their mood waiver and saved victim flag',hh.members.every(id=>!moodTerms(b,b.byId.get(id)).some(t=>t.code==='WATCHED'))&&hh.members.every(id=>load(save(b)).byId.get(id).burgled));
}
