import {createWorld,ZONE} from '../js/sim/world.js';
import {createHousehold,placeHousehold,removeCitizen,startCamping} from '../js/sim/citizens.js';
import {computeFields,commutePath,doorsOf} from '../js/sim/fields.js';
import {save,load,stateHash} from '../js/sim/save.js';
import {tick} from '../js/sim/tick.js';
import {apply,undo} from '../js/sim/ops.js';
import {buildingSnapshot,syncBuildingAge,buildingAge,wearLevel} from '../js/sim/building-age.js';
import {peopleKey,starIds,toggleStar,moveFollow,starredNotices,installPeople} from '../js/people.js';
import {pinTarget} from '../js/follow.js';
import {toWorld,toScreen,HALF_H} from '../js/iso/iso.js';
import {createWalkers} from '../js/walkers.js';
import {KIND,remember} from '../js/sim/life.js';
import {characterSprite} from '../js/art/building-character.js';
import {allBuildings} from '../js/art/buildings.js';
import {allBlocks} from '../js/art/blocks.js';
import {allLandmarks} from '../js/art/landmarks.js';
import {allShops} from '../js/art/shops.js';
import {art} from '../js/art/index.js';
import {RECIPES} from '../js/art/solid.js';
import {hasKey} from '../js/art/palette.js';

