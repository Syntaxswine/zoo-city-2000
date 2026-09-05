import {installCanvas,createCanvas,encodePNG} from './headless-canvas.mjs';
import {rasterize} from '../js/art/format.js';
import {art} from '../js/art/index.js';
import {writeFileSync} from 'node:fs';
installCanvas();const canvas=createCanvas(640,400),ctx=canvas.getContext('2d');ctx.fillStyle='#dedac5';ctx.fillRect(0,0,640,400);
for(const [row,mask] of [5,10].entries())for(let col=0;col<4;col++){
 const sprite=col%2?art.railBridge(mask):art.rail(mask),s=col>=2?art.hires(sprite):sprite,scale=2;
 const im=rasterize(s.rows),c=createCanvas(im.w,im.h);c.getContext('2d').putImageData({width:im.w,height:im.h,data:im.data},0,0);
 ctx.drawImage(c,col*160+80-s.anchor[0]*scale,row*180+130-s.anchor[1]*scale,im.w*scale,im.h*scale);
}
writeFileSync('docs/shots/sheet-rail-bridges.png',encodePNG(canvas));
