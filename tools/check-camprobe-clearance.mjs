import {createClearanceTracker} from './camprobe-clearance.mjs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export function checkCamprobeClearance(check) {
  const file = (opened, id=7) => ({opened, culpritId:id, tile:42, cause:'burglary', closed:false});
  const conviction = (tick, id=7, wrongful=false) => ({tick, citizenId:id, tile:42, cause:'burglary', wrongful});
  const history=createClearanceTracker(6), tail=[];
  for (let month=1; month<=250; month++) {
    const f=file(month-1,month); f.closed=true;
    tail.push(conviction(month,month)); if(tail.length>200)tail.shift();
    history.observe([f],tail,month);
  }
  check('camera probe: lifetime solved count survives the 200-arrest history limit',history.count===250&&tail.length===200);

  const repeated=createClearanceTracker(6), cold=file(0), later=file(10);
  cold.closed=true; repeated.observe([cold],[],6);
  later.closed=true; repeated.observe([cold,later],[conviction(11)],11);
  repeated.observe([cold,later],[conviction(11)],12);
  check('camera probe: a later same-address conviction never solves an old cold case or counts twice',repeated.count===1);

  const overlap=createClearanceTracker(6), first=file(0), second=file(0);
  first.closed=true; overlap.observe([first,second],[conviction(1)],1);
  check('camera probe: simultaneous same-culprit cases require their own closure',overlap.count===1);
  second.closed=true; overlap.observe([first,second],[conviction(1),conviction(2)],2);
  check('camera probe: a separate subsequent conviction closes the remaining case once',overlap.count===2);

  const sold=createClearanceTracker(6), convicted=file(0), died=file(0);
  convicted.closed=true; died.closed=true;
  sold.observe([convicted,died],[conviction(1)],1);
  check('camera probe: selling a culprit cannot count their other auto-closed files as solved',sold.count===1);

  const wrong=createClearanceTracker(6), pending=file(0);
  wrong.observe([pending],[conviction(1,7,true)],1);
  pending.closed=true; wrong.observe([pending],[conviction(1,7,true)],6);
  check('camera probe: wrongful arrests followed by cold closure are not clearance',wrong.count===0);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  let count=0; checkCamprobeClearance((name,ok)=>{count++;if(!ok)throw Error(name);});
  console.log(count+' camera probe clearance checks passed');
}
