'use client';
import {useEffect,useRef,useState} from 'react';
import {Check,X,SlidersHorizontal,Search,Square,Shuffle,Info,LoaderCircle,ChevronDown,TreePalm,MapPin} from 'lucide-react';
import {BIOME_GROUPS,COLORS,DIMENSIONS,STRUCTURES,STRUCTURE_BY_ID,STRONGHOLD,VERSIONS,fmt,hex,type Dimension} from './data';
import names from './biome-names.json';
import {paint} from './tiles';

export type BiomeWish=Record<number,1|-1>;
export type ResultPreview={ids:Int32Array;heights:Int16Array|null;rgba:Uint8ClampedArray;x:number;z:number;w:number;h:number};
export type SearchResult={seed:string;spawnX:number;spawnZ:number;structures:{type:number;x:number;z:number}[];island:{width:number;length:number}|null;order:number;
 dim?:Dimension;ref?:{x:number;z:number};dists?:{kind:'s'|'b';id:number;d:number|null}[];score?:number;preview?:ResultPreview};
type Props={mode:string;version:number;setVersion:(v:number)=>void;large:boolean;setLarge:(v:boolean)=>void;
 dim:Dimension;setDim:(d:Dimension)=>void;biomes:BiomeWish;setBiomes:(v:BiomeWish)=>void;structures:number[];setStructures:(v:number[])=>void;
 island:number;setIsland:(v:number)=>void;radius:number;setRadius:(v:number)=>void;nearSpawn:boolean;setNearSpawn:(v:boolean)=>void;rejected:number;
 supportBiomes:Set<number>|null;supportStructures:Record<number,number>;
 searching:boolean;progress:number;rate:number;message:string;results:SearchResult[];current:string;onOpen:(r:SearchResult)=>void;
 onSearch:()=>void;onStop:()=>void;onRandom:()=>void;onHelp:()=>void};
const BIOME_NAMES=names as Record<string,string>;

/* A search result's little map: shaded biomes around the spawn, the spawn in lime and each
 * required structure as a coloured dot. */
function Thumb({r}:{r:SearchResult}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const c=ref.current,p=r.preview;if(!c||!p)return;c.width=p.w;c.height=p.h;const ctx=c.getContext('2d');if(!ctx)return;
  const img=ctx.createImageData(p.w,p.h);paint(img.data,{ids:p.ids,heights:p.heights,fallback:p.rgba},true,p.w,p.h,r.dim===1?{x0:p.x,z0:p.z}:null);ctx.putImageData(img,0,0);
  const dot=(x:number,z:number,col:string,rad:number)=>{const px=x/4-p.x,pz=z/4-p.z;if(px<0||pz<0||px>p.w||pz>p.h)return;ctx.beginPath();ctx.arc(px,pz,rad,0,Math.PI*2);ctx.fillStyle=col;ctx.fill();ctx.lineWidth=2.5;ctx.strokeStyle='#0e1512';ctx.stroke()};
  for(const s of r.structures)dot(s.x,s.z,STRUCTURE_BY_ID.get(s.type)?.color||'#fff',p.w/16);
  if(r.dim===0)dot(r.spawnX,r.spawnZ,'#cefd82',p.w/20);
 },[r]);
 return r.preview?<canvas ref={ref} className="thumb" aria-hidden="true"/>:<span className="thumb loading"><LoaderCircle size={14} className="spin"/></span>;
}

