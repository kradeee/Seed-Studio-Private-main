/* Engine: Cubiomes / Seeder, MIT. See adjacent licenses. App adapter by Seed Studio. */
self.Module={locateFile:p=>'/engine/'+p,onRuntimeInitialized:()=>{self.engine=new Seeder(Module);self.postMessage({kind:'ready'})},onAbort:()=>self.postMessage({kind:'error',message:'Il motore non è disponibile. Ricarica la pagina.'})};
importScripts('/engine/api.js','/engine/seeder.js','/engine/structures.js');

const S=()=>self.SeedStudioStructures;
const STRONGHOLD=99;
// Cumulative stronghold counts per ring (3, 6, 10, 15, 21, 28, 36, 9) and each ring's
// nearest possible distance in blocks (ring k is centred ~2048 + 3072k from the origin).
const RING_TOTAL=[3,9,19,34,55,83,119,128];
const ringsFor=d=>{let n=1;for(let k=0;k<8;k++)if(2048+3072*k-900<d)n=k+1;return RING_TOTAL[n-1]};

const summaries=new Map();
function summary(version,seed){const key=version+'|'+seed;if(!summaries.has(key)){if(summaries.size>50)summaries.clear();summaries.set(key,engine.seedSummary({mcVersion:version,seed}))}return summaries.get(key)}

function strongholdsNear(version,seed,x0,z0,x1,z1){
 const far=Math.max(...[[x0,z0],[x1,z0],[x0,z1],[x1,z1]].map(([x,z])=>Math.hypot(x,z)));
 const all=S().strongholds(engine,version,seed,ringsFor(far));
 return all.filter(s=>s.x>=x0&&s.x<x1&&s.z>=z0&&s.z<z1);
}

function slime(seed,x0,z0,x1,z1){
 const cx0=Math.floor(x0/16),cz0=Math.floor(z0/16),cx1=Math.ceil(x1/16),cz1=Math.ceil(z1/16);
 if((cx1-cx0)*(cz1-cz0)>200*140)return null; // too far out to be readable
 const out=[];
 for(let tz=cz0;tz<cz1;tz+=64)for(let tx=cx0;tx<cx1;tx+=64){
  const w=Math.min(64,cx1-tx),h=Math.min(64,cz1-tz);const r=engine.slimeChunks({seed,cx0:tx,cz0:tz,w,h});
  for(let i=0;i<w*h;i++)if(r.cells[i])out.push(tx+i%w,tz+Math.floor(i/w));
 }
 return out;
}

const BASTION=['Unità abitative','Stalla degli hoglin','Stanza del tesoro','Ponte'];
function detail(m){
 const {seed,version,dim,type,x,z}=m;const info={};
 const b=engine.biomeAt({mcVersion:version,seed,dimension:dim,x,y:dim===0?256:64,z}).biome;info.biome=b;
 if(dim!==-1){const h=engine.approxHeight({mcVersion:version,seed,dimension:dim,x,z}).height;if(h!==null)info.height=h}
 if(type===STRONGHOLD){const a=engine.strongholdAnalyse({mcVersion:version,seed,x,z});info.eyes=a.eyes;info.libraries=a.libraries;info.portal=a.portalX||a.portalZ?{x:a.portalX,z:a.portalZ}:null;return info}
 if(type==null)return info;
 const v=engine.structureVariant({mcVersion:version,seed,dimension:dim,type,x,z}).variant;
 if(v.supported){
  const tags=[];
  if(type===5){if(v.biome>=0)info.biome=v.biome;if(v.abandoned)tags.push('Villaggio abbandonato (zombi)')}
  // Ruined portals: no variant tags. Their type (and so size, burial) is decided by the biome at
  // the depth the game places them, which needs terrain the engine does not compute; checked in
  // game on 26.3 (seed 12345, 16 0: engine says ocean, the game builds a standard portal).
  if(type===4)tags.push(v.basement?'Con laboratorio sotterraneo':'Senza seminterrato');
  if(type===19&&v.start>=0&&v.start<4)tags.push(BASTION[v.start]);
  if(type===7&&v.biome>=0&&![0,10,24,44,45,46,47,48,49,50].includes(v.biome))tags.push('Arenato sulla spiaggia');
  if(v.by&&type!==11)info.y=v.by;
  info.tags=tags;
 }
 if(type===21&&v.endShip)info.tags=[...(info.tags||[]),'Con la nave dell’End (elitre!)'];
 if(type===18){const f=engine.fortressSpawners({mcVersion:version,seed,chunkX:x>>4,chunkZ:z>>4});if(!f.error)info.tags=[...(info.tags||[]),`${f.spawners.length} generatori di blaze`,...(f.wartRooms?[`${f.wartRooms} stanze di verruche`]:[])]}
 return info;
}

