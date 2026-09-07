// A source-only WebGL renderer for the original simulation; no network dependencies.
import { toWorld, toScreen } from '../iso/iso.js';
import { isPart, sideOf, civicAnchorOf, civicSideOf, CIVIC } from '../sim/world.js';
import { cameraAt, project, screenRay, hitBox, add, canStand, moveAnimal } from './space.js';
import { lotScore } from '../sim/lots.js';
import { useTint } from '../sim/use.js';
import { box, tree, architecture, animalMesh, STRIDE } from './meshes.js';

const COLORS = [[0.45,0.57,0.34],[0.65,0.72,0.46],[0.52,0.67,0.74],[0.76,0.57,0.36],[0.65,0.34,0.29]];
export function create3DRenderer(canvas, initialWorld, app) {
  const gl = canvas.getContext('webgl', {alpha:false, antialias:true});
  if (!gl) throw new Error('Zoo Thefttopia 2000 needs WebGL. Enable hardware acceleration and reload.');
  let world = initialWorld, dirty = true, staticCount = 0, boxes = [], camera, clock = 0;
  let yaw = Math.PI/4, pitch = .72, distance = 35, street = false, orbit = null;
  let lastZoom = 1, overlayKey = '', overlayCount = 0, staticSignature = null;
  let measuredFrames=0,measuredSeconds=0;
  let shadowCenter=[initialWorld.w/2,0,initialWorld.h/2],shadowSpan=Math.max(initialWorld.w,initialWorld.h)*1.7,shadowStreet=false;
  const player = {x:0,z:0,species:'rabbit'}, held = new Set();
  const shader = (type, source) => {
    const s = gl.createShader(type); gl.shaderSource(s,source); gl.compileShader(s);
    if (!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const program = gl.createProgram();
  gl.attachShader(program,shader(gl.VERTEX_SHADER,`
    attribute vec3 position; attribute vec3 color; attribute vec3 normal;
    uniform vec3 eye; uniform vec3 forward; uniform vec3 right; uniform vec3 up;
    uniform float aspect; uniform vec3 offset; uniform float angle; uniform float phase; uniform float animated;
    varying vec3 tint; varying float depth; varying vec3 worldPoint; varying vec3 worldNormal;
    void main(){
      mat3 turn=mat3(cos(angle),0.0,-sin(angle),0.0,1.0,0.0,sin(angle),0.0,cos(angle));
      vec3 local=position;
      local.z+=animated*step(local.y,0.22)*sin(phase+sign(local.x)*1.5708)*0.045;
      worldPoint=turn*local+offset; worldNormal=turn*normal;
      vec3 p=worldPoint-eye; float z=dot(p,forward);
      gl_Position=vec4(dot(p,right)*1.8/aspect,dot(p,up)*1.8,1.0008*z-0.160064,z);
      tint=color; depth=z; }`));
  gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`
    precision highp float; varying vec3 tint; varying float depth; varying vec3 worldPoint; varying vec3 worldNormal;
    uniform vec3 eye; uniform sampler2D sunDepth; uniform float shadowOn; uniform vec2 worldSize;uniform vec3 shadowCenter;uniform float shadowSpan;
    vec3 sunCoord(vec3 p){p-=shadowCenter;float span=max(worldSize.x,worldSize.y)*1.7;
      return vec3(dot(p,vec3(.514496,0.0,-.857493))/shadowSpan,dot(p,vec3(-.74076,.503718,-.444457))/shadowSpan,dot(p,vec3(-.431934,-.863868,-.259161))/span)+.5;}
    void main(){
      vec3 n=normalize(worldNormal),sun=normalize(vec3(.5,1.0,.3)),sc=sunCoord(worldPoint+n*.035);
      float shade=0.0;
      for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
        float stored=texture2D(sunDepth,sc.xy+vec2(float(x),float(y))/2048.0).r;
        shade+=step(sc.z-(.0004+.0012*(1.0-max(0.0,dot(n,sun)))),stored)/9.0;
      }
      shade=mix(1.0,shade,shadowOn);
      if(sc.x<.01||sc.x>.99||sc.y<.01||sc.y>.99)shade=1.0;
      float diffuse=max(0.0,dot(n,sun));
      vec3 light=vec3(.38,.43,.48)+vec3(.77,.68,.51)*diffuse*shade;
      light+=vec3(.11,.12,.1)*max(0.0,n.y);
      float spec=pow(max(0.0,dot(n,normalize(sun+normalize(eye-worldPoint)))),40.0)*.13*shade;
      float grain=fract(sin(dot(floor(worldPoint*180.0),vec3(12.9898,78.233,35.719)))*43758.5453);
      vec3 lit=tint*light*(.97+.045*grain)+spec;
      float fog=smoothstep(18.0,105.0,depth)*.72;
      gl_FragColor=vec4(mix(lit,vec3(.72,.81,.84),fog),1.0); }`));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program); gl.enable(gl.DEPTH_TEST);
  const locations = Object.fromEntries(['eye','forward','right','up','aspect','offset','angle','phase','animated','sunDepth','shadowOn','worldSize','shadowCenter','shadowSpan'].map(n=>[n,gl.getUniformLocation(program,n)]));
  const pos = gl.getAttribLocation(program,'position'), col = gl.getAttribLocation(program,'color'), normal = gl.getAttribLocation(program,'normal');
  const staticBuffer = gl.createBuffer(), dynamicBuffer = gl.createBuffer(), overlayBuffer = gl.createBuffer();
  function upload(buffer, data, usage) { gl.bindBuffer(gl.ARRAY_BUFFER,buffer); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),usage); }
  function render(buffer, count) {
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer); gl.enableVertexAttribArray(pos); gl.enableVertexAttribArray(col);
    gl.vertexAttribPointer(pos,3,gl.FLOAT,false,36,0); gl.vertexAttribPointer(col,3,gl.FLOAT,false,36,12);
    gl.enableVertexAttribArray(normal); gl.vertexAttribPointer(normal,3,gl.FLOAT,false,36,24);
    gl.drawArrays(gl.TRIANGLES,0,count);
  }
  // Static city shadows are regenerated only when the city mesh changes.
  const depthExtension=gl.getExtension('WEBGL_depth_texture');
  const shadowTexture=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,shadowTexture);
  for(const [key,value] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,key,value);
  let shadowFramebuffer=null,shadowProgram=null;
  if(depthExtension){
    gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT,2048,2048,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_SHORT,null);
    shadowFramebuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,shadowTexture,0);
    const colorTarget=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,colorTarget);
    gl.renderbufferStorage(gl.RENDERBUFFER,gl.RGBA4,2048,2048);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,colorTarget);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)shadowFramebuffer=null;
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    shadowProgram=gl.createProgram();
    gl.attachShader(shadowProgram,shader(gl.VERTEX_SHADER,`attribute vec3 position;uniform vec2 worldSize;uniform vec3 shadowCenter;uniform float shadowSpan;
      void main(){vec3 p=position-shadowCenter;float span=max(worldSize.x,worldSize.y)*1.7;
      gl_Position=vec4(vec3(dot(p,vec3(.514496,0.0,-.857493))/shadowSpan,dot(p,vec3(-.74076,.503718,-.444457))/shadowSpan,dot(p,vec3(-.431934,-.863868,-.259161))/span)*2.0,1.0);}`));
    gl.attachShader(shadowProgram,shader(gl.FRAGMENT_SHADER,'precision mediump float;void main(){gl_FragColor=vec4(1.0);}'));
    gl.linkProgram(shadowProgram);
    if(!gl.getProgramParameter(shadowProgram,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(shadowProgram));
  }else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
  function shadowPass(){
    if(!shadowFramebuffer)return;
    shadowStreet=street;shadowCenter=street?[player.x,0,player.z]:[world.w/2,0,world.h/2];shadowSpan=street?20:Math.max(world.w,world.h)*1.7;
    gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFramebuffer);gl.viewport(0,0,2048,2048);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.useProgram(shadowProgram);gl.uniform2f(gl.getUniformLocation(shadowProgram,'worldSize'),world.w,world.h);
    gl.uniform3fv(gl.getUniformLocation(shadowProgram,'shadowCenter'),shadowCenter);gl.uniform1f(gl.getUniformLocation(shadowProgram,'shadowSpan'),shadowSpan);
    const a=gl.getAttribLocation(shadowProgram,'position');gl.bindBuffer(gl.ARRAY_BUFFER,staticBuffer);
    gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,36,0);
    gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(2,4);gl.drawArrays(gl.TRIANGLES,0,staticCount);gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);
  }
  const animals=new Map();
  function drawAnimal(x,z,species,isPlayer,facing,time,id){
    const distanceToEye=Math.hypot(x-camera.eye[0],z-camera.eye[2]);
    if(street&&distanceToEye>28)return;
    const detail=isPlayer||distanceToEye<10,key=`${species}:${isPlayer}:${detail}`;
    let mesh=animals.get(key);
    if(!mesh){const data=animalMesh(species,isPlayer,detail),buffer=gl.createBuffer();upload(buffer,data,gl.STATIC_DRAW);mesh={buffer,count:data.length/STRIDE};animals.set(key,mesh);}
    const direction=isPlayer?player.angle||0:({se:0,sw:Math.PI/2,nw:Math.PI,ne:-Math.PI/2}[facing]||0);
    gl.uniform3f(locations.offset,x,time?Math.sin(time*9+(id||0))*.009:0,z);
    gl.uniform1f(locations.angle,direction);gl.uniform1f(locations.phase,time*9+(id||0));gl.uniform1f(locations.animated,time?1:0);
    render(mesh.buffer,mesh.count);
  }
  function rebuild() {
    // Ticks invalidate overlays even when no geometry changed. Avoid regenerating
    // hundreds of thousands of triangles merely because the calendar advanced.
    let signature=`${world.w}:${world.h}:`;
    for(const field of ['terrain','zone','civic','civicSize','road','rail','wall','cam','tier','big','rubble'])signature+=String.fromCharCode(...world[field]);
    dirty=false;overlayKey='';
    if(signature===staticSignature)return;
    staticSignature=signature;
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
        tree(out,x,z,(x*3+z)%4);
      }
      if ((!world.tier[i] || !zone) && (!civic || park)) continue;
      const side=civic?civicSideOf(world,i):sideOf(world,i);
      const h=civic?1.1+side*.2:.45+world.tier[i]*.58;
      const top=civic?.51:zone===3?.86:zone===1?.36:.3;
      const b=[x+.04,0,z+.04,x+side-.04,h+top,z+side-.04]; boxes.push({b,tile:i});
      architecture(out,x,z,side,h,zone,civic,i%7);
    }
    upload(staticBuffer,out,gl.STATIC_DRAW); staticCount=out.length/STRIDE; dirty=false; overlayKey='';shadowPass();
    canvas.dataset.sceneTriangles=String(staticCount/3);
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
    player.angle=yaw+Math.PI;
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
    if(street){moveAnimal(world,player,x,z);player.angle=Math.atan2(x,z);}
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
    measuredFrames++;measuredSeconds+=dt;
    if(measuredFrames===60){canvas.dataset.frameMs=(measuredSeconds*1000/measuredFrames).toFixed(1);measuredFrames=0;measuredSeconds=0;}
    if(dirty)rebuild();
    if(shadowStreet!==street||(street&&Math.hypot(player.x-shadowCenter[0],player.z-shadowCenter[2])>2))shadowPass();
    if(street&&!canStand(world,player.x,player.z)&&!spawn())setMode(false);
    if(c.zoom!==lastZoom){distance=Math.max(5,Math.min(85,distance*lastZoom/c.zoom));lastZoom=c.zoom;}
    clock+=dt;syncCamera(c);gl.clearColor(.72,.81,.84,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    for(const n of ['eye','forward','right','up'])gl.uniform3fv(locations[n],camera[n]);
    gl.uniform1f(locations.aspect,camera.aspect);
    gl.uniform3f(locations.offset,0,0,0);gl.uniform1f(locations.angle,0);gl.uniform1f(locations.animated,0);
    gl.uniform2f(locations.worldSize,world.w,world.h);gl.uniform1f(locations.shadowOn,shadowFramebuffer?1:0);
    gl.uniform3fv(locations.shadowCenter,shadowCenter);gl.uniform1f(locations.shadowSpan,shadowSpan);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,shadowTexture);gl.uniform1i(locations.sunDepth,0);
    render(staticBuffer,staticCount);
    const out=[];

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
        upload(overlayBuffer,mesh,gl.STATIC_DRAW);overlayCount=mesh.length/STRIDE;overlayKey=overlay;
      }
      render(overlayBuffer,overlayCount);
    }
    for(let i=0;i<world.burning.length;i++)if(world.burning[i])box(out,i%world.w+.25,.2,Math.floor(i/world.w)+.25,.5,1.5+Math.sin(clock*8)*.2,.5,[1,.4,.1]);
    upload(dynamicBuffer,out,gl.DYNAMIC_DRAW);render(dynamicBuffer,out.length/STRIDE);
    for(const w of walkers.list())drawAnimal(w.tx+.5,w.ty+.5,w.species,false,w.facing,app.paused?0:clock,w.id);
    if(street)drawAnimal(player.x,player.z,player.species,true,null,held.size?clock:0,0);
    gl.uniform3f(locations.offset,0,0,0); gl.uniform1f(locations.angle,0);gl.uniform1f(locations.animated,0);
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