export default function Composer(p:Props){
 const [filter,setFilter]=useState(''),[sort,setSort]=useState('near'),[open,setOpen]=useState<Record<string,boolean>>({'Pianure e foreste':true});
 const groups=BIOME_GROUPS.filter(g=>g.dim===p.dim&&!g.cave);
 const wanted=Object.entries(p.biomes).filter(([,v])=>v===1).length,avoided=Object.entries(p.biomes).filter(([,v])=>v===-1).length;
 const cycle=(id:number)=>{const cur=p.biomes[id];const next={...p.biomes};if(!cur)next[id]=1;else if(cur===1)next[id]=-1;else delete next[id];p.setBiomes(next)};
 const structs=STRUCTURES.filter(s=>s.search&&s.id!==STRONGHOLD&&s.dims.includes(p.dim));
 const q=filter.trim().toLowerCase();
 const nothing=!wanted&&!avoided&&!p.structures.length&&!p.island;
 return <aside className="composer"><div className="panel-heading"><SlidersHorizontal size={18}/><span>{p.mode==='compose'?'Componi il tuo mondo':'Esplora un mondo'}</span></div><p className="panel-intro">{p.mode==='compose'?'Scegli biomi e strutture: troviamo il seed.':'Un numero. Infinite possibilità.'}</p>
 <div className="version-fields"><label>VERSIONE JAVA<select aria-label="Versione Minecraft" value={p.version} onChange={e=>p.setVersion(Number(e.target.value))} disabled={p.searching}>{VERSIONS.map(v=><option value={v.id} key={v.id}>{v.name}</option>)}</select></label><label>TIPO DI MONDO<select aria-label="Tipo di mondo" value={p.large?'large':'default'} onChange={e=>p.setLarge(e.target.value==='large')} disabled={p.searching}><option value="default">Predefinito</option><option value="large">Biomi grandi</option></select></label></div>
 <p className="field-note mods-note">Vale per Minecraft Java vanilla. Mod (Forge, NeoForge, Fabric) e datapack che cambiano la generazione del mondo rendono diversi biomi e strutture.</p>
 {p.mode==='compose'?<>
  <div className="divider"/>
  <div className="field-title"><span>DIMENSIONE</span></div>
  <div className="segmented" role="group" aria-label="Dimensione della ricerca">{DIMENSIONS.map(d=><button key={d.id} aria-pressed={p.dim===d.id} className={p.dim===d.id?'active':''} disabled={p.searching} onClick={()=>p.setDim(d.id)}>{d.name}</button>)}</div>
  <div className="divider"/>
  <div className="field-title"><span>BIOMI</span><small>{wanted} richiesti{avoided?` · ${avoided} esclusi`:''}</small></div>
  <p className="field-note tight">Un clic: <Check size={11}/> deve esserci · due clic: <X size={11}/> da evitare · tre: nessuna preferenza.</p>
  {groups.length>1&&<input className="filter-input" placeholder="Filtra i biomi…" value={filter} onChange={e=>setFilter(e.target.value)} aria-label="Filtra i biomi"/>}
  <div className="biome-groups">{groups.map(g=>{const ids=g.ids.filter(id=>!q||BIOME_NAMES[id]?.toLowerCase().includes(q));if(!ids.length)return null;const isOpen=groups.length===1||!!q||open[g.name]||ids.some(id=>p.biomes[id]);
   return <div key={g.name} className="biome-group">{groups.length>1&&<button className="group-head" aria-expanded={isOpen} onClick={()=>setOpen({...open,[g.name]:!open[g.name]})}><span>{g.name}</span><small>{ids.filter(id=>p.biomes[id]).length||''}</small><ChevronDown size={15} className={isOpen?'flip':''}/></button>}
    {isOpen&&<div className="biome-grid">{ids.map(id=>{const st=p.biomes[id];const ok=!p.supportBiomes||p.supportBiomes.has(id);return <button disabled={p.searching||(!ok&&!st)} key={id} aria-pressed={!!st} title={ok?undefined:'Non esiste in questa versione'} className={'biome '+(st===1?'selected':st===-1?'avoided':'')} onClick={()=>cycle(id)}><i style={{background:hex(COLORS[id]||[128,128,128])}}/><span>{BIOME_NAMES[id]}</span>{st===1&&<Check size={15}/>}{st===-1&&<X size={15}/>}</button>})}</div>}
   </div>})}</div>
  <div className="divider"/>
  <div className="field-title"><span>STRUTTURE</span><small>{p.structures.length} di 8 max</small></div>
  <div className="struct-grid">{structs.map(s=>{const on=p.structures.includes(s.id);const ok=p.supportStructures[s.id]!==undefined?p.supportStructures[s.id]!==-100:true;const Icon=s.icon;
   return <button key={s.id} disabled={p.searching||(!ok&&!on)||(!on&&p.structures.length>=8)} title={ok?s.note:'Non esiste in questa versione'} aria-pressed={on} className={'struct '+(on?'selected':'')} onClick={()=>p.setStructures(on?p.structures.filter(i=>i!==s.id):[...p.structures,s.id])}><i style={{background:s.color}}><Icon size={12}/></i><span>{s.name}</span></button>})}</div>
  {p.dim===0&&<label className="village-check"><input type="checkbox" checked={p.island>0} onChange={e=>p.setIsland(e.target.checked?128:0)} disabled={p.searching}/><span><TreePalm size={15}/> Spawn su un’isola</span></label>}
  {p.dim===0&&p.island>0&&<div className="island-size"><span>Isola entro</span>{[64,128,256].map(n=><button key={n} className={p.island===n?'active':''} onClick={()=>p.setIsland(n)} disabled={p.searching}>{n}</button>)}<span>blocchi</span></div>}
  <div className="divider"/>
  <label className="range-title" htmlFor="radius">RAGGIO DI RICERCA<strong>±{fmt(p.radius)} <span>blocchi</span></strong></label><input id="radius" type="range" min={256} max={2048} step={128} value={p.radius} onChange={e=>p.setRadius(Number(e.target.value))} disabled={p.searching}/><div className="range-labels"><span>256</span><span>2.048</span></div>
  <p className="field-note">Tutto deve trovarsi nel quadrato intorno a X 0 / Z 0{p.dim===-1?' del Nether':''}.{p.structures.includes(21)&&p.radius<1024?' Le città dell’End richiedono almeno 1.024 blocchi.':''}</p>
  {p.dim===0&&<label className="village-check"><input type="checkbox" checked={p.nearSpawn} onChange={e=>p.setNearSpawn(e.target.checked)} disabled={p.searching}/><span>Tutto entro il raggio anche dallo spawn</span></label>}
  <div className="search-action">{p.searching?<button className="primary" onClick={p.onStop}><Square size={17}/>Interrompi ricerca</button>:<button className="primary" disabled={nothing} onClick={p.onSearch}><Search size={18}/>Cerca seed</button>}
   <div className={'search-message '+(p.searching?'running':'')} role="status">{p.searching&&<LoaderCircle size={14} className="spin"/>}{p.searching?`${fmt(p.progress)} seed esaminati${p.rate?` · ${fmt(p.rate)}/s`:''}…`:p.message||'Tutti i criteri, nello stesso mondo.'}</div>
  </div>
  {p.results.length>0&&<div className="results"><div className="field-title"><span>RISULTATI</span><select aria-label="Ordina i risultati" value={sort} onChange={e=>setSort(e.target.value)}><option value="near">Più compatti prima</option><option value="order">In ordine di ritrovamento</option></select></div>
   {p.rejected>0&&<small className="field-note">{p.rejected} scartati: qualcosa era troppo lontano dallo spawn.</small>}
   {[...p.results].sort((a,b)=>sort==='near'?(a.score??0)-(b.score??0):a.order-b.order).map(r=>{const where=r.dim===0?'dallo spawn':r.dim===-1?'da 0, 0':'dal centro';return <button key={r.seed} className={'result'+(p.current===r.seed?' active':'')} onClick={()=>p.onOpen(r)}><Thumb r={r}/><span className="result-body"><code>{r.seed}</code>
    {r.score!=null&&Number.isFinite(r.score)&&r.dists&&r.dists.length>0&&<strong>Tutto entro {fmt(r.score)} blocchi {where}</strong>}
    <small><MapPin size={11}/>Spawn {fmt(r.spawnX)}, {fmt(r.spawnZ)}{r.island?` · isola ${r.island.width}×${r.island.length}`:''}</small>
    {r.dists&&r.dists.length>0&&<span className="dist-tags">{r.dists.map(d=><span key={d.kind+d.id}>{d.kind==='s'?STRUCTURE_BY_ID.get(d.id)?.name:BIOME_NAMES[d.id]} {d.d==null?'oltre il raggio':fmt(d.d)}</span>)}</span>}</span></button>})}</div>}
 </>:<div className="explore-intro"><Search size={34}/><h2>Dove vuoi andare?</h2><p>Inserisci un seed (anche testo, come nel gioco) sotto la mappa o lasciati sorprendere.</p><button className="primary" onClick={p.onRandom}><Shuffle size={18}/>Seed casuale</button><div className="divider"/><h3>Muoviti liberamente</h3><p>Trascina per esplorare, usa la rotella per lo zoom. Clicca un’icona per i dettagli della struttura, o un punto qualsiasi per bioma e quota. Cambia dimensione e profondità dalla barra della mappa.</p></div>}
 <button className="help-link" onClick={p.onHelp}><Info size={15}/>Come funziona un seed?</button></aside>}
