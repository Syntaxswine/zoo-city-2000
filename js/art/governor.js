// The public estate is distinct from the affluent household's residential mansion.
import { box,flatSkin,litSkin } from './solid.js';
import { KIT,solidSprite,registerCivicKind,registerCivicVariations } from './buildings.js';
import { TREE_ROUND,TREE_TALL } from './terrain.js';
const {CONC,CONC_WALL,BRICK,GRASS,SLATE_SKIN,TIMBER,walled,doorAt}=KIT;
const stone=flatSkin(CONC[3],CONC[2],CONC[1]),lawn=flatSkin(GRASS[3],GRASS[1],GRASS[0]),teal=flatSkin('I','H','G');
function estate(v){
  const boxes=[],put=(a,b,w,d,c,h,skin)=>boxes.push(box(a,a+w,b,b+d,c,c+h,skin));
  const hall=(a,b,w,d,h)=>{
    put(a,b,w,d,.6,h,walled(litSkin(v===1?BRICK:CONC_WALL,{height:h}),h,{storey:8,sill:3,winH:3,period:5,winW:2,from:1,door:doorAt(w/2,6,3)}));
    for(let k=0;k<4;k++)put(a-.5+k,b-.5+k,w+1-2*k,d+1-2*k,h+.6+k,1,SLATE_SKIN);
  };
  put(0,0,48,48,0,.6,lawn);
  put(19,23,10,25,.6,.3,stone);
  if(v===0){hall(7,5,34,16,22);hall(4,21,11,13,12);hall(33,21,11,13,12);}
  if(v===1){hall(7,5,34,16,18);hall(4,21,11,15,18);hall(33,21,11,15,18);hall(19,6,10,11,30);}
  if(v===2){hall(12,5,24,18,26);hall(3,8,9,19,12);hall(36,8,9,19,12);}
  // Four columns support the portico; broad steps meet a clear central walk.
  put(16,23,16,6,.6,1,stone);
  for(const a of [17,21,26,30])put(a,26,1,1,1.6,10,stone);
  put(16,21,16,7,11.6,1,stone);
  put(17,28,14,2,.6,.7,stone);put(18,30,12,2,.6,.3,stone);
  put(23.5,10,1,1,(v===1?34.6:v===2?30.6:26.6),10,stone);
  put(24.5,10,5,.5,(v===1?40.6:v===2?36.6:32.6),4,teal);
  for(const a of [4,34]){put(a,39,10,5,.6,.8,stone);put(a+1,40,8,3,1.4,.6,lawn);}
  for(const a of [11,31]){put(a,35,6,2,2,1,TIMBER);put(a,35,1,2,.6,1.4,stone);put(a+5,35,1,2,.6,1.4,stone);}
  // Gate walls leave the public entrance open.
  put(1,46,17,1,.6,2,stone);put(30,46,17,1,.6,2,stone);
  return solidSprite('governor-estate-'+v,boxes,{hub:24,footprint:[3,3],tags:['civic','governor'],stamps:[[TREE_ROUND,7,35,.6],[TREE_TALL,41,35,.6]]});
}
export const GOVERNOR_FAMILY={kind:'governor',side:3,sprites:[0,1,2].map(estate)};
registerCivicKind('governor',3,GOVERNOR_FAMILY.sprites[0]);
registerCivicVariations(GOVERNOR_FAMILY.sprites[0],GOVERNOR_FAMILY.sprites.slice(1));
export const allGovernor=()=>GOVERNOR_FAMILY.sprites.map(sprite=>({name:sprite.name,sprite}));
