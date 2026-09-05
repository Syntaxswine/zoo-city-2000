// Cosmetic history: tick + 1 at the last construction/expansion; zero is empty.
export function buildingSnapshot(world){return {tier:world.tier.slice(),big:world.big.slice()};}
export function syncBuildingAge(world,before){
 for(let i=0;i<world.tier.length;i++){
  if(!world.tier[i])world.since[i]=0;
  else if(world.tier[i]>before.tier[i]||world.big[i]!==before.big[i])world.since[i]=world.tick+1;
 }
}
export function buildingAge(world,i){return world.since?.[i]?Math.max(0,world.tick-(world.since[i]-1)):0;}
export function wearLevel(months){return months>=300?2:months>=180?1:0;}
