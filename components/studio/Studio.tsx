import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Boxes,HelpCircle,Copy,Check,Shuffle,Flower2,Mountain,TreePalm,Timer,KeyRound,Flame,X,BookOpen,MapPin,ExternalLink,Search,Layers,Share2,Star,Trash2,Heart,Languages} from 'lucide-react';
import WorldMap,{type MapFocus,type MapView} from './WorldMap';
import MinecraftPreview,{PREVIEW_AVAILABLE} from './MinecraftPreview';
import AdSlot from './AdSlot';
import {useFavorites} from './favorites';
import {track} from './analytics';
import {LANG,asset,otherLanguageUrl,tr} from './i18n';
import {SITE} from '../../site.config';
import Composer,{type BiomeWish,type SearchResult} from './Composer';
import {PRESETS,BIOME_GROUPS,STRUCTURES,STRONGHOLD,VILLAGE,normalizeSeed,randomSeed,VERSIONS,packVersion,type Dimension} from './data';
import {rpc,WORKER_URL} from './engine-client';

const PRESET_SLUGS=['blossom-valley','peaks','island','speedrun','deep','nether'];
const PRESET_ICONS=[Flower2,Mountain,TreePalm,Timer,KeyRound,Flame];
const MAX_RESULTS=8,TIME_LIMIT=60000;
const now=()=>performance.now();
let focusSeq=0,searchSeq=0;
type Preview={ids:Int32Array;heights:Int16Array|null;rgba:Uint8ClampedArray;x:number;z:number;w:number;h:number;biomeDist:Record<number,number|null>};
const ALL_BIOMES=BIOME_GROUPS.flatMap(g=>g.ids);

