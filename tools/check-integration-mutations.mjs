import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve,dirname} from 'node:path';
function source(file){return readFileSync(file,'utf8').replace(/(from\s+["'])(\.[^"']+)(["'])/g,(_,a,b,c)=>a+pathToFileURL(resolve(dirname(file),b)).href+c);}
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const suite=source('tools/check-integration.mjs');
for(const [file,from,to] of [
 ['js/sim/justice.js','&& latest === a',''],
 ['js/follow.js','world.civic[c.heldAt] === CIVIC.ZOO','false'],
 ['js/follow.js','camp?.tile ?? -1','-1'],
 ['js/sim/needs.js','c.home < 0 && world.campers?.some','false && world.campers?.some']
]){
 const original=source(file);if(!original.includes(from))throw Error('mutation missed');
 const mutated=uri(original.replace(from,to));
 const modified=suite.replaceAll(pathToFileURL(resolve(file)).href,mutated);
 const {checkIntegration}=await import(uri(modified));const failed=[];
 checkIntegration((name,ok)=>{if(!ok)failed.push(name)});
 if(!failed.length)throw Error('SURVIVED '+file+' '+from);
 console.log('KILLED '+file+' '+from+': '+failed.join('; '));
}
