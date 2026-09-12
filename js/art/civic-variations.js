// Authored alternate campus layouts. Coordinates use a 48-unit design grid;
// footprint scaling preserves legacy civic sizes without changing simulation.
import { TREE_ROUND, TREE_TALL, TREE_WILLOW } from './terrain.js';
import { box, flatSkin, litSkin } from './solid.js';
import { KIT, solidSprite, civicSprite, registerCivicVariations } from './buildings.js';
const { BRICK, CONC, CONC_WALL, GRASS, RUST, TIMBER, SLATE_SKIN, C_ROOF, walled, doorAt } = KIT;
const lawn = flatSkin(GRASS[3], GRASS[1], GRASS[0]);
const paving = flatSkin(CONC[3], CONC[2], CONC[1]);
const water = flatSkin('I','H','G'), red = flatSkin('9','8','7'), gold = flatSkin('-','t','s');
const soil = flatSkin('s','r','q'), crops = flatSkin('7','t','s');

function layout(kind, side, v) {
  const q = side / 3, z = Math.sqrt(q), boxes = [], stamps = [];
  const put = (a,b,w,d,c,h,skin) => boxes.push(box(a*q,(a+w)*q,b*q,(b+d)*q,c*z,(c+h)*z,skin));
  const slab = (a,b,w,d,c=.5,h=.3,skin=paving) => put(a,b,w,d,c,h,skin);
  const hall = (a,b,w,d,h,mat=CONC_WALL,roof='flat') => {
    const skin = walled(litSkin(mat,{height:h*z}),h*z,{storey:8*z,sill:2*z,winH:3*z,period:5*q,winW:2*q,from:q,door:doorAt(w*q/2,6*z,2*q)});
    put(a,b,w,d,.6,h,skin);
    if(roof==='hip') for(let k=0;k<4;k++) put(a-.4+k,b-.4+k,w+.8-2*k,d+.8-2*k,h+.6+k,1,SLATE_SKIN);
    else put(a-.4,b-.4,w+.8,d+.8,h+.6,1,mat===BRICK?SLATE_SKIN:C_ROOF);
  };
  const cross=(a,b,c)=>{put(a-1.5,b-5,3,10,c,.7,water);put(a-5,b-1.5,10,3,c,.7,water);};
  const bench=(a,b)=>{put(a,b,7,2,2,1,TIMBER);put(a,b+1.5,7,.6,3,2,TIMBER);put(a+.7,b,.7,2,.6,1.4,SLATE_SKIN);put(a+5.6,b,.7,2,.6,1.4,SLATE_SKIN);};
  const planter=(a,b,w=5,d=5)=>{slab(a,b,w,d,.6,1.5,paving);slab(a+.6,b+.6,w-1.2,d-1.2,2.1,.8,lawn);};
  const pergola=(a,b,w,d,h=9)=>{for(const x of [a,a+w-1])for(const y of [b,b+d-1])put(x,y,1,1,.6,h,TIMBER);put(a,b,w,1,h-.4,1,TIMBER);put(a,b+d-1,w,1,h-.4,1,TIMBER);for(let x=a;x<a+w;x+=3)put(x,b,1,d,h+.6,.7,TIMBER);};
  const fountain=(a,b)=>{slab(a,b,10,10,.6,1.2,paving);slab(a+1,b+1,8,8,1.8,.3,water);put(a+4,b+4,2,2,2.1,4,paving);slab(a+2,b+2,6,6,6.1,.6,paving);};
  slab(0,0,48,48,0,.5,lawn);
  if(kind!=='cemetery'){slab(20,0,8,48);slab(0,20,48,8);}
  if(kind==='doctor'||kind==='hospital') {
    const h=kind==='hospital'?22:11;
    if(v===1){hall(3,3,15,31,h,CONC_WALL,'hip');hall(18,3,26,13,h-4);hall(20,22,23,10,7);cross(31,9,h-2.4);pergola(20,35,20,8);planter(4,38,10,6);}
    else {hall(13,3,22,20,h+8);hall(3,23,18,13,8);hall(27,23,18,13,8);cross(24,12,h+9.6);slab(19,29,10,19);planter(5,39);planter(37,39);}
    // Glazed entrance, teal canopy and a front-facing medical marker.
    put(20,32,8,3,6,1,water);put(20,34,.7,.7,.6,5.4,paving);put(27.3,34,.7,.7,.6,5.4,paving);put(19,40,1,1,.6,8,paving);put(17.5,39.6,4,.8,6,1,water);put(19,39.6,1,.8,4.5,4,water);
  } else if(kind==='fire') {
    if(v===1){hall(3,3,29,15,20,BRICK,'hip');hall(3,19,29,17,10,BRICK);hall(36,4,8,10,32,BRICK);}
    else {hall(3,3,13,33,18,BRICK,'hip');hall(18,3,26,21,11,BRICK);hall(34,28,10,10,24,BRICK);}
    const b=v===1?36:24;for(const a of (v===1?[6,16,26]:[21,29])){put(a-2,b-.2,5,.5,.6,7,SLATE_SKIN);put(a-1,b+2,3,7,.8,3,red);put(a-1,b+2,3,2,3.8,1,water);}
    slab(2,b+1,44,46-b);if(v===1)put(39,7,2,2,33.6,2,red);else put(38,32,2,2,25.6,2,red);
  } else if(kind==='police') {
    if(v===1){hall(3,3,17,29,22);hall(20,3,24,12,12);hall(24,20,19,10,9);}
    else {hall(4,4,38,14,14);hall(16,18,15,16,24);pergola(3,24,10,17);}
    put(19,34,12,4,7,1,water);put(19,37,1,1,.6,6.4,paving);put(30,37,1,1,.6,6.4,paving);if(v===1)put(9,32.1,4,.5,14,4,gold);else put(21,34.1,4,.5,16,4,gold);slab(16,35,18,11);planter(4,37,9,7);
    for(const a of [35,41]){put(a,35,3,8,.6,2,paving);put(a,37,3,3,2.6,1,water);put(a+.7,38,1.5,1,3.6,.7,water);}
  } else if(kind==='centre') {
    if(v===1){hall(3,3,13,31,12);hall(16,3,27,12,12);pergola(19,20,21,9);fountain(23,32);}
    else {hall(3,3,17,17,18);hall(27,3,17,17,18);hall(17,22,14,12,8);pergola(3,27,10,15);pergola(35,27,10,15);}
    bench(18,40);planter(4,37,8,7);planter(37,37,8,7);put(21,34,6,1,7,2,water);
  } else if(kind==='zoo') {
    // Prison, not an animal exhibit: secure yard, narrow cell windows and gate.
    for(const [a,b,w,d]of [[1,1,46,2],[1,3,2,42],[45,3,2,42],[1,45,18,2],[29,45,18,2]])put(a,b,w,d,.6,7,paving);
    if(v===1){hall(5,5,12,30,21);hall(23,5,19,12,14);hall(31,24,11,12,10);}
    else {hall(5,5,37,12,15);hall(5,22,12,19,15);hall(28,22,14,13,22);}
    for(const a of [19,21,23,25,27,29])put(a,45,.5,1,.6,8,SLATE_SKIN);put(19,45,11,1,8,1,SLATE_SKIN);
    put(4,4,5,5,.6,21.4,paving);put(4,4,5,5,22,5,water);put(3,3,7,7,27,1,C_ROOF);bench(19,36);
  } else if(kind==='library') {
    if(v===1){hall(3,3,15,32,22,BRICK,'hip');hall(18,3,26,14,12,BRICK,'hip');pergola(22,23,20,9);}
    else {hall(3,3,40,15,15,BRICK,'hip');hall(17,18,13,15,24,BRICK);put(19,20,9,10,25.6,4,water);put(18.6,19.6,9.8,10.8,29.6,1,SLATE_SKIN);}
    bench(5,39);bench(33,39);put(20,41,8,1,7,4,red);put(23.8,40.8,.5,1.4,7,4,paving);put(24,41,1,1,.6,6.4,TIMBER);
  } else if(kind==='gallery') {
    if(v===1){hall(3,3,16,25,17);hall(23,3,21,13,10);pergola(22,20,20,8);}
    else {hall(3,3,40,13,13);hall(3,16,13,18,8);hall(30,20,13,14,20);}
    for(const a of [6,11,16])put(a,5,2,v===1?14:10,v===1?18.6:14.6,1,water);
    slab(22,31,10,10,.6,2,paving);put(26,35,2,2,2.6,10,red);put(22,35,10,2,12.6,2,gold);bench(4,39);
  } else if(kind==='university') {
    if(v===1){hall(3,3,41,12,21,BRICK,'hip');hall(3,15,12,26,16,BRICK,'hip');hall(33,15,11,26,16,BRICK,'hip');hall(19,4,9,9,37,BRICK);}
    else {hall(3,3,14,31,26,BRICK,'hip');hall(24,3,20,16,18,BRICK,'hip');hall(24,25,20,14,12,BRICK);pergola(3,39,15,7);}
    fountain(20,23);bench(20,39);if(v===1){put(21,13,4,.5,31,4,gold);put(22,12.8,1,.8,31.5,3,SLATE_SKIN);}else {put(8,34,4,.5,19,4,gold);put(9,33.8,1,.8,19.5,3,SLATE_SKIN);}
  } else if(kind==='amphitheater') {
    // Alternate terraced fan and paired grandstands around the stage.
    slab(15,4,20,9,.6,2,paving);pergola(14,3,22,11,15);put(15,4,20,1,3,9,red);
    for(let k=0;k<5;k++){
      const a=v===1?5+k*2:4,b=19+k*5,w=v===1?38-k*4:14;
      put(a,b,w,3,.6,k*1.4+2,k%2?paving:SLATE_SKIN);
      if(v===2)put(29,b,14,3,.6,k*1.4+2,k%2?paving:SLATE_SKIN);
    }
  } else if(kind==='farm') {
    if(v===1){hall(3,3,16,16,11,BRICK,'hip');put(23,5,7,7,.6,18,TIMBER);put(22,4,9,9,18.6,1,SLATE_SKIN);for(let b=24;b<44;b+=5)slab(3,b,39,2,.6,1.3,crops);}
    else {hall(3,3,18,12,8,RUST,'hip');for(const a of [26,36]){put(a,3,7,16,.6,7,water);put(a-.5,2.5,8,17,7.6,1,paving);}for(let a=4;a<44;a+=6)slab(a,25,2,19,.6,1.5,crops);}
    slab(2,20,44,3,.6,.3,soil);
  } else if(kind==='cemetery') {
    const graves=(x,y)=>{put(x,y,2,1,.6,3.5,paving);slab(x,y+1,2,3,.6,.15,soil);};
    if(v===1){hall(17,3,14,10,9,CONC_WALL,'hip');for(const a of [4,11,33,40])for(let b=6;b<44;b+=7)graves(a,b);slab(20,15,8,32);fountain(19,25);}
    else {hall(4,4,10,10,11,CONC_WALL,'hip');for(let a=18;a<44;a+=7)for(const b of [5,12,32,39])graves(a,b);for(const a of [5,12])for(const b of [25,33,41])graves(a,b);slab(15,19,28,7);put(30,21,3,3,.6,13,paving);}
    bench(17,40);bench(32,25);
  } else if(kind==='sanitation') {
    hall(v===1?3:31,3,v===1?41:13,v===1?10:28,11);
    for(const [a,b,w,d]of (v===1?[[3,19,17,24],[27,19,17,24]]:[[3,3,22,15],[3,25,22,18]])){
      slab(a,b,w,d,.6,4,paving);slab(a+1,b+1,w-2,d-2,4.6,.4,water);put(a,b+d/2,w,1,5,1,SLATE_SKIN);
    }
    if(v===2){put(34,34,8,8,.6,13,TIMBER);put(33.5,33.5,9,9,13.6,1,paving);}
  } else if(kind==='garbage') {
    if(v===1){hall(3,3,17,32,16,RUST);hall(23,3,21,12,10);for(const b of [21,32]){put(26,b,16,7,.6,5,TIMBER);put(25.5,b-.5,17,8,5.6,.6,SLATE_SKIN);}}
    else {hall(3,3,40,16,10,RUST);pergola(3,25,18,17,10);for(const a of [25,35]){put(a,28,7,13,.6,5,TIMBER);put(a-.5,27.5,8,14,5.6,1,SLATE_SKIN);}}
  } else if(kind==='park'||kind==='largePark') {
    if(v===1){pergola(3,3,15,15);if(side>1)fountain(25,6);bench(25,22);bench(6,26);for(const [a,b]of [[3,37],[17,37],[33,35]])planter(a,b,10,8);}
    else {if(side>1)fountain(19,18);pergola(28,3,15,10);bench(4,18);bench(30,32);for(const [a,b]of [[3,3],[4,35],[34,17]])planter(a,b,9,9);}
  }
  if(kind==='park'||kind==='largePark'){
    const places=side===1?[[TREE_ROUND,24,26]]:v===1?[[TREE_ROUND,8,39],[TREE_TALL,39,38],[TREE_WILLOW,22,17]]:[[TREE_WILLOW,8,9],[TREE_ROUND,39,22],[TREE_TALL,8,39]];
    for(const [tree,a,b]of places)stamps.push([tree,a*q,b*q,.8*z]);
  }
  return {boxes,stamps};
}

export const CIVIC_VARIANT_ROSTER = [['park',1],['largePark',2],['largePark',3],['fire',1],['fire',3],['police',1],['police',3],['centre',1],['centre',3],['zoo',3],['library',2],['gallery',2],['university',3],['amphitheater',3],['farm',2],['cemetery',2],['cemetery',6],['doctor',2],['hospital',3],['sanitation',3],['garbage',2]];
export const CIVIC_VARIANT_FAMILIES = CIVIC_VARIANT_ROSTER.map(([kind,side])=>{
  const base=civicSprite(kind,side), n=side*16;
  const alternatives=[1,2].map(v=>{const {boxes,stamps}=layout(kind,side,v);return solidSprite(`civic-${kind}-${side}x${side}-layout-${v}`,boxes,{hub:n/2,footprint:[side,side],tags:['civic',kind],stamps,extent:[box(0,n,0,n,0,52*Math.sqrt(side/3),{})]});});
  registerCivicVariations(base,alternatives);
  return {kind,side,sprites:[base,...alternatives]};
});
export const allCivicVariations=()=>CIVIC_VARIANT_FAMILIES.flatMap(f=>f.sprites.slice(1).map(sprite=>({name:sprite.name,sprite})));