export default function Studio(){
 const [mode,setMode]=useState('compose'),[seed,setSeed]=useState('8678942899319966093'),[input,setInput]=useState('8678942899319966093'),[version,setVersion]=useState(26),[large,setLarge]=useState(false);
 const [sDim,setSDim]=useState<Dimension>(0),[biomes,setBiomes]=useState<BiomeWish>({185:1,1:1}),[structures,setStructures]=useState<number[]>([5]),[island,setIsland]=useState(0),[villageStyles,setVillageStyles]=useState<number[]>([]),[openSea,setOpenSea]=useState(0),[lastEmpty,setLastEmpty]=useState(false),[radius,setRadius]=useState(1024),[nearSpawn,setNearSpawn]=useState(true),[rejected,setRejected]=useState(0);
 const [searching,setSearching]=useState(false),[progress,setProgress]=useState(0),[rate,setRate]=useState(0),[message,setMessage]=useState(''),[results,setResults]=useState<SearchResult[]>([]),[error,setError]=useState(''),[copied,setCopied]=useState(false),[help,setHelp]=useState(false),[preset,setPreset]=useState(-1);
 const [supportBiomes,setSupportBiomes]=useState<Set<number>|null>(null),[supportStructures,setSupportStructures]=useState<Record<number,number>>({}),[focus,setFocus]=useState<MapFocus|null>(null);
 const pool=useRef<Worker[]>([]),timer=useRef<ReturnType<typeof setTimeout>|null>(null),copyTimer=useRef<ReturnType<typeof setTimeout>|null>(null),dialog=useRef<HTMLDialogElement>(null),lastTrigger=useRef<HTMLElement|null>(null);
 const packed=packVersion(version,large);
 const [shared,setShared]=useState(false);
 const viewRef=useRef<MapView>({dim:0,x:0,z:0,bpp:2,y:256}),loaded=useRef(false);

 /* ---- shareable links: ?seed=…&v=1.21.1&d=nether&x=…&z=…&zoom=…&y=…&sel=… ---- */
 const buildUrl=(over?:Partial<MapView>&{sel?:number|null})=>{
  const v={...viewRef.current,...over};const q=new URLSearchParams();
  q.set('seed',seed);q.set('v',VERSIONS.find(x=>x.id===version)?.name||'');if(large)q.set('lb','1');
  if(v.dim)q.set('d',v.dim===-1?'nether':'end');q.set('x',String(v.x));q.set('z',String(v.z));q.set('zoom',String(Math.round(v.bpp*100)/100));
  if(v.dim===0&&v.y!==256)q.set('y',String(v.y));if(over?.sel!=null)q.set('sel',String(over.sel));
  return location.origin+location.pathname+'?'+q.toString();
 };
 const syncUrl=()=>{if(loaded.current)history.replaceState(null,'',buildUrl())};
 useEffect(()=>{
  const q=new URLSearchParams(location.search);
  /* eslint-disable react-hooks/set-state-in-effect -- one-time read of the page address */
  const s=q.get('seed');if(s){try{const n=normalizeSeed(s);setSeed(n);setInput(n);setMode('explore')}catch{/* not a seed: keep the default */}}
  const v=VERSIONS.find(x=>x.name===q.get('v'));if(v)setVersion(v.id);if(q.get('lb')==='1')setLarge(true);
  const x=Number(q.get('x')),z=Number(q.get('z'));
  if(q.has('x')&&q.has('z')&&Number.isFinite(x)&&Number.isFinite(z)){const d:Dimension=q.get('d')==='nether'?-1:q.get('d')==='end'?1:0;const sel=q.get('sel');
   setFocus({n:++focusSeq,dim:d,x,z,bpp:Number(q.get('zoom'))||undefined,y:q.has('y')?Number(q.get('y')):undefined,type:sel!=null&&sel!==''?Number(sel):undefined})}
  /* eslint-enable react-hooks/set-state-in-effect */
  loaded.current=true;
 },[]);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 useEffect(()=>{syncUrl()},[seed,version,large]);
 const onViewChange=useCallback((v:MapView)=>{viewRef.current=v;syncUrl()},
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [seed,version,large]);
 const share=async()=>{track('share-link');try{await navigator.clipboard.writeText(buildUrl());setShared(true);setTimeout(()=>setShared(false),2200)}catch{setError(tr('Copia non disponibile: copia l’indirizzo dalla barra del browser.','Copying is not available: copy the address from the browser bar.'))}};

 const stop=()=>{pool.current.forEach(w=>w.terminate());pool.current=[];if(timer.current)clearTimeout(timer.current);setSearching(false)};
 useEffect(()=>()=>{pool.current.forEach(w=>w.terminate());if(timer.current)clearTimeout(timer.current);if(copyTimer.current)clearTimeout(copyTimer.current)},[]);
 useEffect(()=>{if(help){lastTrigger.current=document.activeElement as HTMLElement;dialog.current?.showModal()}else{dialog.current?.close();lastTrigger.current?.focus()}},[help]);
 useEffect(()=>{let live=true;rpc<{biomes:number[];structures:Record<number,number>}>('support',{version,biomes:ALL_BIOMES,structures:STRUCTURES.filter(s=>s.id!==STRONGHOLD).map(s=>s.id)}).then(r=>{if(!live)return;setSupportBiomes(new Set(r.biomes));setSupportStructures(r.structures)}).catch(()=>{});return()=>{live=false}},[version]);

 const applySeed=(value:string)=>{try{const s=normalizeSeed(value);setSeed(s);setInput(s);setError('');return s}catch(e){const m=(e as Error).message;setError(m);throw e}};
 const openResult=(r:SearchResult,dim:Dimension=r.dim??sDim)=>{applySeed(r.seed);const first=r.structures[0];const c=r.ref||(dim===0?{x:r.spawnX,z:r.spawnZ}:{x:0,z:0});setFocus({n:++focusSeq,dim,x:first?first.x:c.x,z:first?first.z:c.z,type:first?.type})};

 type Criteria={biomes:BiomeWish;structures:number[];island:number;dim:Dimension;radius?:number;villageStyles?:number[];openSea?:number};
 type Village={x:number;z:number;style:number;abandoned:boolean};
 const search=(c?:Criteria)=>{
  stop();setError('');setMessage('');setProgress(0);setRate(0);setResults([]);setRejected(0);setLastEmpty(false);
  const token=++searchSeq;
  const cr:Criteria=c||{biomes,structures,island,dim:sDim,villageStyles,openSea};
  const want=Object.keys(cr.biomes).map(Number).filter(id=>cr.biomes[id]===1),avoid=Object.keys(cr.biomes).map(Number).filter(id=>cr.biomes[id]===-1);
  const structs=cr.structures.filter(id=>supportStructures[id]===undefined||supportStructures[id]!==-100);
  let range=cr.radius??radius;if(structs.includes(21)&&range<1024){range=1024;setRadius(1024)}
  if(!want.length&&!avoid.length&&!structs.length&&!cr.island)return;
  const fromSpawn=nearSpawn&&cr.dim===0;
  const styles=cr.dim===0&&structs.includes(VILLAGE)?(cr.villageStyles??[]):[];
  const sea=cr.dim===0&&cr.island?(cr.openSea??0):0;
  const dropWhy=sea?tr('troppo lontani dallo spawn o con altra terra vicino all’isola','too far from spawn or with other land near the island'):styles.length?tr('troppo lontani dallo spawn o con un villaggio di un altro stile','too far from spawn or with a village of another style'):tr('troppo lontani dallo spawn','too far from spawn');
  setSearching(true);track(cr.dim===0?'search':cr.dim===-1?'search-nether':'search-end');if(sea)track('search-open-sea');
  const shard=structs.length?4096:cr.island&&!want.length&&!avoid.length?128:8;
  let done=0,found:SearchResult[]=[],waiting=0,dropped=0;const seen=new Set<string>();const live=new Map<Worker,number>();const t0=now();
  const total=()=>done+[...live.values()].reduce((a,b)=>a+b,0);
  const tickProgress=()=>{const n=total();setProgress(n);const s=(now()-t0)/1000;if(s>1)setRate(Math.round(n/s))};
  const finish=(msg:string)=>{stop();setMessage(msg)};
  /* Every hit gets a little map and is re-measured from its spawn (Overworld): the engine
   * searches around 0, 0, but players start at spawn. */
  const enrich=async(r:SearchResult):Promise<SearchResult|null>=>{
   /* Village style: the engine finds a village, not its style. Keep the seed only if some
    * village of a wanted style is inside the searched square, and show the one nearest spawn. */
   /* Open sea: reject the island if other land lies within `sea` blocks of spawn. */
   if(sea){
    const {distance}=await rpc<{distance:number|null}>('otherLand',{seed:r.seed,version:packed,x:r.spawnX,z:r.spawnZ,radius:sea},'preview');
    if(distance!==null)return null;
    r={...r,openSea:sea};
   }
   if(styles.length){
    const {villages}=await rpc<{villages:Village[]}>('villages',{seed:r.seed,version:packed,x0:-range,z0:-range,x1:range,z1:range},'preview');
    const d=(v:Village)=>Math.hypot(v.x-r.spawnX,v.z-r.spawnZ);
    const ok=villages.filter(v=>styles.includes(v.style)&&Math.abs(v.x)<=range&&Math.abs(v.z)<=range).sort((a,b)=>d(a)-d(b));
    if(!ok.length)return null;
    r={...r,structures:r.structures.map(s=>s.type===VILLAGE?{type:VILLAGE,x:ok[0].x,z:ok[0].z}:s)};
   }
   const ref=cr.dim===0?{x:r.spawnX,z:r.spawnZ}:cr.dim===1&&r.structures.length?{x:Math.round(r.structures.reduce((a,s)=>a+s.x,0)/r.structures.length),z:Math.round(r.structures.reduce((a,s)=>a+s.z,0)/r.structures.length)}:{x:0,z:0};
   const far=Math.max(0,...r.structures.map(s=>Math.hypot(s.x-ref.x,s.z-ref.z)));
   const half=Math.round(Math.max(192,Math.min(384,far+96))/4)*4;
   const pv=await rpc<Preview>('preview',{seed:r.seed,version:packed,dim:cr.dim,cx:ref.x,cz:ref.z,half,biomes:want,radius:range},'preview');
   const dists=[...r.structures.map(s=>({kind:'s' as const,id:s.type,d:Math.round(Math.hypot(s.x-ref.x,s.z-ref.z))})),...want.filter(()=>cr.dim===0).map(id=>({kind:'b' as const,id,d:pv.biomeDist[id]??null}))];
   const score=dists.reduce((m,x)=>Math.max(m,x.d==null?Infinity:x.d),0);
   return {...r,dim:cr.dim,ref,dists,score,preview:{ids:pv.ids,heights:pv.heights,rgba:pv.rgba,x:pv.x,z:pv.z,w:pv.w,h:pv.h}};
  };
  const dispatch=(w:Worker)=>{if(!pool.current.includes(w))return;const start=BigInt(randomSeed());live.set(w,0);/* every shard starts somewhere new: results are unrelated worlds */
   w.postMessage({kind:'search',shardId:start.toString(),criteria:{mcVersion:packed,dimension:cr.dim,yHeight:256,biomes:want,excludeBiomes:avoid,structures:structs,rangeBlocks:range,islandBlocks:cr.dim===0?cr.island:0,startingSeed:start.toString(),maxSeedsToScan:shard,maxResults:1}})};
  const n=Math.max(2,Math.min(8,(navigator.hardwareConcurrency||4)-1));
  for(let i=0;i<n;i++){const w=new Worker(WORKER_URL);pool.current.push(w);
   w.onerror=()=>{track('search-error');finish('');setError(tr('Il motore di ricerca non risponde. Riprova.','The search engine is not responding. Try again.'))};
   w.onmessage=({data:m})=>{
    if(m.kind==='ready')dispatch(w);
    else if(m.kind==='SEED_UPDATE'){live.set(w,m.data.examined);tickProgress()}
    else if(m.kind==='SEED_FOUND'){const r:SearchResult={seed:BigInt.asIntN(64,BigInt(m.data.seed)).toString(),spawnX:m.data.spawnX,spawnZ:m.data.spawnZ,structures:m.data.structures,island:m.data.island,order:0};
     if(seen.has(r.seed)||found.length+waiting>=MAX_RESULTS+4)return;seen.add(r.seed);waiting++;
     enrich(r).then(er=>{waiting--;if(token!==searchSeq)return;
      if(!er||(fromSpawn&&(er.score??0)>range)){dropped++;setRejected(dropped);return}
      if(found.length>=MAX_RESULTS)return;
      found=[...found,{...er,order:found.length}];setResults(found);if(found.length===1)openResult(found[0],cr.dim);
      if(found.length>=MAX_RESULTS){track('search-found');finish(tr(`${MAX_RESULTS} seed trovati con tutti i criteri. Clicca un risultato per esplorarlo.`,`${MAX_RESULTS} seeds found with every criterion. Click a result to explore it.`))}
     }).catch(()=>{waiting--})}
    else if(m.kind==='complete'){if(m.error){finish('');setError(m.error.code===-9?tr('Le città dell’End sono solo oltre i 1.008 blocchi: aumenta il raggio.','End cities only exist beyond 1,008 blocks: increase the radius.'):m.error.code===-5?tr('Il raggio è troppo grande per queste strutture: riducilo.','The radius is too large for these structures: reduce it.'):m.error.code===-6?tr('Uno dei biomi non esiste in questa versione o dimensione.','One of the biomes does not exist in this version or dimension.'):tr('Questa combinazione non può essere cercata. Modifica i criteri.','This combination cannot be searched. Change the criteria.'));return}
     done+=m.examined;live.delete(w);tickProgress();dispatch(w)}
    else if(m.kind==='error'){finish('');setError(tr('Errore durante la ricerca. Riprova con un raggio più piccolo.','Search error. Try again with a smaller radius.'))}
   }}
  timer.current=setTimeout(()=>{const k=found.length;track(k?'search-found':'search-empty');if(!k)setLastEmpty(true);const extra=dropped?tr(` ${dropped} scartati: ${dropWhy}.`,` ${dropped} dropped: ${dropWhy}.`):'';finish(k?tr(`${k} seed trovati in 60 secondi.${extra} Clicca un risultato per esplorarlo.`,`${k} seeds found in 60 seconds.${extra} Click a result to explore it.`):tr(`Nessun risultato in 60 secondi.${extra} Prova un raggio più ampio o meno criteri: non significa che il mondo sia impossibile.`,`No results in 60 seconds.${extra} Try a wider radius or fewer criteria: it does not mean the world is impossible.`))},TIME_LIMIT);
 };
 const choosePreset=(i:number)=>{const p=PRESETS[i];track('preset-'+PRESET_SLUGS[i]);const b:BiomeWish={};p.biomes.forEach(id=>b[id]=1);setPreset(i);setMode('compose');setSDim(p.dimension);setBiomes(b);setStructures(p.structures);setIsland(p.island);setRadius(p.radius);setVillageStyles([]);setOpenSea(0);search({biomes:b,structures:p.structures,island:p.island,dim:p.dimension,radius:p.radius,villageStyles:[],openSea:0})};
 const retryWider=()=>{const r=Math.min(2048,radius+512);track('search-retry-wider');setRadius(r);search({biomes,structures,island,dim:sDim,radius:r,villageStyles,openSea})};
 const random=()=>{track('random-seed');stop();applySeed(randomSeed());setMessage(tr('Seed casuale: i criteri di composizione non sono applicati.','Random seed: your composition criteria are not applied.'));setPreset(-1)};
 useEffect(()=>{const c=(document as Document&{modelContext?:{registerTool:(t:unknown,o:unknown)=>Promise<void>}}).modelContext;if(!c?.registerTool)return;const ac=new AbortController();Promise.resolve(c.registerTool({name:'explore_minecraft_seed',description:'Show the map of a Minecraft Java seed. Does not search by criteria.',inputSchema:{type:'object',properties:{seed:{type:'string'}},required:['seed'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async(v:{seed:string})=>{if(!v||typeof v.seed!=='string')throw new Error('Seed required');const s=normalizeSeed(v.seed);setSeed(s);setInput(s);setMode('explore');return{seed:s,status:'map_requested'}}},{signal:ac.signal})).catch(()=>{});return()=>ac.abort()},[]);
 const copy=async()=>{track('copy-seed');try{await navigator.clipboard.writeText(seed);setCopied(true);copyTimer.current=setTimeout(()=>setCopied(false),2200)}catch{setError(tr('Copia automatica non disponibile: seleziona il numero nel campo Seed.','Automatic copy is not available: select the number in the Seed field.'))}};
 const versionName=useMemo(()=>VERSIONS.find(v=>v.id===version)?.name,[version]);
 const clear=()=>{setMessage('');setLastEmpty(false)};

 const fav=useFavorites();const saved=fav.has(seed,version,large);
 const openFavorite=(f:{seed:string;version:number;large:boolean})=>{stop();setVersion(f.version);setLarge(f.large);applySeed(f.seed);setMode('explore');setMessage('');setPreset(-1)};
 const versionOf=(id:number)=>VERSIONS.find(v=>v.id===id)?.name||'';
 const EN=LANG==='en';

 return <div className="studio"><header className="site-header"><a className="brand" href={asset(EN?'en/':'')} aria-label={tr('Seed Studio, inizio','Seed Studio, home')}><span className="brand-icon"><Boxes size={26}/></span><b>SEED</b><span className="slash">/</span><span>STUDIO</span></a><nav aria-label={tr('Principale','Main')}><button className={mode==='explore'?'active':''} onClick={()=>setMode('explore')}>{tr('Esplora','Explore')}</button><button className={mode==='compose'?'active':''} onClick={()=>setMode('compose')}>{tr('Componi','Compose')}</button></nav>
 <div className="header-actions"><a className="lang-switch" onClick={()=>track(EN?'switch-to-it':'switch-to-en')} href={otherLanguageUrl()} hrefLang={EN?'it':'en'} lang={EN?'it':'en'} title={EN?'Versione italiana':'English version'}><Languages size={17}/><span>{EN?'IT':'EN'}</span></a><button className="guide-button" onClick={()=>{track('open-guide');setHelp(true)}}><HelpCircle size={20}/><span>{tr('Guida','Guide')}</span></button></div></header>
 <main><div className="page-heading"><div><h1>{tr('Il tuo prossimo mondo, da qui.','Your next Minecraft world starts here.')}</h1><p>{tr('Biomi, strutture, Nether ed End: tutto calcolato come nel gioco.','Biomes, structures, Nether and End: all calculated just like the game.')}</p></div><span className="edition-label">Minecraft Java <b>{versionName}{large?tr(' · biomi grandi',' · large biomes'):''}</b></span></div>
 <div className="workspace"><Composer mode={mode} version={version} setVersion={v=>{setVersion(v);clear()}} large={large} setLarge={v=>{setLarge(v);clear()}} dim={sDim} setDim={d=>{setSDim(d);setBiomes({});setStructures(s=>s.filter(id=>STRUCTURES.find(x=>x.id===id)?.dims.includes(d)));setPreset(-1);clear()}}
  biomes={biomes} setBiomes={v=>{setBiomes(v);setPreset(-1);clear()}} structures={structures} setStructures={v=>{setStructures(v);setPreset(-1);clear()}} island={island} setIsland={v=>{setIsland(v);setPreset(-1);clear()}} villageStyles={villageStyles} setVillageStyles={v=>{setVillageStyles(v);setPreset(-1);clear()}} openSea={openSea} setOpenSea={v=>{setOpenSea(v);setPreset(-1);clear()}} lastEmpty={lastEmpty} onRetryWider={retryWider} radius={radius} setRadius={v=>{setRadius(v);clear()}} nearSpawn={nearSpawn} setNearSpawn={v=>{setNearSpawn(v);clear()}} rejected={rejected}
  supportBiomes={supportBiomes} supportStructures={supportStructures} searching={searching} progress={progress} rate={rate} message={message} results={results} current={seed} onOpen={r=>openResult(r)}
  onSearch={()=>search()} onStop={()=>{stop();setMessage(results.length?tr(`Ricerca interrotta: ${results.length} seed trovati.`,`Search stopped: ${results.length} seeds found.`):tr('Ricerca interrotta. Puoi modificare i criteri e riprovare.','Search stopped. You can change the criteria and try again.'))}} onRandom={random} onHelp={()=>setHelp(true)}/>
 <div className="world-column"><WorldMap seed={seed} version={packed} baseVersion={version} onError={setError} focus={focus} onViewChange={onViewChange} linkTo={p=>buildUrl({x:p.x,z:p.z,dim:p.dim,bpp:Math.min(viewRef.current.bpp,1),sel:p.type})}/><form className="seed-bar" onSubmit={e=>{e.preventDefault();try{stop();applySeed(input);setMessage(tr('Seed caricato. I criteri di composizione non sono applicati.','Seed loaded. Your composition criteria are not applied.'));setPreset(-1)}catch{/* shown by applySeed */}}}><label htmlFor="seed">{tr('SEED DEL MONDO','WORLD SEED')}</label><div className="seed-input"><input id="seed" value={input} onChange={e=>setInput(e.target.value)} spellCheck={false} autoComplete="off" aria-describedby={error?'seed-error':undefined}/><button className="icon-button" type="submit" aria-label={tr('Esplora questo seed','Explore this seed')}><Search size={18}/></button></div><button className="copy-button" type="button" onClick={copy}>{copied?<Check size={18}/>:<Copy size={18}/>}<span>{copied?tr('Copiato!','Copied!'):tr('Copia seed','Copy seed')}</span></button><button className="copy-button" type="button" onClick={share}>{shared?<Check size={18}/>:<Share2 size={18}/>}<span>{shared?tr('Link copiato!','Link copied!'):tr('Condividi','Share')}</span></button><button className={'copy-button'+(saved?' saved':'')} type="button" aria-pressed={saved} onClick={()=>{if(!saved)track('save-seed');fav.toggle(seed,version,large)}}><Star size={18} fill={saved?'currentColor':'none'}/><span>{saved?tr('Salvato','Saved'):tr('Salva','Save')}</span></button><button className="icon-button random-button" aria-label={tr('Genera seed casuale','Random seed')} type="button" onClick={random}><Shuffle size={19}/></button></form>
 {error&&<div className="error-notice" id="seed-error" role="alert">{error}<button aria-label={tr('Chiudi errore','Dismiss error')} onClick={()=>setError('')}><X size={16}/></button></div>}
 {fav.list.length>0&&<section className="favorites" aria-label={tr('Seed salvati','Saved seeds')}><div className="section-heading"><h2><Star size={18}/>{tr('I tuoi seed','Your seeds')}</h2><span>{tr('Salvati solo in questo browser.','Saved in this browser only.')}</span></div>
  <ul>{fav.list.map(f=><li key={f.seed+'|'+f.version+'|'+f.large} className={f.seed===seed&&f.version===version&&f.large===large?'current':''}><button className="fav-open" onClick={()=>{track('open-saved-seed');openFavorite(f)}}><code>{f.seed}</code><small>Java {versionOf(f.version)}{f.large?tr(' · biomi grandi',' · large biomes'):''}</small></button><button className="fav-remove" aria-label={tr(`Rimuovi il seed ${f.seed}`,`Remove seed ${f.seed}`)} onClick={()=>fav.remove(f)}><Trash2 size={15}/></button></li>)}</ul></section>}
 {PREVIEW_AVAILABLE&&<MinecraftPreview key={`${seed}:${packed}`} seed={seed} version={versionName||''} large={large} onSupportedVersion={()=>setVersion(26)}/>}
 <AdSlot/>
 <section className="presets"><div className="section-heading"><h2>{tr('Un punto di partenza','A place to start')}</h2><span>{tr('Scegli un’atmosfera, poi falla tua.','Pick a mood, then make it yours.')}</span></div><div className="preset-grid">{PRESETS.map((p,i)=>{const Icon=PRESET_ICONS[i]||Search;return <button disabled={searching} key={p.name} className={'preset '+(preset===i?'chosen':'')} onClick={()=>choosePreset(i)}><span className={'preset-art art-'+i}>{i===0?<img src={asset('landscape.webp')} alt=""/>:<Icon size={34} strokeWidth={1.1}/>}</span><span><strong>{p.name}</strong><small>{p.detail}</small></span><Search size={17}/></button>})}</div></section>
 <section className="about"><h2>{tr('Un cercatore di seed Minecraft che parte da ciò che vuoi','A Minecraft seed finder that starts from what you want')}</h2>
  <p>{tr('La maggior parte dei siti di seed parte da un numero e ti dice cosa c’è dentro. Seed Studio fa il contrario: scegli biomi, strutture, dimensione e versione di Minecraft Java, e la ricerca prova migliaia di seed al secondo, direttamente nel tuo browser, finché trova mondi che rispettano tutti i criteri.','Most seed sites start from a number and tell you what is inside. Seed Studio works the other way round: pick biomes, structures, dimension and Minecraft Java version, and the search tries thousands of seeds per second, right in your browser, until it finds worlds that match every criterion.')}</p>
  <div className="about-grid"><div><h3>{tr('Mappa dei biomi','Biome map')}</h3><p>{tr('Overworld, Nether ed End con rilievo, grotte, chunk di slime e tutte le strutture: villaggi, roccaforti con gli occhi già nel portale, città antiche, camere della prova, bastioni, città dell’End.','Overworld, Nether and End with relief, caves, slime chunks and every structure: villages, strongholds with eyes already in the portal, ancient cities, trial chambers, bastions, End cities.')}</p></div>
  <div><h3>{tr('Dalla 1.18 alla 26.3','From 1.18 to 26.3')}</h3><p>{tr('Il motore è Cubiomes compilato in WebAssembly e verificato nel gioco: le coordinate coincidono con i comandi /locate di Minecraft Java.','The engine is Cubiomes compiled to WebAssembly and checked in game: coordinates match Minecraft Java’s /locate commands.')}</p></div>
  <div><h3>{tr('Gratis e senza account','Free, no account')}</h3><p>{tr('Nessuna registrazione: i seed salvati restano nel tuo browser. Condividi un mondo con un link o scarica la mappa in PNG.','No sign-up: saved seeds stay in your browser. Share a world with a link or download the map as a PNG.')}</p></div></div></section>
 </div></div><footer><span>{tr('Un mondo da scegliere. Un’avventura da scrivere.','A world to choose. An adventure to write.')}</span><div className="footer-links">{SITE.supportUrl&&<a className="support-link" onClick={()=>track('kofi-footer')} href={SITE.supportUrl} target="_blank" rel="noreferrer"><Heart size={15}/>{tr('Sostieni Seed Studio','Support Seed Studio')}</a>}<a href={asset(EN?'privacy.html?lang=en':'privacy.html')}>{tr('Privacy','Privacy')}</a><button onClick={()=>setHelp(true)}>{tr('Cubiomes + Seeder · crediti e limiti','Cubiomes + Seeder · credits and limits')}</button></div></footer></main>
 <dialog ref={dialog} onCancel={()=>setHelp(false)} onClick={e=>{if(e.target===e.currentTarget)setHelp(false)}}><div className="dialog-content"><button className="dialog-close icon-button" onClick={()=>setHelp(false)} aria-label={tr('Chiudi guida','Close guide')}><X/></button><BookOpen className="dialog-icon" size={30}/><h2>{tr('Prima di partire','Before you start')}</h2>
 {EN?<>
  <p>A seed is the number Minecraft uses to generate a world. Text works too: the game turns it into a number, and so do we. <strong>Composing means choosing what to look for</strong>: the search tries real seeds, on several cores of your computer, until it finds the biomes and structures you asked for.</p>
  <h3><Search size={18}/>Your composition</h3><p>Each biome can be <strong>required</strong> (✓) or <strong>avoided</strong> (✕). Biomes, structures and the island must be inside the square around <strong>0, 0</strong> of the chosen dimension, within the radius you set: that is where the engine searches. In the Overworld each result is then measured again from its <strong>spawn</strong> (where you start playing) and, if the option is on, dropped when something is too far. The search stops at {MAX_RESULTS} results or after 60 seconds; no results does not mean the world is impossible.</p>
  <h3><MapPin size={18}/>What the map shows</h3><p>Biomes at 4-block resolution, with relief estimated by the terrain generator. With the height selector you can go underground and see lush caves, dripstone and the deep dark. The Nether and the End are in the map toolbar.</p>
  <h3><Layers size={18}/>Structures</h3><p>Villages, temples, outposts, monuments, mansions, ruined portals, ancient cities, trial chambers, trail ruins, strongholds (with the eyes already in the portal), fortresses, bastions and End cities. Every position is calculated as in the game and checked against biome and terrain; in rare cases the real terrain can still prevent generation. To check them in game, run <code>/locate</code> from close by: from far away it stops at the first structure it finds, not the nearest. Slime chunks are exact.</p>
  <h3><Share2 size={18}/>Sharing and saving</h3><p>The page address holds seed, version, dimension and map position: <strong>Share</strong> copies it, and a structure’s <strong>Link</strong> button leads straight to it. <strong>Save</strong> keeps the seed in this browser; <strong>PNG</strong> downloads the map view.</p>
  <h3>Use it in Minecraft</h3><p>Copy the seed. In <strong>Java Edition → Singleplayer → Create New World → World</strong>, paste it into the seed field. Use the same version and world type chosen here. Mods (Forge, NeoForge, Fabric) and datapacks that touch world generation change the result: with those the site does not match. Since 1.18 biomes and terrain also match on Bedrock, but structures do not: this site is made for Java.</p>
 </>:<>
  <p>Un seed è il numero con cui Minecraft genera un mondo. Anche un testo va bene: il gioco lo trasforma in un numero, e qui facciamo lo stesso. <strong>Comporre significa scegliere cosa cercare</strong>: la ricerca prova seed reali, su più core del tuo computer, finché trova biomi e strutture richiesti.</p>
  <h3><Search size={18}/>La tua composizione</h3><p>Ogni bioma può essere <strong>richiesto</strong> (✓) o <strong>da evitare</strong> (✕). Biomi, strutture e isola devono trovarsi nel quadrato intorno a <strong>0, 0</strong> della dimensione scelta, entro il raggio impostato: è lì che il motore cerca. Nell’Overworld ogni risultato viene poi rimisurato dal suo <strong>spawn</strong> (dove si comincia a giocare) e, se l’opzione è attiva, scartato quando qualcosa è troppo lontano. La ricerca si ferma a {MAX_RESULTS} risultati o dopo 60 secondi; nessun risultato non significa che il mondo sia impossibile.</p>
  <h3><MapPin size={18}/>Cosa mostra la mappa</h3><p>Biomi a risoluzione di 4 blocchi, con il rilievo stimato dal generatore del terreno. Con la quota puoi scendere sotto terra e vedere grotte rigogliose, speleotemi e oscurità profonda. Il Nether e l’End sono disponibili dalla barra della mappa.</p>
  <h3><Layers size={18}/>Strutture</h3><p>Villaggi, templi, avamposti, monumenti, magioni, portali in rovina, città antiche, camere della prova, rovine di sentiero, roccaforti (con gli occhi già nel portale), fortezze, bastioni e città dell’End. Ogni posizione è calcolata come nel gioco e verificata sul bioma e sul terreno; in rari casi il terreno reale può comunque impedirne la generazione. Per controllarle nel gioco, usa <code>/locate</code> da vicino: da lontano si ferma alla prima struttura che trova, non alla più vicina. I chunk di slime sono esatti.</p>
  <h3><Share2 size={18}/>Condividere e salvare</h3><p>L’indirizzo della pagina contiene seed, versione, dimensione e posizione della mappa: <strong>Condividi</strong> lo copia, e il pulsante <strong>Link</strong> di una struttura porta dritti a lei. <strong>Salva</strong> tiene il seed in questo browser; <strong>PNG</strong> scarica la vista della mappa.</p>
  <h3>Usalo in Minecraft</h3><p>Copia il seed. In <strong>Java Edition → Giocatore singolo → Crea un nuovo mondo → Mondo</strong>, incollalo nel campo seed. Usa la stessa versione e lo stesso tipo di mondo scelti qui. Mod (Forge, NeoForge, Fabric) e datapack che toccano la generazione del mondo cambiano il risultato: con quelli il sito non corrisponde. Dalla 1.18 biomi e terreno coincidono anche su Bedrock, ma le strutture no: questo sito è pensato per Java.</p>
 </>}
 <div className="credits"><a href="https://github.com/Cubitect/cubiomes" target="_blank" rel="noreferrer">Cubiomes <ExternalLink size={13}/></a><a href="https://github.com/TrinTragula/seeder" target="_blank" rel="noreferrer">Seeder <ExternalLink size={13}/></a><a href={asset('engine/licenses.txt')} target="_blank" rel="noreferrer">{tr('Licenza Cubiomes','Cubiomes licence')}</a><a href={asset('engine/LICENSE')} target="_blank" rel="noreferrer">{tr('Licenza Seeder','Seeder licence')}</a></div><small>{tr('Progetto indipendente, non affiliato a Mojang o Microsoft. Minecraft è un marchio di Mojang AB.','Independent project, not affiliated with Mojang or Microsoft. Minecraft is a trademark of Mojang AB.')}</small><button className="primary" onClick={()=>setHelp(false)}>{tr('Torniamo al mondo','Back to the world')}</button></div></dialog>
 </div>
}
