// Saved laws live in events.governance; reading defaults never changes a save.
import { CIVIC, civicTiles, isPart } from './world.js';
import { served } from './fields.js';
import { KNOBS } from './rules.js';

const sentenceOptions = [['zoo','Imprisonment'],['centre','Pacification'],['hall','Sale to a meat hall']];
export const POLICIES = [
  {key:'meatTrade',name:'Meat-hall regulation',options:[['unregulated','Unregulated'],['inspected','Licensed inspectors'],['prohibited','Prohibited']],description:'Inspectors halve local hall crime and buying pressure, put hall jobs on the tax books, and cost §'+KNOBS.UPKEEP_LICENCE+' per hall/year. Prohibition closes trade, discards stock, releases penned animals alive, and blocks sale sentences. Carnivores lose market access and the treasury loses hall revenue.'},
  {key:'minorSentence',name:'First theft and minor offences',options:sentenceOptions,description:'Choose the sentence for a first theft or minor offence. Imprisonment releases residents unchanged; pacification permanently prevents offspring and predation; sale kills the resident.'},
  {key:'repeatSentence',name:'Second theft',options:sentenceOptions,description:'Choose the sentence for a second theft. A full or missing permitted facility leaves the case open.'},
  {key:'violentSentence',name:'Murder',options:sentenceOptions,description:'Choose the sentence for murder. The same law applies to every species.'},
  {key:'persistentSentence',name:'Third theft or theft after pacification',options:sentenceOptions,description:'Choose the sentence for persistent theft. Prohibited meat trade always replaces sale with imprisonment.'},
  {key:'equalTreatment',name:'Equal treatment',options:[[false,'Class privilege'],[true,'Equal sentencing']],description:'Remove the extra sentencing step for theft from or murder of affluent residents. Costs nothing; changes future convictions.'},
  {key:'oversight',name:'Police accountability',description:'Fund independent oversight: halve wrongful-arrest probability and the chance an innocent interview leads to collection. §300/year. Guilty detection is unchanged.'},
  {key:'cleaners',name:'Building cleaners',description:'Halve household mess emissions and reduce visible building wear by one stage. §6 per standing zoned building/year. Cleaning does not make an old building new.'},
  {key:'scrubbers',name:'Factory smoke scrubbers',options:[[false,'Not installed'],[true,'Installed']],description:'Install permanent smoke scrubbers citywide: industrial emissions −30%. §1,500 once. Existing installations are retained.'},
  {key:'foodAid',name:'Food assistance',description:'Buy one place of food support per resident in poverty, including campers. §12 per recipient/year. Halves their chance of initiating a theft and unemployed predation pressure, and adds +3 mood. Supplements farm capacity in campaigns.'},
  {key:'community',name:'Community activities',description:'Fund shared activities: cross-species friendship attempts are 50% more likely to succeed, and residents gain +2 mood. §240 plus §2 per resident/year.'},
].map(p=>({...p,options:p.options||[[false,'Off'],[true,'Funded']]}));
const defaults={meatTrade:'unregulated',minorSentence:'zoo',repeatSentence:'centre',violentSentence:'centre',persistentSentence:'hall',equalTreatment:false,oversight:false,cleaners:false,scrubbers:false,foodAid:false,community:false};
export function policy(w,key){
  if(key==='scrubbers')return !!w.events.scrubbers;
  return w.events.governance?.[key] ?? (key==='meatTrade'&&w.events.licence?'inspected':defaults[key]);
}
export const hasGovernor=w=>w.civic.includes(CIVIC.GOVERNOR);
export const governanceUnlocked=w=>!!w.events.governance?.unlocked||hasGovernor(w);
export const governorOperational=w=>w.civic.some((c,i)=>c===CIVIC.GOVERNOR&&civicTiles(w,i).every(t=>!w.burning[t]&&!w.flooded[t])&&served(w,i));
export const poorResident=(w,c)=>!c.dead&&(c.home<0||!w.klass[c.home]);
export const foodRecipient=(w,c)=>policy(w,'foodAid')&&poorResident(w,c);
export const foodSupport=w=>policy(w,'foodAid')?w.citizens.filter(c=>poorResident(w,c)).length:0;
export const oversightFactor=w=>policy(w,'oversight')?.5:1;
export const communityFactor=(w,a,b)=>policy(w,'community')&&a.species!==b.species?1.5:1;
export function governanceCosts(w){
  let buildings=0,governors=0;
  for(let i=0;i<w.civic.length;i++){if(w.civic[i]===CIVIC.GOVERNOR)governors++;if(w.zone[i]&&w.tier[i]&&!isPart(w,i))buildings++;}
  const residents=w.citizens.filter(c=>!c.dead).length;
  return {estate:governors*360,oversight:policy(w,'oversight')?300:0,cleaners:policy(w,'cleaners')?buildings*6:0,foodAid:foodSupport(w)*12,community:policy(w,'community')?240+residents*2:0};
}
export function governancePlan(w,key,value){
  const def=POLICIES.find(p=>p.key===key);
  if(!def||!def.options.some(([v])=>v===value))return {reason:'Unknown governance option.'};
  if(!governorOperational(w))return {reason:'An operating Governor’s Mansion with road access is required to change policy.'};
  if(policy(w,key)===value)return {reason:'This policy is already in force.'};
  if(key==='scrubbers'&&!value)return {reason:'Installed factory scrubbers are permanent.'};
  if(key.endsWith('Sentence')&&value==='hall'&&policy(w,'meatTrade')==='prohibited')return {reason:'Sale sentences are unavailable while meat trade is prohibited.'};
  const cost=key==='scrubbers'?1500:key==='meatTrade'&&value==='inspected'?KNOBS.LICENCE_COST:0;
  if(cost>0&&cost>w.cash)return {reason:'Insufficient funds.',cost};
  return {cost,def};
}
export function governanceOutcomes(w){
  const people=w.citizens.filter(c=>!c.dead),j=w.events.justice;
  return {foodSupport:foodSupport(w),foodShortfall:w.flags.campaign?Math.max(0,people.length-(w.infrastructure?.food||0)):0,wrongful:j.wrongful,pacified:j.pacified,sold:j.sold,cross:w.last?.census?.cross||0,friendships:w.last?.census?.friendships||0};
}
