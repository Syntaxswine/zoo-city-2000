// Browser-only favourites and camera motion. Never part of an exported city.
import {pinTarget} from './follow.js';
import {toScreen,toWorld,HALF_H} from './iso/iso.js';
import {lifeLines} from './sim/life.js';
import {legacyOf} from './sim/legacy.js';

export const peopleKey = (name,world) => JSON.stringify([name,world.seedNum]);
export function starIds(prefs,key){
 const raw=prefs?.stars?.[key];
 return Array.isArray(raw)?[...new Set(raw.filter(id=>Number.isSafeInteger(id)&&id>=0))]:[];
}
export function toggleStar(prefs,key,id){
 const ids=starIds(prefs,key),stars={...(prefs?.stars||{})};
 stars[key]=ids.includes(id)?ids.filter(n=>n!==id):[...ids,id];
 return {stars};
}
export function moveFollow(camera,target,dt,maxLag=Infinity){
 if(!(dt>0)||!Number.isFinite(target?.tx)||!Number.isFinite(target?.ty))return;
 const [tx,ty]=toWorld(camera.x,camera.y-HALF_H);
 const dx=target.tx-tx,dy=target.ty-ty,d=Math.hypot(dx,dy);
 // Normal walking eases at four tiles/s. Fast trains may outrun that;
 // catch up enough to keep the subject within the follow framing radius.
 const part=d?Math.min(1,Math.max(4*dt,d-maxLag)/d):1;
 const [x,y]=toScreen(tx+dx*part,ty+dy*part);camera.x=x;camera.y=y+HALF_H;
}
export function starredNotices(world,ids){
 const stars=new Set(ids),lines=[];
 for(const event of world.lifeEvents||[]){
  if(!stars.has(event.id))continue;
  const c=world.byId.get(event.id),kept=c?null:legacyOf(world,event.id);
  if(!c&&!kept)continue;
  const person=c||{...kept,name:kept.first};
  const line=lifeLines(world,{...person,life:[[world.tick-1,event.kind,event.arg]]})[0];
  if(line)lines.push(`★ ${c?c.name+' '+c.surname:kept.name}: ${line}`);
 }
 return [...new Set(lines)];
}
export function installPeople(app){
 app.following=null;
 app.starIds=()=>starIds(app.prefs.get(),peopleKey(app.cityName,app.world));
 app.toggleStar=id=>{
  if(!app.starIds().includes(id)&&!pinTarget(app.world,[],id))return;
  app.prefs.set(toggleStar(app.prefs.get(),peopleKey(app.cityName,app.world),id));
  app.ui.refresh();
 };
 app.stopFollowing=()=>{
  if(app.following==null)return;
  app.following=null;app.walkers.attend(null);app.ui.refresh();
 };
 app.followCitizen=id=>{
  const target=pinTarget(app.world,app.walkers.list(),id);
  if(!target||target.state==='gone'||target.tx==null)return false;
  app.input.pinCitizen(id);app.following=id;app.walkers.attend(id);
  const [x,y]=toScreen(target.tx,target.ty);app.camera.x=x;app.camera.y=y+HALF_H;
  app.ui.refresh();return true;
 };
 app.updateFollowing=dt=>{
  if(app.following==null)return;
  const target=pinTarget(app.world,app.walkers.list(),app.following);
  if(!target||target.state==='gone'){app.stopFollowing();return;}
  moveFollow(app.camera,target,dt,3);
 };
}
