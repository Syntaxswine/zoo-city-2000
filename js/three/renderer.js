// A source-only WebGL renderer for the original simulation; no network dependencies.
import { toWorld, toScreen } from '../iso/iso.js';
import { isPart, sideOf, civicAnchorOf, civicSideOf, CIVIC } from '../sim/world.js';
import { cameraAt, project, screenRay, hitBox, add, canStand, moveAnimal } from './space.js';
import { lotScore } from '../sim/lots.js';
import { useTint } from '../sim/use.js';

const COLORS = [[0.45,0.57,0.34],[0.65,0.72,0.46],[0.52,0.67,0.74],[0.76,0.57,0.36],[0.65,0.34,0.29]];
const FACES = [
  [[0,0,0],[0,1,0],[1,1,0],[1,0,0],0.72], [[1,0,1],[1,1,1],[0,1,1],[0,0,1],0.9],
  [[0,0,1],[0,1,1],[0,1,0],[0,0,0],0.65], [[1,0,0],[1,1,0],[1,1,1],[1,0,1],0.84],
  [[0,1,0],[0,1,1],[1,1,1],[1,1,0],1.12], [[0,0,1],[0,0,0],[1,0,0],[1,0,1],0.5]
];
function box(out, x, y, z, w, h, d, color) {
  for (const face of FACES) for (const j of [0,1,2,0,2,3]) {
    const p = face[j]; out.push(x+p[0]*w,y+p[1]*h,z+p[2]*d,...color.map(v => v*face[4]));
  }
}
function animal(out, x, z, species, time, player = false) {
  const fur = species === 'fox' ? [0.86,0.4,0.15] : species === 'bear' ? [0.43,0.29,0.2] : species === 'raccoon' ? [0.44,0.47,0.49] : [0.78,0.72,0.61];
  const shirt = player ? [0.94,0.51,0.2] : [0.24,0.4,0.5];
  const bob = Math.sin(time*9)*0.018;
  box(out,x-.12,.18+bob,z-.09,.24,.25,.18,shirt);
  box(out,x-.13,.43+bob,z-.12,.26,.23,.24,fur);
  for (const s of [-1,1]) {
    box(out,x+s*.07-.035,.65+bob,z-.04,.07,species==='rabbit'?.23:.09,.08,fur);
    box(out,x+s*.065-.028,.04,z-.05+Math.sin(time*9+s)*.025,.056,.16,.1,[.19,.22,.25]);
    box(out,x+s*.065-.019,.54+bob,z+.122,.038,.036,.01,[.08,.09,.09]);
  }
  box(out,x-.035,.48+bob,z+.13,.07,.045,.045,[.3,.2,.19]);
}
export function create3DRenderer(canvas, initialWorld, app) {
  const gl = canvas.getContext('webgl', {alpha:false, antialias:true});
  if (!gl) throw new Error('Zoo Thefttopia 2000 needs WebGL. Enable hardware acceleration and reload.');
  let world = initialWorld, dirty = true, staticCount = 0, boxes = [], camera, clock = 0;
  let yaw = Math.PI/4, pitch = .72, distance = 35, street = false, orbit = null;
  let lastZoom = 1, overlayKey = '', overlayCount = 0;
  const player = {x:0,z:0,species:'rabbit'}, held = new Set();
  const shader = (type, source) => {
    const s = gl.createShader(type); gl.shaderSource(s,source); gl.compileShader(s);
    if (!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const program = gl.createProgram();
  gl.attachShader(program,shader(gl.VERTEX_SHADER,`
    attribute vec3 position; attribute vec3 color;
    uniform vec3 eye; uniform vec3 forward; uniform vec3 right; uniform vec3 up;
    uniform float aspect; varying vec3 tint; varying float depth;
    void main(){ vec3 p=position-eye; float z=dot(p,forward);
      gl_Position=vec4(dot(p,right)*1.8/aspect,dot(p,up)*1.8,1.0008*z-0.160064,z);
      tint=color; depth=z; }`));
  gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`
    precision mediump float; varying vec3 tint; varying float depth;
    void main(){ float fog=smoothstep(25.0,125.0,depth)*0.8;
      gl_FragColor=vec4(mix(tint,vec3(0.66,0.76,0.78),fog),1.0); }`));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program); gl.enable(gl.DEPTH_TEST);
  const locations = Object.fromEntries(['eye','forward','right','up','aspect'].map(n=>[n,gl.getUniformLocation(program,n)]));
  const pos = gl.getAttribLocation(program,'position'), col = gl.getAttribLocation(program,'color');
  const staticBuffer = gl.createBuffer(), dynamicBuffer = gl.createBuffer(), overlayBuffer = gl.createBuffer();
  function upload(buffer, data, usage) { gl.bindBuffer(gl.ARRAY_BUFFER,buffer); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),usage); }
  function render(buffer, count) {
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer); gl.enableVertexAttribArray(pos); gl.enableVertexAttribArray(col);
    gl.vertexAttribPointer(pos,3,gl.FLOAT,false,24,0); gl.vertexAttribPointer(col,3,gl.FLOAT,false,24,12);
    gl.drawArrays(gl.TRIANGLES,0,count);
  }
  function rebuild() {
    const out=[]; boxes=[];
    for(let i=0;i<world.w*world.h;i++) {
      const x=i%world.w,z=Math.floor(i/world.w), water=world.terrain[i]===1;
      const zone=world.zone[i], civic=world.civic[i], road=world.road[i];
      let color=water?[.24,.48,.57]:COLORS[zone] || COLORS[0];
      if (!water && !zone) color=color.map(v=>v+((x*7+z*13)%9)*.003);
      if (world.rubble[i]) color=[.39,.35,.3];
      box(out,x,-.16,z,1,.15,1,color);
      if (road) {
        box(out,x,.005,z,1,.04,1,[.27,.3,.31]);
        box(out,x+.46,.047,z+.38,.08,.008,.24,[.85,.79,.53]);
      }
      if (world.rail[i]) {
        for (const k of [.3,.7]) box(out,x+k,.065,z,.035,.035,1,[.56,.58,.57]);
        for (const k of [.15,.45,.75]) box(out,x+.18,.05,z+k,.65,.03,.09,[.35,.26,.2]);
        if(world.rail[i]===2) box(out,x+.02,.05,z,.18,.12,1,[.75,.71,.6]);
      }
      if (world.wall[i] && !road && !world.rail[i]) box(out,x+.4,0,z,.2,.7,1,[.49,.46,.4]);
      if (world.cam[i]) { box(out,x+.83,0,z+.83,.04,.65,.04,[.24,.25,.25]); box(out,x+.77,.6,z+.78,.17,.08,.08,[.77,.77,.7]); }
      if(isPart(world,i) || (civic && civicAnchorOf(world,i)!==i)) continue;
      const park=civic===CIVIC.PARK || civic===CIVIC.LARGE_PARK;
      if ((world.terrain[i]===2 && !road && !zone && !civic) || park) {
        box(out,x+.44,0,z+.44,.12,.55,.12,[.38,.27,.17]);
        box(out,x+.18,.4,z+.18,.64,.65,.64,[.28,.46,.26]);
        box(out,x+.28,1,z+.28,.44,.23,.44,[.37,.55,.29]);
      }
      if ((!world.tier[i] || !zone) && (!civic || park)) continue;
      const side=civic?civicSideOf(world,i):sideOf(world,i);
      const h=civic?1.1+side*.2:.45+world.tier[i]*.58;
      const c=civic?([4,5,6,8].includes(civic)?[.55,.58,.59]:[.78,.73,.57]):COLORS[zone];
      const b=[x+.1,0,z+.1,x+side-.1,h,z+side-.1]; boxes.push({b,tile:i});
      box(out,b[0],0,b[2],side-.2,h,side-.2,c);
      box(out,x+.06,h,z+.06,side-.12,.12,side-.12,zone===1?[.43,.29,.25]:[.36,.39,.39]);
      for(let y=.3;y<h-.12;y+=.43) for(let k=.24;k<side-.2;k+=.38) {
        box(out,x+k,y,z+.087,.16,.19,.018,[.87,.81,.53]);
        box(out,x+k,y,z+side-.105,.16,.19,.018,[.87,.81,.53]);
        box(out,x+.087,y,z+k,.018,.19,.16,[.55,.7,.72]);
        box(out,x+side-.105,y,z+k,.018,.19,.16,[.55,.7,.72]);
      }
      box(out,x+side/2-.09,0,z+side-.09,.18,.28,.025,[.25,.26,.24]);
      if(zone===3) box(out,x+.2,h,z+.2,.18,.6,.18,[.41,.36,.31]);
      if(civic) box(out,x+side/2-.2,h+.12,z+side/2-.2,.4,.24,.4,civic===5?[.24,.4,.65]:[.76,.4,.27]);
    }
    upload(staticBuffer,out,gl.STATIC_DRAW); staticCount=out.length/6; dirty=false; overlayKey='';
  }
  const hud=document.createElement('div'); hud.className='three-hud';
  hud.innerHTML='<div class="three-modes"><button type="button" data-mode="city">CITY BUILDER</button><button type="button" data-mode="street">WALK THE CITY</button><select aria-label="Your animal"><option value="rabbit">Rabbit</option><option value="fox">Fox</option><option value="raccoon">Raccoon</option><option value="bear">Bear</option></select></div><div class="three-help"></div>';
  canvas.parentElement.append(hud);
  const help=hud.querySelector('.three-help');
  function label() {
    hud.querySelector('[data-mode="city"]').setAttribute('aria-pressed',String(!street));
    hud.querySelector('[data-mode="street"]').setAttribute('aria-pressed',String(street));
    help.textContent=street?'WASD / arrows walk · Shift run · right-drag look · E meet resident · F2 build':'WASD / arrows pan · right-drag orbit · scroll zoom · F2 walk';
    document.body.classList.toggle('street-mode',street);
  }
  function spawn() {
    const focus=toWorld(app.camera.x,app.camera.y); let best=Infinity, tile=-1;
    for(let i=0;i<world.w*world.h;i++) {
      const x=i%world.w+.5,z=Math.floor(i/world.w)+.5;
      if(!canStand(world,x,z)) continue;
      const score=Math.hypot(x-focus[0],z-focus[1])+(world.road[i]?0:8);
      if(score<best){best=score;tile=i;}
    }
    if(tile<0) return false;
    player.x=tile%world.w+.5; player.z=Math.floor(tile/world.w)+.5;
    for(const [dx,dz,angle] of [[0,1,0],[1,0,Math.PI/2],[0,-1,Math.PI],[-1,0,-Math.PI/2]]) {
      if(canStand(world,player.x+dx,player.z+dz) && canStand(world,player.x+dx*2,player.z+dz*2)){yaw=angle;break;}
    }
    return true;
  }
  function setMode(next) {
    if(app.ui?.modalOpen()) return;
    if(next && !spawn()){app.ui.flash('No clear ground to walk on.');return;}
    if(street && !next) [app.camera.x,app.camera.y]=toScreen(player.x,player.z);
    street=next; held.clear(); orbit=null; app.stopFollowing?.();
    if(app.input){app.input.state.drag=null;app.input.state.pan=null;app.input.unpin();app.input.setTool('inspect');}
    label(); resize(); canvas.focus();
  }
  hud.querySelector('[data-mode="city"]').onclick=()=>setMode(false);
  hud.querySelector('[data-mode="street"]').onclick=()=>setMode(true);
  hud.querySelector('select').onchange=e=>{player.species=e.target.value;canvas.focus();};
  label();
  const movement=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'];
  function meet() {
    const near=app.walkers.list().filter(w=>w.citizen!=null).map(w=>({w,d:Math.hypot(w.tx+.5-player.x,w.ty+.5-player.z)})).sort((a,b)=>a.d-b.d)[0];
    if(near?.d<2.5){app.input.pinCitizen(near.w.citizen);app.ui.flash(`Meet ${near.w.name}`);}
    else app.ui.flash('Walk closer to a resident to meet them.');
  }
  window.addEventListener('keydown',e=>{
    if(app.ui?.modalOpen() || e.target.closest?.('input,textarea,select,[contenteditable="true"]') || e.ctrlKey || e.metaKey || e.altKey) return;
    if(e.code==='F2'){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)setMode(!street);return;}
    if(movement.includes(e.code)){held.add(e.code);e.preventDefault();e.stopImmediatePropagation();}
    else if(street && e.code==='KeyE'){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)meet();}
  },true);
  window.addEventListener('keyup',e=>held.delete(e.code),true);
  window.addEventListener('blur',()=>{held.clear();orbit=null;});
  canvas.addEventListener('pointerdown',e=>{
    if(app.ui?.modalOpen())return;
    if(e.button===2 || e.button===1 || street){e.stopImmediatePropagation();e.preventDefault();canvas.focus();canvas.setPointerCapture(e.pointerId);orbit={x:e.clientX,y:e.clientY};}
  },true);
  canvas.addEventListener('pointermove',e=>{
    if(orbit){yaw-=(e.clientX-orbit.x)*.008;if(!street)pitch=Math.max(.25,Math.min(1.35,pitch+(e.clientY-orbit.y)*.005));orbit={x:e.clientX,y:e.clientY};e.stopImmediatePropagation();}
    else if(street)e.stopImmediatePropagation();
  },true);
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{if(orbit||street){orbit=null;e.stopImmediatePropagation();}},true);
  canvas.addEventListener('wheel',e=>{e.preventDefault();e.stopImmediatePropagation();distance=Math.max(5,Math.min(85,distance*Math.exp(e.deltaY*.001)));},{capture:true,passive:false});
  function update(dt) {
    if(app.ui?.modalOpen()){held.clear();return;}
    const dx=Number(held.has('KeyD')||held.has('ArrowRight'))-Number(held.has('KeyA')||held.has('ArrowLeft'));
    const dz=Number(held.has('KeyS')||held.has('ArrowDown'))-Number(held.has('KeyW')||held.has('ArrowUp'));
    if(!dx&&!dz)return;
    const speed=(street?(held.has('ShiftLeft')||held.has('ShiftRight')?3:1.5):distance*.45)*dt/Math.hypot(dx,dz);
    const x=(dx*Math.cos(yaw)+dz*Math.sin(yaw))*speed,z=(-dx*Math.sin(yaw)+dz*Math.cos(yaw))*speed;
    app.stopFollowing?.();
    if(street)moveAnimal(world,player,x,z);
    else {const p=toWorld(app.camera.x,app.camera.y);[app.camera.x,app.camera.y]=toScreen(p[0]+x,p[1]+z);}
  }
  function resize(){canvas.width=Math.max(1,canvas.clientWidth);canvas.height=Math.max(1,canvas.clientHeight);gl.viewport(0,0,canvas.width,canvas.height);}
  function syncCamera(c=app.camera){
    const p=toWorld(c.x,c.y);
    camera=cameraAt(street?[player.x,.5,player.z]:[p[0],0,p[1]],yaw,street?.3:pitch,street?3.5:distance,canvas.width/canvas.height);
    if(street){ // Rise above obstructions instead of pushing the camera inside the avatar.
      for(let angle=.4;angle<=1.5;angle+=.1){
        const dir=add(camera.eye,[player.x,.5,player.z],-1);
        if(!boxes.some(obj=>hitBox([player.x,.5,player.z],dir,obj.b)<1.08))break;
        camera=cameraAt([player.x,.5,player.z],yaw,angle,3.5,canvas.width/canvas.height);
      }
    }
  }
  function draw(c,hover,walkers,overlay,dt=1/60){
    if(gl.isContextLost())return;
    if(dirty)rebuild();
    if(street&&!canStand(world,player.x,player.z)&&!spawn())setMode(false);
    if(c.zoom!==lastZoom){distance=Math.max(5,Math.min(85,distance*lastZoom/c.zoom));lastZoom=c.zoom;}
    clock+=dt;syncCamera(c);gl.clearColor(.66,.76,.78,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    for(const n of ['eye','forward','right','up'])gl.uniform3fv(locations[n],camera[n]);
    gl.uniform1f(locations.aspect,camera.aspect);render(staticBuffer,staticCount);
    const out=[];
    for(const w of walkers.list())animal(out,w.tx+.5,w.ty+.5,w.species,app.paused?0:clock);
    if(street)animal(out,player.x,player.z,player.species,held.size?clock:0,true);
    if(!street&&hover?.tx>=0){
      const tiles=hover.drag?.tiles || [hover.ty*world.w+hover.tx];
      for(const tile of tiles){const i=typeof tile==='number'?tile:tile.i;if(i==null)continue;box(out,i%world.w,.06,Math.floor(i/world.w),1,.015,1,hover.drag?.refused?[.9,.25,.2]:[.85,.86,.46]);}
      if(hover.ghost)for(let z=0;z<hover.ghost.h;z++)for(let x=0;x<hover.ghost.w;x++)box(out,hover.tx+x,.06,hover.ty+z,1,.02,1,hover.ghost.ok?[.65,.85,.5]:[.9,.3,.2]);
    }
    if(!street && overlay!=='off'){
      if(overlayKey!==overlay){
        const mesh=[];
        for(let i=0;i<world.w*world.h;i++){
          const field=overlay==='watch'?world.camCov:overlay==='access'?world.roadDist:world[overlay];
          if(overlay==='score'&&!world.zone[i])continue;
          const value=overlay==='score'?lotScore(world,i).score:field?.[i];if(typeof value!=='number')continue;
          const t=Math.max(0,Math.min(1,value/(overlay==='culture'?8:100)));
          let color=[.3+t*.6,.7-t*.4,.35];
          if(overlay==='lv'||overlay==='knowledge'||overlay==='culture')color=[.7-t*.4,.45+t*.35,.35];
          if(overlay==='watch')color=[.65-t*.4,.6-t*.2,.4+t*.4];
          if(overlay==='score')color=value>0?[.35,.6,.85]:[.8,.3,.25];
          if(overlay==='access'){if(value===0)continue;color=([[.96,.91,.78],[.73,.51,.78],[.36,.22,.51]][value-1]||[.75,.27,.24]);}
          if(overlay==='use'){const tint=useTint(value);if(!tint)continue;color=tint.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255);}
          box(mesh,i%world.w,.05,Math.floor(i/world.w),.96,.02,.96,color);
        }
        upload(overlayBuffer,mesh,gl.STATIC_DRAW);overlayCount=mesh.length/6;overlayKey=overlay;
      }
      render(overlayBuffer,overlayCount);
    }
    for(let i=0;i<world.burning.length;i++)if(world.burning[i])box(out,i%world.w+.25,.2,Math.floor(i/world.w)+.25,.5,1.5+Math.sin(clock*8)*.2,.5,[1,.4,.1]);
    upload(dynamicBuffer,out,gl.DYNAMIC_DRAW);render(dynamicBuffer,out.length/6);
  }
  function pick(x,y,c=app.camera){
    if(street)return null;if(dirty)rebuild();syncCamera(c);
    const dir=screenRay(x,y,camera,canvas.width,canvas.height);
    let t=dir[1]<-1e-9?-camera.eye[1]/dir[1]:Infinity, tile=null;
    if(t>0&&Number.isFinite(t)){const p=add(camera.eye,dir,t),tx=Math.floor(p[0]),tz=Math.floor(p[2]);if(tx>=0&&tz>=0&&tx<world.w&&tz<world.h)tile=[tx,tz];}
    for(const o of boxes){const hit=hitBox(camera.eye,dir,o.b);if(hit<t){t=hit;tile=[o.tile%world.w,Math.floor(o.tile/world.w)];}}
    return tile;
  }
  function pickWalker(x,y,list){
    if(!camera||street)return null;
    const dir=screenRay(x,y,camera,canvas.width,canvas.height);let nearest=Infinity,best=null;
    for(const w of list||[]){const hit=hitBox(camera.eye,dir,[w.tx+.32,0,w.ty+.32,w.tx+.68,.9,w.ty+.68]);if(hit<nearest){nearest=hit;best=w;}}
    if(best)for(const o of boxes)if(hitBox(camera.eye,dir,o.b)<nearest)return null;
    return best;
  }
  resize();
  new ResizeObserver(resize).observe(canvas);
  return {draw,update,resize,pick,pickWalker,setMode,player,get street(){return street;},
    invalidate(){dirty=true;},setWorld(w){world=w;dirty=true;street=false;held.clear();label();},
    viewportTiles(){return {x0:0,y0:0,x1:world.w-1,y1:world.h-1};},
    tileToScreen(tx,ty){return camera?project([tx+.5,0,ty+.5],camera,canvas.width,canvas.height)?.slice(0,2)||[-1000,-1000]:[0,0];}
  };
}