self.onmessage=({data:m})=>{try{
 if(m.kind==='map'){
  const a=engine.getArea(m.version,m.seed,m.x,m.z,m.w,m.h,m.dim,m.y,m.dim===0);
  self.postMessage({kind:'map',id:m.id,x:m.x,z:m.z,w:m.w,h:m.h,rgba:a.rgba,ids:a.ids,heights:a.heights},[a.rgba.buffer,a.ids.buffer,...(a.heights?[a.heights.buffer]:[])]);
 }else if(m.kind==='summary'){
  self.postMessage({kind:'summary',id:m.id,summary:summary(m.version,m.seed)});
 }else if(m.kind==='overlay'){
  const types=m.types.filter(t=>t!==STRONGHOLD);
  const structures=S().structuresInRect(engine,{mcVersion:m.version,seed:m.seed,dimension:m.dim,x0:m.x0,z0:m.z0,x1:m.x1,z1:m.z1,types});
  const strongholds=m.dim===0&&m.types.includes(STRONGHOLD)?strongholdsNear(m.version,m.seed,m.x0,m.z0,m.x1,m.z1):[];
  const slimes=m.slime&&m.dim===0?slime(m.seed,m.x0,m.z0,m.x1,m.z1):null;
  self.postMessage({kind:'overlay',id:m.id,structures,strongholds,slimes});
 }else if(m.kind==='detail'){
  self.postMessage({kind:'detail',id:m.id,info:detail(m)});
 }else if(m.kind==='nearest'){
  const types=m.types.filter(t=>t!==STRONGHOLD);
  const res=engine.nearestStructures({mcVersion:m.version,seed:m.seed,dimension:m.dim,x:m.x,z:m.z,types,maxRadiusBlocks:m.radius||6000}).results.filter(r=>r.found===1).map(r=>({type:r.type,x:r.x,z:r.z}));
  if(m.dim===0&&m.types.includes(STRONGHOLD)){const sh=S().strongholds(engine,m.version,m.seed,3);let best=null;for(const s of sh){const d=Math.hypot(s.x-m.x,s.z-m.z);if(!best||d<best.d)best={d,s}}if(best)res.push({type:STRONGHOLD,x:best.s.x,z:best.s.z})}
  self.postMessage({kind:'nearest',id:m.id,results:res});
 }else if(m.kind==='support'){
  const s=engine.getVersionSupport(m.version,m.biomes,m.structures);
  self.postMessage({kind:'support',id:m.id,biomes:s.biomes,structures:s.structures});
 }else if(m.kind==='preview'){
  // A search result's little map, plus how far each wanted biome is from the reference
  // point (spawn): patch centre minus the patch's rough radius, in blocks.
  const cells=m.half*2/4,x=Math.floor((m.cx-m.half)/4),z=Math.floor((m.cz-m.half)/4);
  const a=engine.getArea(m.version,m.seed,x,z,cells,cells,m.dim,256,m.dim===0);
  const biomeDist={};
  if(m.dim===0)for(const id of m.biomes){
   // exact inside the preview: the nearest 4×4 cell of that biome
   let near=null;for(let j=0;j<cells;j++)for(let i=0;i<cells;i++)if(a.ids[j*cells+i]===id){const d=Math.hypot((x+i)*4+2-m.cx,(z+j)*4+2-m.cz);if(near===null||d<near)near=d}
   if(near!==null){biomeDist[id]=Math.round(near);continue}
   // beyond it: patch centre minus the patch's rough radius
   const r=engine.biomeCenters({mcVersion:m.version,seed:m.seed,dimension:0,biomeId:id,x:m.cx,z:m.cz,radiusBlocks:Math.min(2048,m.radius+512),nmax:64});
   let best=null;for(const c of r.centers||[]){const d=Math.max(0,Math.hypot(c.x-m.cx,c.z-m.cz)-Math.sqrt(c.size/Math.PI)*4);if(best===null||d<best)best=d}
   biomeDist[id]=best===null?null:Math.round(best);
  }
  self.postMessage({kind:'preview',id:m.id,x,z,w:cells,h:cells,ids:a.ids,heights:a.heights,rgba:a.rgba,biomeDist},[a.ids.buffer,a.rgba.buffer,...(a.heights?[a.heights.buffer]:[])]);
 }else if(m.kind==='search'){
  const r=engine.findSeeds(m.criteria);self.postMessage({kind:'complete',shardId:m.shardId,...r});
 }
}catch(e){self.postMessage({kind:'error',id:m.id,shardId:m.shardId,message:e.message||'Errore del motore'})}};
