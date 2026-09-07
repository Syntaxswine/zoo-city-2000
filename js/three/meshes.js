// Geometry is authored in world units. Every vertex is position/color/normal (9 floats).
export const STRIDE = 9;
const unit = v => { const l = Math.hypot(...v) || 1; return v.map(n => n/l); };
export function triangle(out, a, b, c, color, normals = null) {
  const u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]);
  const n=unit([u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]);
  for(const [i,p] of [a,b,c].entries()) out.push(...p,...color,...(normals?.[i]||n));
}
export function box(out,x,y,z,w,h,d,color) {
  const p=[[x,y,z],[x+w,y,z],[x+w,y+h,z],[x,y+h,z],[x,y,z+d],[x+w,y,z+d],[x+w,y+h,z+d],[x,y+h,z+d]];
  for(const [a,b,c,e] of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]){
    triangle(out,p[a],p[b],p[c],color);triangle(out,p[a],p[c],p[e],color);
  }
}
export function ellipsoid(out,x,y,z,rx,ry,rz,color,segments=20,rings=12) {
  const point=(j,k)=>{
    const a=j/segments*Math.PI*2,b=k/rings*Math.PI;
    const u=[Math.sin(b)*Math.cos(a),Math.cos(b),Math.sin(b)*Math.sin(a)];
    return {p:[x+u[0]*rx,y+u[1]*ry,z+u[2]*rz],n:unit([u[0]/rx,u[1]/ry,u[2]/rz])};
  };
  for(let k=0;k<rings;k++)for(let j=0;j<segments;j++){
    const a=point(j,k),b=point(j+1,k),c=point(j+1,k+1),d=point(j,k+1);
    if(k>0)triangle(out,a.p,b.p,d.p,color,[a.n,b.n,d.n]);
    if(k<rings-1)triangle(out,b.p,c.p,d.p,color,[b.n,c.n,d.n]);
  }
}
export function cylinder(out,x,y,z,radius,height,color,segments=20,topRadius=radius) {
  for(let j=0;j<segments;j++){
    const a=j/segments*Math.PI*2,b=(j+1)/segments*Math.PI*2;
    const p=[x+Math.cos(a)*radius,y,z+Math.sin(a)*radius],q=[x+Math.cos(b)*radius,y,z+Math.sin(b)*radius];
    const r=[x+Math.cos(a)*topRadius,y+height,z+Math.sin(a)*topRadius],s=[x+Math.cos(b)*topRadius,y+height,z+Math.sin(b)*topRadius];
    const n=unit([Math.cos(a),(radius-topRadius)/height,Math.sin(a)]),m=unit([Math.cos(b),(radius-topRadius)/height,Math.sin(b)]);
    triangle(out,p,r,q,color,[n,n,m]);triangle(out,q,r,s,color,[m,n,m]);
    triangle(out,[x,y,z],p,q,color);triangle(out,[x,y+height,z],s,r,color);
  }
}
export function roof(out,x,y,z,w,d,color) {
  const a=[x,y,z],b=[x+w,y,z],c=[x+w,y,z+d],e=[x,y,z+d],p=[x+w*.5,y+.32,z],q=[x+w*.5,y+.32,z+d];
  triangle(out,a,p,b,color);triangle(out,e,c,q,color);
  triangle(out,a,e,q,color);triangle(out,a,q,p,color);
  triangle(out,b,p,q,color);triangle(out,b,q,c,color);
}

const FUR={rabbit:[.76,.68,.56],fox:[.76,.29,.095],bear:[.27,.15,.09],raccoon:[.39,.42,.43],mouse:[.52,.48,.47],cat:[.69,.47,.27],wolf:[.45,.48,.5],beaver:[.38,.22,.1],pig:[.79,.49,.46],cow:[.79,.76,.65],owl:[.45,.3,.17],hawk:[.41,.24,.13],skunk:[.12,.13,.14],tortoise:[.39,.47,.24]};
export function animalMesh(species,player=false,detail=true) {
  const out=[],fur=FUR[species]||FUR.rabbit,cream=[.89,.84,.72],dark=[.075,.06,.05];
  const shirt=player?[.77,.25,.075]:[.17,.31,.37],seg=detail?24:10,rings=detail?16:6;
  const oval=(x,y,z,a,b,c,color)=>ellipsoid(out,x,y,z,a,b,c,color,seg,rings);
  oval(0,.35,0,.14,.185,.105,shirt);
  oval(0,.58,.006,.145,.14,.125,fur);
  oval(0,.53,.11,.097,.056,.075,cream);
  oval(0,.552,.173,.028,.023,.022,dark);
  // Jacket hem, collar, buttons, separate sleeves, hands, trousers and shoes.
  cylinder(out,0,.185,0,.107,.032,[.12,.16,.17],seg);
  for(const s of [-1,1]){
    oval(s*.145,.34,0,.05,.12,.057,shirt);oval(s*.16,.245,.015,.045,.047,.044,fur);
    oval(s*.067,.13,0,.048,.09,.048,[.15,.18,.2]);oval(s*.067,.05,.035,.057,.042,.095,[.095,.075,.06]);
    oval(s*.052,.451,.069,.054,.02,.027,cream);
    const eyeX=s*.064;
    oval(eyeX,.615,.112,.039,.044,.02,cream);oval(eyeX,.615,.13,.023,.028,.012,[.19,.12,.07]);
    oval(eyeX,.617,.14,.012,.02,.006,dark);oval(eyeX-.006,.627,.145,.005,.006,.003,[1,1,.97]);
    if(species==='rabbit'){
      oval(s*.071,.795,-.007,.045,.16,.038,fur);oval(s*.071,.799,.025,.023,.116,.01,[.7,.39,.35]);
    }else{
      const pointy=['fox','wolf','cat','hawk'].includes(species);
      oval(s*.12,.699,0,.058,pointy?.091:.056,.037,fur);
      oval(s*.12,.699,.033,.032,pointy?.054:.03,.008,[.63,.4,.34]);
    }
    if(species==='raccoon')oval(s*.071,.615,.105,.067,.045,.021,[.13,.14,.14]);
  }
  for(const y of [.25,.31,.37])oval(0,y,.107,.012,.012,.006,[.84,.7,.4]);
  oval(0,.24,-.113,species==='fox'?.075:.065,species==='fox'?.17:.065,.075,fur);
  if(species==='fox')oval(0,.13,-.14,.055,.065,.06,cream);
  if(species==='raccoon')for(let n=0;n<4;n++)oval(0,.22-n*.025,-.13-n*.016,.055,.016,.04,n%2?fur:dark);
  if(species==='tortoise')oval(0,.36,-.095,.14,.19,.075,[.21,.3,.1]);
  return new Float32Array(out);
}

