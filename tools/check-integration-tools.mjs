import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {load,stateHash} from '../js/sim/save.js';
import {controlResult,verifyControlCity} from './control-city.mjs';

export function checkIntegrationTools(check){
 const dir=mkdtempSync(join(tmpdir(),'zoo-integration-'));
 const fixture=resolve('docs/fixtures/save-v1-plain.json');
 try{
  for(const tool of ['peopleprobe','newsprobe','savesize','meatprobe']){
   const args=['tools/'+tool+'.mjs','--save',fixture,...(tool==='savesize'?[]:['--years','1'])];
   let output='',ok=true;try{output=execFileSync(process.execPath,args,{encoding:'utf8',timeout:30000});}catch(e){ok=false;output=e.message;}
   check('integration tools: '+tool+' accepts the legacy export without scripted construction',ok&&/export|source:|save\/save-v1-plain/.test(output),output.slice(-300));
  }
  const file=join(dir,'city.json');copyFileSync(fixture,file);
  const baseline=controlResult(file);writeFileSync(file+'.expected.json',JSON.stringify(baseline));
  check('integration tools: explicit control baseline verifies twelve months',verifyControlCity(file).finalHash===baseline.finalHash);
  baseline.finalHash='changed';writeFileSync(file+'.expected.json',JSON.stringify(baseline));
  let refused=false;try{verifyControlCity(file);}catch{refused=true;}
  check('integration tools: changed control baseline fails',refused);
  execFileSync(process.execPath,['tools/play.mjs','--save',fixture,'--years','0','--film','2','--follow','citizen','1','--w','320','--h','200','--out',dir],{timeout:30000});
  const film=JSON.parse(readFileSync(join(dir,'manifest.json'),'utf8'));
  check('integration tools: recording follows stable ids without changing the simulation',film.shots.length===2&&film.shots.every(s=>s.person.id===1)&&film.finalHash===stateHash(load(readFileSync(fixture,'utf8'))));
  check('integration tools: local player accompanies recorded frames',readFileSync(join(dir,'index.html'),'utf8').includes('aria-label="Recorded frame"'));
 }finally{rmSync(dir,{recursive:true,force:true});}
}
