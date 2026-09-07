import assert from 'node:assert/strict';
import { cameraAt, project, screenRay, add, hitBox, canStand, moveAnimal } from '../js/three/space.js';
import { createWorld } from '../js/sim/world.js';
import { stateHash } from '../js/sim/save.js';
import { animalMesh, architecture, tree, STRIDE } from '../js/three/meshes.js';

// Projection and inverse agree across orbit, pitch and viewport aspect changes.
let checks = 0;
for (const yaw of [0, .7, 1.9, 3.5, 5.9]) for (const pitch of [.17,.6,1.3]) for (const aspect of [.6,1,2]) {
  const camera = cameraAt([10,0,10],yaw,pitch,20,aspect);
  for (const point of [[10,0,10],[8,0,12],[13,0,8]]) {
    const screen=project(point,camera,800*aspect,800);
    const ray=screenRay(screen[0],screen[1],camera,800*aspect,800);
    const ground=add(camera.eye,ray,-camera.eye[1]/ray[1]);
    assert.ok(Math.hypot(...ground.map((v,i)=>v-point[i]))<1e-8); checks++;
  }
}
assert.equal(hitBox([0,1,0],[0,0,1],[-1,0,2,1,2,3]),2);
assert.equal(hitBox([2,1,0],[0,0,1],[-1,0,2,1,2,3]),Infinity);
assert.equal(hitBox([0,1,0],[0,0,-1],[-1,0,2,1,2,3]),Infinity);
const w=createWorld({seed:'3d-collision'});
w.terrain.fill(0);w.road.fill(0);
const i=10*w.w+10;
for(const field of ['terrain','tier','wall','big','civic']) {
  w[field][i]=field==='civic'?7:1;
  assert.equal(canStand(w,10.5,10.5),false,field);
  w[field][i]=0;
}
w.terrain[i]=1;w.road[i]=2;assert.equal(canStand(w,10.5,10.5),true,'bridge walkable');
w.road[i]=0;w.terrain[i]=0;w.tier[i]=1;
const before=stateHash(w),p={x:9.5,z:10.5};
moveAnimal(w,p,5,0);
assert.ok(p.x<9.85,'cannot tunnel through building');
moveAnimal(w,p,0,2);assert.ok(p.z>12.4,'slides along wall');
assert.equal(canStand(w,-.1,10),false);
assert.equal(stateHash(w),before,'exploration cannot mutate simulation or RNG');
console.log(`3D: ${checks} projection round trips; ray occlusion, terrain, bridge, boundary, wall sliding and simulation isolation passed.`);

// Mesh normals must remain unit vectors, including flattened ellipsoids and
// cylinder caps; malformed normals make lighting break at different angles.
function auditMesh(data){
  assert.equal(data.length%(STRIDE*3),0);
  for(let i=0;i<data.length;i+=STRIDE){
    for(let k=0;k<STRIDE;k++)assert.ok(Number.isFinite(data[i+k]));
    assert.ok(Math.abs(Math.hypot(data[i+6],data[i+7],data[i+8])-1)<1e-5);
  }
}
for(const species of ['rabbit','fox','bear','raccoon','mouse','cat','wolf','beaver','pig','cow','owl','hawk','skunk','tortoise']){
  const high=animalMesh(species,true,true),low=animalMesh(species,false,false);
  auditMesh(high);auditMesh(low);
  assert.ok(high.length/27>15000);
  assert.ok(low.length<high.length/4,'distant animals have a lower geometry budget');
  assert.deepEqual(high,animalMesh(species,true,true),'mesh generation is deterministic');
}
for(const zone of [1,2,3,4])for(const side of [1,2,3]){
  const data=[];architecture(data,0,0,side,2.19,zone,0,2);auditMesh(data);
  for(let i=0;i<data.length;i+=STRIDE){assert.ok(data[i]>=0&&data[i]<=side);assert.ok(data[i+2]>=0&&data[i+2]<=side);}
}
const foliage=[];tree(foliage,0,0);auditMesh(foliage);
console.log('Detailed meshes: 14 species, near/far detail budgets, unit normals, finite vertices, deterministic geometry and building footprints passed.');
