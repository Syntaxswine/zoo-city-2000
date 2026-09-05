import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve,dirname} from 'node:path';
function source(file){return readFileSync(file,'utf8').replace(/(from\s+["'])(\.[^"']+)(["'])/g,(_,a,b,c)=>a+pathToFileURL(resolve(dirname(file),b)).href+c);}
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const suite=source('tools/check-people-stretch.mjs');
const baseline=await import(uri(suite));
baseline.checkPeopleStretch((name,ok,detail)=>{if(!ok)throw Error('Unmutated baseline failed: '+name+' '+detail);});
for(const [file,from,to] of [
 ['js/people.js','!app.starIds().includes(id)&&!pinTarget','!pinTarget'],
 ['js/people.js','Math.max(4*dt,d-maxLag)','4*dt'],
 ['js/sim/building-age.js','months>=300','months>=99999'],
 ['js/sim/building-age.js','||world.big[i]!==before.big[i]',''],
 ['js/sim/building-age.js','world.since[i]=world.tick+1','world.since[i]=1']
]){
 const original=source(file);if(!original.includes(from))throw Error('Mutation target missing: '+from);
 const mutated=uri(original.replace(from,to));
 const modified=suite.replaceAll(pathToFileURL(resolve(file)).href,mutated);
 const {checkPeopleStretch}=await import(uri(modified));const failed=[];
 checkPeopleStretch((name,ok)=>{if(!ok)failed.push(name)});
 if(!failed.length)throw Error('SURVIVED '+file+' '+from);
 console.log('KILLED '+file+' '+from+': '+failed.join('; '));
}