export function tree(out,x,z,variant=0){
  cylinder(out,x+.5,0,z+.5,.065,.85,[.28,.17,.085],12,.042);
  const green=[.22+variant*.012,.36+variant*.016,.14];
  ellipsoid(out,x+.5,1,z+.5,.42,.51,.4,green,14,9);
  ellipsoid(out,x+.25,.86,z+.5,.25,.29,.28,green,12,8);
  ellipsoid(out,x+.7,.93,z+.62,.27,.32,.26,green,12,8);
}

export function architecture(out,x,z,side,h,zone,civic,variant){
  const cream=[.79,.74,.63],stone=[.49,.48,.44],roofColor=[.3,.16,.12],metal=[.22,.25,.26];
  const facades=[[.69,.6,.46],[.72,.66,.55],[.58,.63,.62],[.61,.41,.29]];
  const color=zone===3?[.54,.42,.32]:civic?[.63,.65,.62]:facades[variant%4];
  box(out,x+.1,0,z+.1,side-.2,h,side-.2,color);
  box(out,x+.075,.02,z+.075,side-.15,.13,side-.15,stone);
  for(let y=.43;y<h;y+=.43)box(out,x+.08,y,z+.08,side-.16,.035,side-.16,cream);
  box(out,x+.055,h-.025,z+.055,side-.11,.065,side-.11,cream);
  if(zone===1&&!civic)roof(out,x+.04,h+.04,z+.04,side-.08,side-.08,roofColor);
  else{
    box(out,x+.08,h+.03,z+.08,side-.16,.055,side-.16,metal);
    for(const k of [.08,side-.12]){box(out,x+k,h+.05,z+.08,.04,.12,side-.16,stone);box(out,x+.08,h+.05,z+k,side-.16,.12,.04,stone);}
    box(out,x+.26,h+.1,z+.3,.23,.15,.2,[.49,.53,.52]);
    for(let k=0;k<5;k++)box(out,x+.275+k*.038,h+.255,z+.31,.014,.01,.18,metal);
  }
  for(let y=.27;y<h-.12;y+=.43)for(let k=.25;k<side-.22;k+=.37){
    for(const back of [false,true]){
      const zz=z+(back?side-.095:.072);
      box(out,x+k-.018,y-.018,zz,.19,.23,.027,cream);
      box(out,x+k,y,zz+(back?.026:-.012),.15,.19,.014,[.22,.37,.42]);
      box(out,x+k+.072,y,zz+(back?.041:-.022),.012,.19,.012,cream);
      box(out,x+k-.03,y-.045,zz-.015,.22,.025,.065,cream);
    }
    for(const right of [false,true]){
      const xx=x+(right?side-.095:.073);
      box(out,xx,y-.018,z+k-.018,.027,.23,.19,cream);
      box(out,xx+(right?.026:-.012),y,z+k,.014,.19,.15,[.23,.37,.4]);
      box(out,xx-.01,y-.045,z+k-.03,.06,.025,.22,cream);
    }
  }
  for(const zz of [z+.077,z+side-.077]){
    box(out,x+side/2-.1,.05,zz,.2,.28,.03,[.2,.15,.11]);
    box(out,x+side/2-.12,.33,zz-.04,.24,.027,.11,cream);
    box(out,x+side/2-.14,.015,zz-.07,.28,.035,.14,stone);
  }
  if(zone===2)for(const zz of [z+.015,z+side-.16])for(let k=0;k<6;k++)box(out,x+.16+k*(side-.32)/6,.32,zz,(side-.32)/6,.04,.15,k%2?cream:[.17,.35,.31]);
  if(zone===3){
    cylinder(out,x+.27,h+.1,z+.27,.085,.72,[.38,.28,.22],24,.07);
    cylinder(out,x+.27,h+.8,z+.27,.102,.055,metal,24);
    cylinder(out,x+side-.3,h+.1,z+side-.3,.13,.29,[.56,.58,.56],24);
  }
  if(civic){
    for(let k=.25;k<side-.1;k+=.4)cylinder(out,x+k,0,z+side-.07,.035,.4,cream,16);
    box(out,x+side/2-.27,h+.08,z+side/2-.22,.54,.22,.44,stone);
    ellipsoid(out,x+side/2,h+.35,z+side/2,.16,.16,.16,civic===5?[.15,.3,.6]:[.64,.21,.12],20,12);
  }
}
