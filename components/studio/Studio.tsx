'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Boxes,HelpCircle,Copy,Check,Shuffle,Flower2,Mountain,TreePalm,Timer,KeyRound,Flame,X,BookOpen,MapPin,ExternalLink,Search,Layers,Share2} from 'lucide-react';
import WorldMap,{type MapFocus,type MapView} from './WorldMap';
import MinecraftPreview from './MinecraftPreview';
import Composer,{type BiomeWish,type SearchResult} from './Composer';
import {PRESETS,BIOME_GROUPS,STRUCTURES,STRONGHOLD,normalizeSeed,randomSeed,VERSIONS,packVersion,type Dimension} from './data';
import {rpc} from './engine-client';

const PRESET_ICONS=[Flower2,Mountain,TreePalm,Timer,KeyRound,Flame];
const MAX_RESULTS=8,TIME_LIMIT=60000;
const now=()=>performance.now();
let focusSeq=0,searchSeq=0;
type Preview={ids:Int32Array;heights:Int16Array|null;rgba:Uint8ClampedArray;x:number;z:number;w:number;h:number;biomeDist:Record<number,number|null>};
const ALL_BIOMES=BIOME_GROUPS.flatMap(g=>g.ids);

export default function Studio(){
 const [mode,setMode]=useState('compose'),[seed,setSeed]=useState('8678942899319966093'),[input,setInput]=useState('8678942899319966093'),[version,setVersion]=useState(26),[large,setLarge]=useState(false);
 const [sDim,setSDim]=useState<Dimension>(0),[biomes,setBiomes]=useState<BiomeWish>({185:1,1:1}),[structures,setStructures]=useState<number[]>([5]),[island,setIsland]=useState(0),[radius,setRadius]=useState(1024),[nearSpawn,setNearSpawn]=useState(true),[rejected,setRejected]=useState(0);
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
  const s=q.get('seed');if(s){try{const n=normalizeSeed(s);setSeed(n);setInput(n);setMode('explore')}catch{}}
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
 const share=async()=>{try{await navigator.clipboard.writeText(buildUrl());setShared(true);setTimeout(()=>setShared(false),2200)}catch{setError('Copia non disponibile: copia l’indirizzo dalla barra del browser.')}};

 const stop=()=>{pool.current.forEach(w=>w.terminate());pool.current=[];if(timer.current)clearTimeout(timer.current);setSearching(false)};
 useEffect(()=>()=>{pool.current.forEach(w=>w.terminate());if(timer.current)clearTimeout(timer.current);if(copyTimer.current)clearTimeout(copyTimer.current)},[]);
 useEffect(()=>{if(help){lastTrigger.current=document.activeElement as HTMLElement;dialog.current?.showModal()}else{dialog.current?.close();lastTrigger.current?.focus()}},[help]);
 useEffect(()=>{let live=true;rpc<{biomes:number[];structures:Record<number,number>}>('support',{version,biomes:ALL_BIOMES,structures:STRUCTURES.filter(s=>s.id!==STRONGHOLD).map(s=>s.id)}).then(r=>{if(!live)return;setSupportBiomes(new Set(r.biomes));setSupportStructures(r.structures)}).catch(()=>{});return()=>{live=false}},[version]);

 const applySeed=(value:string)=>{try{const s=normalizeSeed(value);setSeed(s);setInput(s);setError('');return s}catch(e){const m=(e as Error).message;setError(m);throw e}};
 const openResult=(r:SearchResult,dim:Dimension=r.dim??sDim)=>{applySeed(r.seed);const first=r.structures[0];const c=r.ref||(dim===0?{x:r.spawnX,z:r.spawnZ}:{x:0,z:0});setFocus({n:++focusSeq,dim,x:first?first.x:c.x,z:first?first.z:c.z,type:first?.type})};

 type Criteria={biomes:BiomeWish;structures:number[];island:number;dim:Dimension;radius?:number};
 const search=(c?:Criteria)=>{
  stop();setError('');setMessage('');setProgress(0);setRate(0);setResults([]);setRejected(0);
  const token=++searchSeq;
  const cr:Criteria=c||{biomes,structures,island,dim:sDim};
  const want=Object.keys(cr.biomes).map(Number).filter(id=>cr.biomes[id]===1),avoid=Object.keys(cr.biomes).map(Number).filter(id=>cr.biomes[id]===-1);
  const structs=cr.structures.filter(id=>supportStructures[id]===undefined||supportStructures[id]!==-100);
  let range=cr.radius??radius;if(structs.includes(21)&&range<1024){range=1024;setRadius(1024)}
  if(!want.length&&!avoid.length&&!structs.length&&!cr.island)return;
  const fromSpawn=nearSpawn&&cr.dim===0;
  setSearching(true);
  const shard=structs.length?4096:cr.island&&!want.length&&!avoid.length?128:8;
  let done=0,found:SearchResult[]=[],waiting=0,dropped=0;const seen=new Set<string>();const live=new Map<Worker,number>();const t0=now();
  const total=()=>done+[...live.values()].reduce((a,b)=>a+b,0);
  const tickProgress=()=>{const n=total();setProgress(n);const s=(now()-t0)/1000;if(s>1)setRate(Math.round(n/s))};
  const finish=(msg:string)=>{stop();setMessage(msg)};
  /* Every hit gets a little map and is re-measured from its spawn (Overworld): the engine
   * searches around 0, 0, but players start at spawn. */
  const enrich=async(r:SearchResult)=>{
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
  for(let i=0;i<n;i++){const w=new Worker('/engine/studio-worker.js');pool.current.push(w);
   w.onerror=()=>{finish('');setError('Il motore di ricerca non risponde. Riprova.')};
   w.onmessage=({data:m})=>{
    if(m.kind==='ready')dispatch(w);
    else if(m.kind==='SEED_UPDATE'){live.set(w,m.data.examined);tickProgress()}
    else if(m.kind==='SEED_FOUND'){const r:SearchResult={seed:BigInt.asIntN(64,BigInt(m.data.seed)).toString(),spawnX:m.data.spawnX,spawnZ:m.data.spawnZ,structures:m.data.structures,island:m.data.island,order:0};
     if(seen.has(r.seed)||found.length+waiting>=MAX_RESULTS+4)return;seen.add(r.seed);waiting++;
     enrich(r).then(er=>{waiting--;if(token!==searchSeq)return;
      if(fromSpawn&&er.score>range){dropped++;setRejected(dropped);return}
      if(found.length>=MAX_RESULTS)return;
      found=[...found,{...er,order:found.length}];setResults(found);if(found.length===1)openResult(found[0],cr.dim);
      if(found.length>=MAX_RESULTS)finish(`${MAX_RESULTS} seed trovati con tutti i criteri. Clicca un risultato per esplorarlo.`)
     }).catch(()=>{waiting--})}
    else if(m.kind==='complete'){if(m.error){finish('');setError(m.error.code===-9?'Le città dell’End sono solo oltre i 1.008 blocchi: aumenta il raggio.':m.error.code===-5?'Il raggio è troppo grande per queste strutture: riducilo.':m.error.code===-6?'Uno dei biomi non esiste in questa versione o dimensione.':'Questa combinazione non può essere cercata. Modifica i criteri.');return}
     done+=m.examined;live.delete(w);tickProgress();dispatch(w)}
    else if(m.kind==='error'){finish('');setError('Errore durante la ricerca. Riprova con un raggio più piccolo.')}
   }}
  timer.current=setTimeout(()=>{const k=found.length;const extra=dropped?` ${dropped} scartati perché troppo lontani dallo spawn.`:'';finish(k?`${k} seed trovati in 60 secondi.${extra} Clicca un risultato per esplorarlo.`:`Nessun risultato in 60 secondi.${extra} Prova un raggio più ampio o meno criteri: non significa che il mondo sia impossibile.`)},TIME_LIMIT);
 };
 const choosePreset=(i:number)=>{const p=PRESETS[i];const b:BiomeWish={};p.biomes.forEach(id=>b[id]=1);setPreset(i);setMode('compose');setSDim(p.dimension);setBiomes(b);setStructures(p.structures);setIsland(p.island);setRadius(p.radius);search({biomes:b,structures:p.structures,island:p.island,dim:p.dimension,radius:p.radius})};
 const random=()=>{stop();applySeed(randomSeed());setMessage('Seed casuale: i criteri di composizione non sono applicati.');setPreset(-1)};
 useEffect(()=>{const c=(document as Document&{modelContext?:{registerTool:(t:unknown,o:unknown)=>Promise<void>}}).modelContext;if(!c?.registerTool)return;const ac=new AbortController();Promise.resolve(c.registerTool({name:'explore_minecraft_seed',description:'Mostra la mappa di un seed Minecraft Java. Non effettua una ricerca per criteri.',inputSchema:{type:'object',properties:{seed:{type:'string'}},required:['seed'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async(v:{seed:string})=>{if(!v||typeof v.seed!=='string')throw new Error('Seed richiesto');const s=normalizeSeed(v.seed);setSeed(s);setInput(s);setMode('explore');return{seed:s,status:'map_requested'}}},{signal:ac.signal})).catch(()=>{});return()=>ac.abort()},[]);
 const copy=async()=>{try{await navigator.clipboard.writeText(seed);setCopied(true);copyTimer.current=setTimeout(()=>setCopied(false),2200)}catch{setError('Copia automatica non disponibile: seleziona il numero nel campo Seed.')}};
 const versionName=useMemo(()=>VERSIONS.find(v=>v.id===version)?.name,[version]);
 const clear=()=>setMessage('');

 return <div className="studio"><header className="site-header"><a className="brand" href="/" aria-label="Seed Studio, inizio"><span className="brand-icon"><Boxes size={26}/></span><b>SEED</b><span className="slash">/</span><span>STUDIO</span></a><nav aria-label="Principale"><button className={mode==='explore'?'active':''} onClick={()=>setMode('explore')}>Esplora</button><button className={mode==='compose'?'active':''} onClick={()=>setMode('compose')}>Componi</button></nav><button className="guide-button" onClick={()=>setHelp(true)}><HelpCircle size={20}/><span>Guida</span></button></header>
 <main><div className="page-heading"><div><h1>Il tuo prossimo mondo, da qui.</h1><p>Biomi, strutture, Nether ed End: tutto calcolato come nel gioco.</p></div><span className="edition-label">Minecraft Java <b>{versionName}{large?' · biomi grandi':''}</b></span></div>
 <div className="workspace"><Composer mode={mode} version={version} setVersion={v=>{setVersion(v);clear()}} large={large} setLarge={v=>{setLarge(v);clear()}} dim={sDim} setDim={d=>{setSDim(d);setBiomes({});setStructures(s=>s.filter(id=>STRUCTURES.find(x=>x.id===id)?.dims.includes(d)));setPreset(-1);clear()}}
  biomes={biomes} setBiomes={v=>{setBiomes(v);setPreset(-1);clear()}} structures={structures} setStructures={v=>{setStructures(v);setPreset(-1);clear()}} island={island} setIsland={v=>{setIsland(v);setPreset(-1);clear()}} radius={radius} setRadius={v=>{setRadius(v);clear()}} nearSpawn={nearSpawn} setNearSpawn={v=>{setNearSpawn(v);clear()}} rejected={rejected}
  supportBiomes={supportBiomes} supportStructures={supportStructures} searching={searching} progress={progress} rate={rate} message={message} results={results} current={seed} onOpen={r=>openResult(r)}
  onSearch={()=>search()} onStop={()=>{stop();setMessage(results.length?`Ricerca interrotta: ${results.length} seed trovati.`:'Ricerca interrotta. Puoi modificare i criteri e riprovare.')}} onRandom={random} onHelp={()=>setHelp(true)}/>
 <div className="world-column"><WorldMap seed={seed} version={packed} baseVersion={version} onError={setError} focus={focus} onViewChange={onViewChange} linkTo={p=>buildUrl({x:p.x,z:p.z,dim:p.dim,bpp:Math.min(viewRef.current.bpp,1),sel:p.type})}/><form className="seed-bar" onSubmit={e=>{e.preventDefault();try{stop();applySeed(input);setMessage('Seed caricato. I criteri di composizione non sono applicati.');setPreset(-1)}catch{}}}><label htmlFor="seed">SEED DEL MONDO</label><div className="seed-input"><input id="seed" value={input} onChange={e=>setInput(e.target.value)} spellCheck={false} autoComplete="off" aria-describedby={error?'seed-error':undefined}/><button className="icon-button" type="submit" aria-label="Esplora questo seed"><Search size={18}/></button></div><button className="copy-button" type="button" onClick={copy}>{copied?<Check size={18}/>:<Copy size={18}/>}<span>{copied?'Copiato!':'Copia seed'}</span></button><button className="copy-button" type="button" onClick={share}>{shared?<Check size={18}/>:<Share2 size={18}/>}<span>{shared?'Link copiato!':'Condividi'}</span></button><button className="icon-button random-button" aria-label="Genera seed casuale" type="button" onClick={random}><Shuffle size={19}/></button></form>
 {error&&<div className="error-notice" id="seed-error" role="alert">{error}<button aria-label="Chiudi errore" onClick={()=>setError('')}><X size={16}/></button></div>}
 <MinecraftPreview key={`${seed}:${packed}`} seed={seed} version={versionName||''} large={large} onSupportedVersion={()=>setVersion(26)}/>
 <section className="presets"><div className="section-heading"><h2>Un punto di partenza</h2><span>Scegli un’atmosfera, poi falla tua.</span></div><div className="preset-grid">{PRESETS.map((p,i)=>{const Icon=PRESET_ICONS[i]||Search;return <button disabled={searching} key={p.name} className={'preset '+(preset===i?'chosen':'')} onClick={()=>choosePreset(i)}><span className={'preset-art art-'+i}>{i===0?<img src="/landscape.webp" alt=""/>:<Icon size={34} strokeWidth={1.1}/>}</span><span><strong>{p.name}</strong><small>{p.detail}</small></span><Search size={17}/></button>})}</div></section>
 </div></div><footer><span>Un mondo da scegliere. Un’avventura da scrivere.</span><button onClick={()=>setHelp(true)}>Cubiomes + Seeder · crediti e limiti</button></footer></main>
 <dialog ref={dialog} onCancel={()=>setHelp(false)} onClick={e=>{if(e.target===e.currentTarget)setHelp(false)}}><div className="dialog-content"><button className="dialog-close icon-button" onClick={()=>setHelp(false)} aria-label="Chiudi guida"><X/></button><BookOpen className="dialog-icon" size={30}/><h2>Prima di partire</h2><p>Un seed è il numero con cui Minecraft genera un mondo. Anche un testo va bene: il gioco lo trasforma in un numero, e qui facciamo lo stesso. <strong>Comporre significa scegliere cosa cercare</strong>: la ricerca prova seed reali, su più core del tuo computer, finché trova biomi e strutture richiesti.</p><h3><Search size={18}/>La tua composizione</h3><p>Ogni bioma può essere <strong>richiesto</strong> (✓) o <strong>da evitare</strong> (✕). Biomi, strutture e isola devono trovarsi nel quadrato intorno a <strong>0, 0</strong> della dimensione scelta, entro il raggio impostato: è lì che il motore cerca. Nell’Overworld ogni risultato viene poi rimisurato dal suo <strong>spawn</strong> (dove si comincia a giocare) e, se l’opzione è attiva, scartato quando qualcosa è troppo lontano. La ricerca si ferma a {MAX_RESULTS} risultati o dopo 60 secondi; nessun risultato non significa che il mondo sia impossibile.</p><h3><MapPin size={18}/>Cosa mostra la mappa</h3><p>Biomi a risoluzione di 4 blocchi, con il rilievo stimato dal generatore del terreno. Con la quota puoi scendere sotto terra e vedere grotte rigogliose, speleotemi e oscurità profonda. Il Nether e l’End sono disponibili dalla barra della mappa.</p><h3><Layers size={18}/>Strutture</h3><p>Villaggi, templi, avamposti, monumenti, magioni, portali in rovina, città antiche, camere della prova, rovine di sentiero, roccaforti (con gli occhi già nel portale), fortezze, bastioni e città dell’End. Ogni posizione è calcolata come nel gioco e verificata sul bioma e sul terreno; in rari casi il terreno reale può comunque impedirne la generazione. Per controllarle nel gioco, usa <code>/locate</code> da vicino: da lontano si ferma alla prima struttura che trova, non alla più vicina. I chunk di slime sono esatti.</p><h3><Share2 size={18}/>Condividere</h3><p>L’indirizzo della pagina contiene seed, versione, dimensione e posizione della mappa: <strong>Condividi</strong> lo copia, e il pulsante <strong>Link</strong> di una struttura porta dritti a lei.</p><h3>Usalo in Minecraft</h3><p>Copia il seed. In <strong>Java Edition → Giocatore singolo → Crea un nuovo mondo → Mondo</strong>, incollalo nel campo seed. Usa la stessa versione e lo stesso tipo di mondo scelti qui. Mod (Forge, NeoForge, Fabric) e datapack che toccano la generazione del mondo cambiano il risultato: con quelli il sito non corrisponde. Dalla 1.18 biomi e terreno coincidono anche su Bedrock, ma le strutture no: questo sito è pensato per Java.</p><div className="credits"><a href="https://github.com/Cubitect/cubiomes" target="_blank" rel="noreferrer">Cubiomes <ExternalLink size={13}/></a><a href="https://github.com/TrinTragula/seeder" target="_blank" rel="noreferrer">Seeder <ExternalLink size={13}/></a><a href="/engine/licenses.txt" target="_blank">Licenza Cubiomes</a><a href="/engine/LICENSE" target="_blank">Licenza Seeder</a></div><small>Progetto indipendente, non affiliato a Mojang o Microsoft.</small><button className="primary" onClick={()=>setHelp(false)}>Torniamo al mondo</button></div></dialog>
 </div>
}
