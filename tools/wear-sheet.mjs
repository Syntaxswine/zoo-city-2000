import {installCanvas,createCanvas,encodePNG} from './headless-canvas.mjs';import{rasterize}from'../js/art/format.js';import{art}from'../js/art/index.js';import{writeFileSync}from'node:fs';installCanvas();
const canvas=createCanvas(960,760),ctx=canvas.getContext('2d');ctx.fillStyle='#dedac5';ctx.fillRect(0,0,960,760);
const choices=[[1,1,0,1],[1,3,2,1],[2,1,0,1],[3,2,1,1],[4,3,0,1],[1,3,0,2]];
for(let row=0;row<choices.length;row++)for(let wear=0;wear<3;wear++){
 const base=art.building(...choices[row],0,{lit:2,majority:row+1,seed:9,wear}),s=art.hires(base),im=rasterize(s.rows),c=createCanvas(im.w,im.h);c.getContext('2d').putImageData({width:im.w,height:im.h,data:im.data},0,0);ctx.drawImage(c,wear*320+160-s.anchor[0],row*120+112-s.anchor[1]);
}
writeFileSync('docs/shots/sheet-building-wear.png',encodePNG(canvas));
