import {createWorld,ZONE,CIVIC} from '../js/sim/world.js';
import {createHousehold,placeHousehold,startCamping} from '../js/sim/citizens.js';
import {computeFields} from '../js/sim/fields.js';
import {census} from '../js/sim/census.js';
import {arrest,custodyTick} from '../js/sim/justice.js';
import {apply} from '../js/sim/ops.js';
import {save,load,stateHash} from '../js/sim/save.js';
import {pinTarget} from '../js/follow.js';
import {needOf} from '../js/sim/needs.js';
import {parseFollow,citizenFrame} from './play-follow.mjs';
import {probeSave,wholeYears} from './probe-save.mjs';

function fixture(){
 const w=createWorld({seed:'closing-integration',w:40,h:40});
 for(const k of ['terrain','road','rail','zone','tier','civic','civicSize','wall','big','rubble','burning','flooded'])w[k].fill(0);
 w.cash=900000;w.roadsDirty=true;w.wallsDirty=true;
 apply(w,{kind:'road',tiles:Array.from({length:30},(_,x)=>4*w.w+x+1)});
 for(const [kind,tx] of [['zoo',10],['centre',15]])if(!apply(w,{kind,tx,ty:5}).ok)throw Error('fixture custody placement');
 const home=5*w.w+4;w.zone[home]=ZONE.R;w.tier[home]=3;
 const h=createHousehold(w,'rabbit',3);placeHousehold(w,h,home);computeFields(w);
 return {w,h,a:w.byId.get(h.members[0]),b:w.byId.get(h.members[1])};
}
function take(w,c,culprit,cause,wrongful=false){return arrest(w,{tile:c.home,culpritId:culprit.id,cause,closed:false},c,wrongful,[]);}
export function checkIntegration(check){
 for(const reload of [false,true]){
  let {w,a,b}=fixture();take(w,a,b,'burglary',true);
  check('integration: prison pin names the Zoo',pinTarget(w,[],a.id).line==='in the Zoo prison');
  w.tick=a.held;custodyTick(w,[]);take(w,a,a,'killing');const until=a.held;
  if(reload){w=load(save(w));a=w.byId.get(a.id);b=w.byId.get(b.id);}
  take(w,b,b,'burglary');
  check(`integration: clearing old wrongful theft preserves newer murder custody${reload?' after reload':''}`,a.held===until&&w.civic[a.heldAt]===CIVIC.CENTRE&&a.record===1&&a.thefts===0&&a.exonerated);
 }
 const current=fixture();take(current.w,current.a,current.b,'burglary',true);take(current.w,current.b,current.b,'burglary');
 check('integration: clearing current wrongful conviction releases custody',current.a.held===0&&current.a.heldAt===-1&&current.a.record===0);
 const multi=fixture();take(multi.w,multi.a,multi.b,'burglary',true);multi.w.tick=multi.a.held;custodyTick(multi.w,[]);take(multi.w,multi.a,multi.b,'burglary',true);take(multi.w,multi.b,multi.b,'burglary');
 check('integration: multiple wrongful convictions clear and release latest custody',multi.a.record===0&&multi.a.thefts===0&&multi.a.held===0&&multi.w.events.justice.exonerated===2);
 const camp=fixture();startCamping(camp.w,camp.h);camp.a.born=-1200;camp.w.last={census:census(camp.w)};
 const before=stateHash(camp.w),target=pinTarget(camp.w,[],camp.a.id),need=needOf(camp.w,camp.a);
 check('integration: retired campers have an actionable housing need',need.code==='ROOMS'&&need.arg.camping&&need.act.includes('housing'));
 check('integration: camping citizen follow resolves the physical tent',target.tile===camp.w.campers[0].tile&&target.line.includes('camping')&&citizenFrame(camp.w,[],{mode:'citizen',id:camp.a.id}).tx===target.tx);
 check('integration: following and reading needs never write the save',stateHash(camp.w)===before);
 check('integration: follow parser accepts permanent ids',parseFollow(['--follow','citizen','12']).id===12);
 for(const args of [['--follow','citizen'],['--follow','citizen','-1'],['--follow','rabbit'],['--follow','citizen','1.5']]){
  let threw=false;try{parseFollow(args);}catch{threw=true;}check('integration: invalid follow input rejected '+args.join(' '),threw);
 }
 for(const args of [['--save'],['--save','--years'],['--save','x','--save','y'],['--save','x','--seed','7']]){
  let threw=false;try{probeSave(args,['--seed']);}catch{threw=true;}check('integration: ambiguous export arguments rejected '+args.join(' '),threw);
 }
 check('integration: unknown citizen is explicit in film captions',citizenFrame(camp.w,[],{mode:'citizen',id:99999}).state==='unavailable');
 let threw=false;try{wholeYears('NaN');}catch{threw=true;}check('integration: malformed duration rejected',threw);
}