function fixture(){
 const w=createWorld({seed:'stretch',w:32,h:32});
 for(const k of ['terrain','road','rail','zone','tier','civic','civicSize','wall','big','rubble','burning','flooded'])w[k].fill(0);
 w.cash=100000;w.roadsDirty=true;w.wallsDirty=true;
 const before=buildingSnapshot(w),home=10*w.w+10;
 w.zone[home]=ZONE.R;w.tier[home]=3;
 for(let x=3;x<25;x++)w.road[9*w.w+x]=1;
 syncBuildingAge(w,before);
 const h=createHousehold(w,'rabbit',2);placeHousehold(w,h,home);computeFields(w);
 return {w,h,c:w.byId.get(h.members[0]),home};
}
export function checkPeopleStretch(check){
 const {w,c,h,home}=fixture(),key=peopleKey('Town',w),other=peopleKey('Other',w);
 let prefs={};prefs={...prefs,...toggleStar(prefs,key,c.id)};
 check('stars: preferences are city scoped and deduplicated',starIds(prefs,key).join()===String(c.id)&&starIds(prefs,other).length===0&&starIds({stars:{[key]:[c.id,c.id,-1,'2']}},key).length===1);
 const hash=stateHash(w);remember(w,c,KIND.RETIRED);w.tick++;const withLife=stateHash(w);
 const notices=starredNotices(w,[c.id]);
 check('stars: a life toast names the correct citizen without saving UI state',notices.length===1&&notices[0].includes(c.name)&&notices[0].includes('Retired')&&stateHash(w)===withLife&&!save(w).includes('stars'));
 check('stars: unstar is reversible and unseen citizens produce no toast',starIds(toggleStar(prefs,key,c.id),key).length===0&&starredNotices(w,[]).length===0);
 const camera={x:0,y:HALF_H,zoom:2};moveFollow(camera,{tx:10,ty:0},.25);const p=toWorld(camera.x,camera.y-HALF_H);
 check('follow: motion is capped at four world tiles per second',Math.abs(p[0]-1)<1e-9&&Math.abs(p[1])<1e-9);
 const still=JSON.stringify(camera);moveFollow(camera,{tx:10,ty:10},0);moveFollow(camera,{tx:null,ty:null},1);
 check('follow: paused or unlocated targets never move the camera',JSON.stringify(camera)===still);
 let lag=0;
 for(let f=1;f<=120;f++){const target={tx:1+f*13.5/60,ty:0};moveFollow(camera,target,1/60,3);const at=toWorld(camera.x,camera.y-HALF_H);lag=Math.max(lag,Math.hypot(target.tx-at[0],target.ty-at[1]));}
 check('follow: fast rail at x3 remains within three tiles',lag<=3.000001);
 let pinned=null;
 const walkers=createWalkers(w),app={world:w,cityName:'Town',camera,prefs:{get:()=>prefs,set:patch=>{prefs={...prefs,...patch};}},ui:{refresh(){}},walkers,input:{pinCitizen(id){pinned=id;return true;}}};
 installPeople(app);app.followCitizen(c.id);
 check('follow: starting pins the stable citizen and stopping retains that pin',app.following===c.id&&pinned===c.id);
 app.stopFollowing();check('follow: explicit stop leaves the card pinned',app.following===null&&pinned===c.id);
 app.followCitizen(c.id);removeCitizen(w,c,'died');app.updateFollowing(.1);
 check('follow: death stops camera tracking without losing the epitaph',app.following===null&&pinTarget(w,[],c.id)?.state==='gone');
 check('stars: gone residents retain their favourite entry',app.starIds().includes(c.id));
 prefs.stars[key].push(999999);app.toggleStar(999999);
 check('stars: favourites absent in an older save can still be removed',!app.starIds().includes(999999));

 const rider=fixture(),rw=rider.w,rc=rider.c;
 apply(rw,{kind:'rail',tiles:Array.from({length:22},(_,x)=>8*rw.w+3+x)});
 apply(rw,{kind:'station',tx:3,ty:8});apply(rw,{kind:'station',tx:24,ty:8});
 rc.home=10*rw.w+4;rc.job=10*rw.w+23;rc.born=-300;rc.stale=false;
 rw.zone[rc.home]=ZONE.R;rw.tier[rc.home]=1;rw.zone[rc.job]=ZONE.I;rw.tier[rc.job]=1;computeFields(rw);
 rc.path=commutePath(rw,rc.species,doorsOf(rw,rc.home),doorsOf(rw,rc.job))?.path;
 const layer=createWalkers(rw),view={x0:0,y0:0,x1:32,y1:32};layer.attend(rc.id);
 const [rx,ry]=toScreen(4,10),cam={x:rx,y:ry+HALF_H};let rode=false,maxLag=0;
 const neutral=stateHash(rw);
 for(let n=0;n<360;n++){
  layer.update(3/60,view);const target=pinTarget(rw,layer.list(),rc.id);moveFollow(cam,target,1/60,3);
  if(target.walker?.riding)rode=true;
  const [x,y]=toWorld(cam.x,cam.y-HALF_H);maxLag=Math.max(maxLag,Math.hypot(x-target.tx,y-target.ty));
 }
 check('follow: a real attended rail commuter stays framed at x3',rode&&maxLag<=3.000001,`rode ${rode}, lag ${maxLag}, path ${rc.path}, walkers ${layer.count}, stale ${rc.stale}, leave ${rc.onLeave}`);
 check('follow: attended walking and camera motion leave the simulation untouched',stateHash(rw)===neutral);

 const a=fixture();a.w.tick=180;
 check('wear: buildings founded at tick zero reach ivy at exactly 15 years',a.w.since[a.home]===1&&buildingAge(a.w,a.home)===180&&wearLevel(179)===0&&wearLevel(180)===1&&wearLevel(299)===1&&wearLevel(300)===2);
 const saved=load(save(a.w));check('wear: saved construction dates and full identity round trip',saved.since[a.home]===1&&stateHash(saved)===stateHash(a.w));
 const plain=JSON.parse(save(a.w));delete plain.since;const old=load(JSON.stringify(plain));
 check('wear: old exports start observation now without invented age',buildingAge(old,a.home)===0&&old.since[a.home]===181);
 plain.since=Array(a.w.tier.length).fill(0);plain.since[a.home]=4294967297;
 check('wear: malformed dates cannot wrap into ancient buildings',buildingAge(load(JSON.stringify(plain)),a.home)===0);
 const pre=buildingSnapshot(a.w);a.w.tier[a.home]=2;syncBuildingAge(a.w,pre);
 check('wear: ordinary tier decline keeps the last expansion date',a.w.since[a.home]===1);
 const pre2=buildingSnapshot(a.w);a.w.tier[a.home]=3;syncBuildingAge(a.w,pre2);
 check('wear: renewed expansion restarts the date',a.w.since[a.home]===181);
 a.w.tick=190;const shape=buildingSnapshot(a.w);a.w.big[a.home]=2;syncBuildingAge(a.w,shape);
 check('wear: a changed footprint starts a new structure',a.w.since[a.home]===191);
 const empty=fixture();for(const id of empty.h.members.slice())removeCitizen(empty.w,empty.w.byId.get(id),'died');
 empty.w.tick=300;const date=empty.w.since[empty.home];
 apply(empty.w,{kind:'bulldoze',x0:10,y0:10,x1:10,y1:10});
 check('wear: demolition clears age and undo restores it',empty.w.since[empty.home]===0&&undo(empty.w).ok&&empty.w.since[empty.home]===date);
 const continuing=load(save(a.w));for(let n=0;n<12;n++){tick(a.w);tick(continuing);}
 check('wear: twelve-month continuation preserves every date',stateHash(a.w)===stateHash(continuing)&&a.w.since.join()===continuing.since.join());

 const bases=[...new Set([...allBuildings(),...allBlocks(),...allLandmarks(),...allShops()].map(x=>x.sprite).filter(s=>s.tags.includes('building')))];
 const bad=[],unchanged=[],ground=[];
 for(const base of bases){
  const young=characterSprite(base,{lit:2,majority:1,seed:9}),ivy=characterSprite(base,{lit:2,majority:1,seed:9,wear:1}),old=characterSprite(base,{lit:2,majority:1,seed:9,wear:2});
  const yb=RECIPES.get(young).boxes,ob=RECIPES.get(old).boxes;
  for(let i=0;i<yb.length;i++)if(yb[i].c1<=8 && typeof yb[i].faces.top==='function'){
   for(let u=0;u<yb[i].a1-yb[i].a0;u++)for(let k=0;k<yb[i].b1-yb[i].b0;k++)
    if(yb[i].faces.top(u,k,u,k)!==ob[i].faces.top(u,k,u,k))ground.push(base.name);
  }
  if(young.rows.join()===ivy.rows.join()||ivy.rows.join()===old.rows.join())unchanged.push(base.name);
  for(const s of [ivy,old,art.hires(ivy),art.hires(old)]){
   if(s.rows.some(row=>[...row].some(ink=>ink!=='.'&&!hasKey(ink))))bad.push(s.name);
   if(s.footprint.join()!==base.footprint.join())bad.push(s.name);
   const reference=s.w===young.w?young:art.hires(young);
   if(s.rows.some((row,y)=>[...row].some((ink,x)=>(ink==='.')!==(reference.rows[y]?.[x]==='.'))))bad.push(s.name+' changed silhouette');
  }
 }
 check('wear: courtyard lawns, paths and low platforms retain their colours',ground.length===0,ground.join(', '));
 check('wear: every zoned plan changes at both wear stages',unchanged.length===0,unchanged.join(', '));
 check('wear: both resolutions retain palette and exact solid silhouette',bad.length===0,bad.join(', '));
}
