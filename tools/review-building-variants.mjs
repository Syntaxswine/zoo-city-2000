// Repeatable art evidence. Sheets use real selectors; city panels use js/render.js.
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {installCanvas,createCanvas,encodePNG} from './headless-canvas.mjs';
import {art} from '../js/art/index.js';
import {BUILDINGS} from '../js/art/buildings.js';
import {BLOCKS} from '../js/art/blocks.js';
import {SHOP_ART} from '../js/art/shops.js';
import {LANDMARK_ART} from '../js/art/landmarks.js';
import {LANDMARKS} from '../js/sim/landmarks.js';
import {MANSION} from '../js/art/mansion.js';
import {CIVIC_VARIANT_FAMILIES} from '../js/art/civic-variations.js';
import * as railArt from '../js/art/rail.js';
import {rasterize} from '../js/art/format.js';
import {createWorld,CIVIC,CIVIC_OF_KIND} from '../js/sim/world.js';
import {createRenderer} from '../js/render.js';
import {stateHash} from '../js/sim/save.js';
import {placeAt} from '../js/iso/painter.js';

export function families() {
  const out=[];
  for(let zone=1;zone<=4;zone++)for(let tier=1;tier<=3;tier++)out.push({group:'zoned',key:`zone-${zone}-${tier}`,zone,tier,side:1,sprites:BUILDINGS[zone][tier],select:v=>art.building(zone,tier,v)});
  SHOP_ART.forEach((sprites,kind)=>{if(kind)out.push({group:'shops',key:`shop-${kind}`,zone:2,tier:1,side:1,sprites,select:v=>art.building(2,1,v)});});
  for(let zone=1;zone<=4;zone++)for(const side of [2,3])out.push({group:'blocks',key:`block-${zone}-${side}`,zone,tier:3,side,sprites:BLOCKS[zone][side],select:v=>art.building(zone,3,v,side)});
  for(const [id,sprites] of Object.entries(LANDMARK_ART)){const zone=LANDMARKS[id].zone;out.push({group:'landmarks',key:`landmark-${id}`,zone,tier:3,side:3,theme:+id,sprites,select:v=>art.building(zone,3,v,3,+id)});}
  out.push({group:'mansion',key:'mansion',zone:1,tier:3,side:3,mansion:true,sprites:MANSION,select:v=>art.mansion(v)});
  for(const f of CIVIC_VARIANT_FAMILIES)out.push({group:'civics',key:`${f.kind}-${f.side}`,kind:f.kind,side:f.side,sprites:f.sprites,select:v=>art.civic(f.kind,f.side,v)});
  for(const axis of ['ns','ew']){
    const table=railArt.STATION_VARIANTS || railArt.STATION_FAMILIES;
    const sprites=table?.[axis] || [railArt.STATIONS[axis]];
    out.push({group:'stations',key:`station-${axis}`,axis,side:1,sprites,select:v=>art.station(axis,v)});
  }
  return out;
}
export function roster() {
  return families().map(f=>({...f,entries:f.sprites.map((sprite,index)=>{
    const variants=Array.from({length:256},(_,v)=>v).filter(v=>f.select(v)===sprite);
    return {sprite,index,byte:variants[0],reachableBytes:variants};
  })}));
}
const raster=s=>{const im=rasterize(s.rows),c=createCanvas(im.w,im.h);c.getContext('2d').putImageData({width:im.w,height:im.h,data:im.data},0,0);return c;};
function sheet(rows,scale,path) {
  const cols=Math.max(...rows.map(f=>f.entries.length));
  const sprites=rows.flatMap(f=>f.entries.map(e=>scale===1?e.sprite:art.hires(e.sprite,scale)));
  const cw=Math.max(180,Math.max(...sprites.map(s=>s.w))+32),above=Math.max(...sprites.map(s=>s.anchor[1]))+28;
  const below=Math.max(...sprites.map(s=>s.h-s.anchor[1]))+28,ch=above+below;
  const c=createCanvas(cw*cols,ch*rows.length),ctx=c.getContext('2d');ctx.fillStyle='#dedac5';ctx.fillRect(0,0,c.width,c.height);
  rows.forEach((f,r)=>f.entries.forEach((e,col)=>{const s=scale===1?e.sprite:art.hires(e.sprite,scale);const x=col*cw+cw/2,y=r*ch+above;ctx.drawImage(raster(s),x-s.anchor[0],y-s.anchor[1]);ctx.fillStyle='#30332d';ctx.font='12px monospace';ctx.fillText(`${f.key} / ${e.index}`,col*cw+8,(r+1)*ch-9);}));
  writeFileSync(path,encodePNG(c));
}
export function cityPanel(selection,zoom=2) {
  installCanvas();const w=createWorld({seed:'building-variation-review',w:32,h:32});
  w.terrain.fill(0);w.road.fill(0);w.zone.fill(0);w.civic.fill(0);w.tier.fill(0);w.rail.fill(0);w.rubble.fill(0);w.flags.noDisasters=true;
  const slots=[],bounds=[];const pitch=Math.max(...selection.map(s=>s.family.side))+2;
  selection.forEach(({family:f,entry:e},j)=>{
    const tx=5+(j%3)*pitch,ty=5+Math.floor(j/3)*pitch,i=ty*w.w+tx,side=f.side;
    w.variant[i]=e.byte;
    if(f.kind){w.civic[i]=CIVIC_OF_KIND[f.kind];w.civicSize[i]=side;for(let dy=0;dy<side;dy++)for(let dx=0;dx<side;dx++)if(dx||dy){const p=i+dx+dy*w.w;w.civic[p]=CIVIC.PART;w.civicSize[p]=side>4?192|dx|(dy<<3):128|dx|(dy<<2);}}
    else if(f.axis){w.rail[i]=2;const step=f.axis==='ns'?w.w:1;w.rail[i-step]=1;w.rail[i+step]=1;}
    else {w.zone[i]=f.zone;w.tier[i]=f.tier;w.theme[i]=f.theme||0;w.mansion[i]=f.mansion?1:0; if(side>1){w.big[i]=side;for(let dy=0;dy<side;dy++)for(let dx=0;dx<side;dx++)if(dx||dy){const p=i+dx+dy*w.w;w.big[p]=128|dx|(dy<<2);w.zone[p]=f.zone;w.tier[p]=f.tier;}}}
    for(let dx=-1;dx<=side;dx++)w.road[i+side*w.w+dx]=1;
    slots.push({family:f.key,sprite:e.sprite.name,byte:e.byte,tx,ty});
    const [sx,sy]=placeAt(e.sprite,tx,ty);bounds.push([sx,sy,sx+e.sprite.w,sy+e.sprite.h]);
  });
  const left=Math.min(...bounds.map(b=>b[0]))-64,top=Math.min(...bounds.map(b=>b[1]))-48,right=Math.max(...bounds.map(b=>b[2]))+64,bottom=Math.max(...bounds.map(b=>b[3]))+80;
  const canvas=createCanvas(Math.ceil((right-left)*zoom),Math.ceil((bottom-top)*zoom)),before=stateHash(w);
  const seen=new Set(),traced={...art};
  for(const method of ['building','mansion','civic','station'])traced[method]=(...args)=>{const bare=args.slice(0,method==='building'?5:method==='mansion'?1:args.length);seen.add(art[method](...bare).name);return art[method](...args);};
  createRenderer(canvas,w,traced).draw({x:(left+right)/2,y:(top+bottom)/2,zoom},null,{list:()=>[]},'off',0);
  for(const slot of slots)if(!seen.has(slot.sprite))throw Error(`City renderer did not select ${slot.sprite}`);
  return {canvas,before,after:stateHash(w),slots};
}
export function review() {
  installCanvas();const out=resolve('docs/shots/building-variants');mkdirSync(out,{recursive:true});const all=roster();
  for(const f of all)for(const e of f.entries)if(e.byte===undefined)throw Error(`${e.sprite.name} is unreachable: finish selector routing before reviewing`);
  const report=[];
  for(const group of [...new Set(all.map(f=>f.group))]){
    const fs=all.filter(f=>f.group===group);
    for(let i=0;i<fs.length;i+=4){const batch=fs.slice(i,i+4);for(const scale of [1,2])sheet(batch,scale,resolve(out,`${group}-${i/4+1}-${scale}x.png`));}
  }
  // Every family appears with a new plan in an actual game-rendered neighbourhood.
  const choices=all.map(f=>({family:f,entry:f.entries[f.entries.length-1]}));
  for(let i=0;i<choices.length;i+=6){const p=cityPanel(choices.slice(i,i+6));if(p.before!==p.after)throw Error('render changed saved state');const name=`city-${i/6+1}.png`;writeFileSync(resolve(out,name),encodePNG(p.canvas));report.push({image:name,slots:p.slots});}
  const coverage=all.map(({key,group,side,entries})=>({key,group,side,entries:entries.map(({sprite,index,byte,reachableBytes})=>({index,name:sprite.name,byte,reachableBytes,footprint:sprite.footprint}))}));
  writeFileSync(resolve(out,'coverage.json'),JSON.stringify({families:coverage,cityPanels:report},null,2));
  console.log(`Building review: ${coverage.length} families, ${coverage.reduce((n,f)=>n+f.entries.length,0)} sprites → ${out}`);
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)review();
