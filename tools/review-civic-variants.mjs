import {writeFileSync,mkdirSync} from 'node:fs';
import {art} from '../js/art/index.js';
import {CIVIC_VARIANT_FAMILIES} from '../js/art/civic-variations.js';
import {rasterize} from '../js/art/format.js';
import {createCanvas,installCanvas,encodePNG} from './headless-canvas.mjs';
installCanvas();mkdirSync('out/building-variants',{recursive:true});
function stamp(ctx,s,x,y,scale){const im=rasterize(s.rows),c=createCanvas(im.w,im.h);c.getContext('2d').putImageData({width:im.w,height:im.h,data:im.data},0,0);ctx.setTransform(scale,0,0,scale,x,y);ctx.drawImage(c,-s.anchor[0],-s.anchor[1]);ctx.setTransform(1,0,0,1,0,0);}
function sheet(name,families,scale){const W=Math.max(...families.flatMap(f=>f.sprites.map(s=>s.w*scale)))+30,H=Math.max(...families.flatMap(f=>f.sprites.map(s=>s.h*scale)))+42,c=createCanvas(W*3,H*families.length),ctx=c.getContext('2d');ctx.fillStyle='#dedbcf';ctx.fillRect(0,0,c.width,c.height);families.forEach((f,r)=>f.sprites.forEach((s,k)=>{ctx.fillStyle='#393b3b';ctx.font='12px monospace';ctx.fillText(`${f.kind} ${f.side}x${f.side} / ${k===0?'original':`layout ${k}`}`,k*W+8,r*H+17);const h=scale===1?s:art.hires(s,2);stamp(ctx,h,k*W+W/2,(r+1)*H-16-(h.h-h.anchor[1]),1);}));writeFileSync(`out/building-variants/${name}-${scale}x.png`,encodePNG(c));}
const groups={services:CIVIC_VARIANT_FAMILIES.filter(f=>['doctor','hospital','farm','sanitation','garbage'].includes(f.kind)),campuses:CIVIC_VARIANT_FAMILIES.filter(f=>['fire','police','centre','zoo'].includes(f.kind)&&f.side===3),culture:CIVIC_VARIANT_FAMILIES.filter(f=>['library','gallery','university','amphitheater'].includes(f.kind)),landscape:CIVIC_VARIANT_FAMILIES.filter(f=>['park','largePark'].includes(f.kind)),cemetery:CIVIC_VARIANT_FAMILIES.filter(f=>f.kind==='cemetery'),legacy:CIVIC_VARIANT_FAMILIES.filter(f=>['fire','police','centre'].includes(f.kind)&&f.side===1)};
for(const [name,families]of Object.entries(groups))for(const scale of [1,2])sheet(name,families,scale);
console.log('Civic comparison sheets generated.');
