// Record explicitly once when the owner's export arrives; check thereafter.
// node tools/control-city.mjs [--save file] [--record]
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {load,rebuildDerived,stateHash} from '../js/sim/save.js';
import {tick} from '../js/sim/tick.js';

export function controlResult(file){
 const json=readFileSync(file,'utf8'),w=load(json);rebuildDerived(w);
 const startHash=stateHash(w),startTick=w.tick;
 for(let n=0;n<12;n++)tick(w);
 return {version:1,sha256:createHash('sha256').update(json).digest('hex'),startTick,startHash,months:12,finalHash:stateHash(w)};
}
export function verifyControlCity(file,expected=file+'.expected.json'){
 const actual=controlResult(file),baseline=JSON.parse(readFileSync(expected,'utf8'));
 if(JSON.stringify(actual)!==JSON.stringify(baseline))throw Error('Control city regression differs from the reviewed baseline: '+JSON.stringify(actual));
 return actual;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2),i=args.indexOf('--save');
 if(i>=0&&(!args[i+1]||args[i+1].startsWith('--')))throw Error('--save needs a file');
 const file=resolve(i>=0?args[i+1]:'docs/fixtures/control-city.json'),expected=file+'.expected.json';
 if(args.includes('--record')){
  if(existsSync(expected))throw Error('Refusing to overwrite an existing baseline; review any regression first');
  const result=controlResult(file);writeFileSync(expected,JSON.stringify(result,null,2)+'\n');console.log('Recorded for review:',result);
 }else console.log('PASS control city:',verifyControlCity(file,expected));
}
