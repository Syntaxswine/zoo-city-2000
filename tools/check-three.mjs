import assert from 'node:assert/strict';
import { cameraAt, project, screenRay, add, hitBox, canStand, moveAnimal } from '../js/three/space.js';
import { createWorld } from '../js/sim/world.js';
import { stateHash } from '../js/sim/save.js';

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
