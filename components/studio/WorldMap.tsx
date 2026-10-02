'use client';
import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {Plus,Minus,LocateFixed,MapPin,Compass,Maximize,Minimize,LoaderCircle,X,Copy,Check,Crosshair,Layers,Mountain,Navigation,Link2} from 'lucide-react';
import {COLORS,DIMENSIONS,HEIGHTS,STRUCTURES,STRUCTURE_BY_ID,STRONGHOLD,DEFAULT_LAYERS,LOCATE_ID,fmt,hex,type Dimension} from './data';
import names from './biome-names.json';
import {TileEngine,TILE_BLOCKS,TILE_CELLS,type TileKey} from './tiles';
import {rpc} from './engine-client';

export type MapFocus={n:number;dim:Dimension;x:number;z:number;type?:number;bpp?:number;y?:number};
export type MapView={dim:Dimension;x:number;z:number;bpp:number;y:number};
type Props={seed:string;version:number;baseVersion:number;onError:(s:string)=>void;focus?:MapFocus|null;onViewChange?:(v:MapView)=>void;linkTo?:(p:{x:number;z:number;type:number|null;dim:Dimension})=>string};
type View={cx:number;cz:number;bpp:number};
type Poi={type:number;x:number;z:number};
type Info={biome?:number;height?:number;y?:number;tags?:string[];eyes?:number;libraries?:number;portal?:{x:number;z:number}|null};
type Selected={type:number|null;x:number;z:number;info?:Info|null};
type Summary={spawnX:number;spawnZ:number;spawnBiome:number;approxHeight:number|null};

const BIOME_NAMES=names as Record<string,string>;
const biomeName=(id:number|undefined)=>id==null||id<0?'—':BIOME_NAMES[id]||'Bioma '+id;
const MIN_BPP=.25,MAX_BPP=8;
const clampBpp=(b:number)=>Math.max(MIN_BPP,Math.min(MAX_BPP,b));

export default function WorldMap({seed,version,baseVersion,onError,focus,onViewChange,linkTo}:Props){
 const canvas=useRef<HTMLCanvasElement>(null),wrap=useRef<HTMLDivElement>(null),engine=useRef<TileEngine|null>(null);
 const drag=useRef<{x:number;y:number;cx:number;cz:number;moved:boolean}|null>(null),raf=useRef(0),overlaySeq=useRef(0),touches=useRef(new Map<number,{x:number;y:number}>()),pinch=useRef<{d:number;bpp:number}|null>(null),pinned=useRef(false);
 const [size,setSize]=useState({w:0,h:0}),[view,setView]=useState<View>({cx:0,cz:0,bpp:2});
 const [dim,setDim]=useState<Dimension>(0),[y,setY]=useState(256),[mode,setMode]=useState<'relief'|'biomes'>('relief');
 const [layers,setLayers]=useState<Set<number>>(()=>new Set(DEFAULT_LAYERS)),[slime,setSlime]=useState(false),[grid,setGrid]=useState(false),[layerPanel,setLayerPanel]=useState(false);
 const [summary,setSummary]=useState<Summary|null>(null),[pois,setPois]=useState<Poi[]>([]),[strongholds,setStrongholds]=useState<Poi[]>([]),[slimes,setSlimes]=useState<number[]|null>(null);
 const [available,setAvailable]=useState<Record<number,number>>({}),[nearest,setNearest]=useState<Poi[]>([]),[legend,setLegend]=useState<number[]>([]);
 const [selected,setSelected]=useState<Selected|null>(null),[hover,setHover]=useState('Trascina per esplorare · rotella per lo zoom'),[expanded,setExpanded]=useState(false),[busy,setBusy]=useState(true),[error,setError]=useState(''),[tick,setTick]=useState(0),[copied,setCopied]=useState('');
 const [goto,setGoto]=useState({x:'',z:''});

 const tileKey:TileKey=useMemo(()=>({seed,version,dim,y:dim===0?y:64}),[seed,version,dim,y]);

 /* ---- engine lifecycle ---- */
 useEffect(()=>{
  const n=Math.max(2,Math.min(4,(navigator.hardwareConcurrency||4)-1));
  const e=new TileEngine(n);engine.current=e;
  e.onTile=()=>{cancelAnimationFrame(raf.current);raf.current=requestAnimationFrame(()=>setTick(t=>t+1))};
  e.onError=m=>{setError(m);onError(m)};
  return()=>{e.dispose();engine.current=null}
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 useEffect(()=>{const o=new ResizeObserver(en=>{const r=en[0].contentRect;setSize({w:Math.round(r.width),h:Math.round(r.height)})});if(wrap.current)o.observe(wrap.current);return()=>o.disconnect()},[]);

 /* ---- seed / version: spawn, then centre on it ---- */
 // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when the world changes
 useEffect(()=>{let live=true;pinned.current=false;setSummary(null);setSelected(null);setError('');
  rpc<{summary:Summary}>('summary',{seed,version}).then(r=>{if(!live)return;setSummary(r.summary);if(!pinned.current)setView(v=>({...v,cx:dim===-1?Math.round(r.summary.spawnX/8):dim===1?0:r.summary.spawnX,cz:dim===-1?Math.round(r.summary.spawnZ/8):dim===1?0:r.summary.spawnZ}))}).catch(e=>{if(live){setError(e.message);onError(e.message)}});
  return()=>{live=false}
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[seed,version]);
 useEffect(()=>{let live=true;rpc<{structures:Record<number,number>}>('support',{version:baseVersion,biomes:[],structures:STRUCTURES.filter(s=>s.id!==STRONGHOLD).map(s=>s.id)}).then(r=>{if(live)setAvailable(r.structures)}).catch(()=>{});return()=>{live=false}},[baseVersion]);

 /* ---- external focus (search results, nearby list) ---- */
 // eslint-disable-next-line react-hooks/set-state-in-effect -- an external request to move the map
 useEffect(()=>{if(!focus)return;pinned.current=true;setDim(focus.dim);if(focus.y!=null)setY(focus.y);setView(v=>({...v,cx:focus.x,cz:focus.z,bpp:focus.bpp?clampBpp(focus.bpp):Math.min(v.bpp,2)}));setSelected(focus.type!=null?{type:focus.type,x:focus.x,z:focus.z}:null)},[focus]);

 const switchDim=(d:Dimension)=>{if(d===dim)return;setSelected(null);setView(v=>{let cx=v.cx,cz=v.cz;if(dim===0&&d===-1){cx=Math.round(cx/8);cz=Math.round(cz/8)}else if(dim===-1&&d===0){cx*=8;cz*=8}else if(d===1){cx=0;cz=0}else if(dim===1&&summary){cx=d===0?summary.spawnX:Math.round(summary.spawnX/8);cz=d===0?summary.spawnZ:Math.round(summary.spawnZ/8)}return{...v,cx,cz}});setDim(d)};

 const typeVisible=useCallback((id:number)=>{const m=STRUCTURE_BY_ID.get(id);if(!m||!m.dims.includes(dim))return false;if(id===STRONGHOLD)return true;return available[id]!==undefined&&available[id]!==-100},[dim,available]);
 const layerTypes=useMemo(()=>STRUCTURES.filter(s=>typeVisible(s.id)),[typeVisible]);

 /* ---- drawing ---- */
 const rect=useCallback((v:View=view)=>{const hw=size.w/2*v.bpp,hh=size.h/2*v.bpp;return{x0:v.cx-hw,z0:v.cz-hh,x1:v.cx+hw,z1:v.cz+hh}},[view,size]);
 useLayoutEffect(()=>{
  const c=canvas.current,e=engine.current;if(!c||!e||!size.w)return;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  if(c.width!==Math.round(size.w*dpr)||c.height!==Math.round(size.h*dpr)){c.width=Math.round(size.w*dpr);c.height=Math.round(size.h*dpr)}
  const ctx=c.getContext('2d');if(!ctx)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=dim===-1?'#2a1614':dim===1?'#0d0c16':'#16231e';ctx.fillRect(0,0,size.w,size.h);
  ctx.imageSmoothingEnabled=view.bpp>=4;
  const {x0,z0,x1,z1}=rect();const tx0=Math.floor(x0/TILE_BLOCKS),tx1=Math.floor(x1/TILE_BLOCKS),tz0=Math.floor(z0/TILE_BLOCKS),tz1=Math.floor(z1/TILE_BLOCKS);
  const wish:{tx:number;tz:number;prio:number}[]=[];const ts=TILE_BLOCKS/view.bpp;
  for(let tz=tz0;tz<=tz1;tz++)for(let tx=tx0;tx<=tx1;tx++){
   const key=e.tileKey(tileKey,tx,tz),img=e.canvas(key,mode),sx=Math.floor((tx*TILE_BLOCKS-x0)/view.bpp),sz=Math.floor((tz*TILE_BLOCKS-z0)/view.bpp);
   if(img)ctx.drawImage(img,sx,sz,Math.ceil(ts)+1,Math.ceil(ts)+1);
   else{ctx.fillStyle='#ffffff08';ctx.fillRect(sx+1,sz+1,ts-2,ts-2);wish.push({tx,tz,prio:Math.hypot((tx+.5)*TILE_BLOCKS-view.cx,(tz+.5)*TILE_BLOCKS-view.cz)})}
  }
  // one ring of tiles around the view, so small pans are already there
  for(let tz=tz0-1;tz<=tz1+1;tz++)for(let tx=tx0-1;tx<=tx1+1;tx++)if(tz<tz0||tz>tz1||tx<tx0||tx>tx1)wish.push({tx,tz,prio:1e7+Math.hypot((tx+.5)*TILE_BLOCKS-view.cx,(tz+.5)*TILE_BLOCKS-view.cz)});
  e.want(tileKey,wish);setBusy(wish.some(w=>w.prio<1e7));
  if(slime&&slimes&&dim===0&&view.bpp<=4){ctx.fillStyle='rgba(126,245,110,.42)';ctx.strokeStyle='rgba(40,110,40,.8)';ctx.lineWidth=1;const s=16/view.bpp;for(let i=0;i<slimes.length;i+=2){const px=(slimes[i]*16-x0)/view.bpp,pz=(slimes[i+1]*16-z0)/view.bpp;if(px>-s&&pz>-s&&px<size.w&&pz<size.h){ctx.fillRect(px,pz,s,s);if(s>6)ctx.strokeRect(px+.5,pz+.5,s-1,s-1)}}}
  if(grid&&view.bpp<=2){ctx.strokeStyle='rgba(8,16,12,.28)';ctx.lineWidth=1;ctx.beginPath();for(let bx=Math.ceil(x0/16)*16;bx<x1;bx+=16){const p=Math.round((bx-x0)/view.bpp)+.5;ctx.moveTo(p,0);ctx.lineTo(p,size.h)}for(let bz=Math.ceil(z0/16)*16;bz<z1;bz+=16){const p=Math.round((bz-z0)/view.bpp)+.5;ctx.moveTo(0,p);ctx.lineTo(size.w,p)}ctx.stroke()}
 },[view,size,tileKey,mode,tick,slime,slimes,grid,dim,rect]);

 /* ---- overlays (structures, strongholds, slime chunks) and the legend, after the view settles ---- */
 useEffect(()=>{if(!size.w)return;const t=setTimeout(()=>{
  const {x0,z0,x1,z1}=rect();const mx=(x1-x0)*.25,mz=(z1-z0)*.25;const id=++overlaySeq.current;
  const types=[...layers].filter(typeVisible);
  rpc<{structures:Poi[];strongholds:Poi[];slimes:number[]|null}>('overlay',{seed,version,dim,x0:Math.floor(x0-mx),z0:Math.floor(z0-mz),x1:Math.ceil(x1+mx),z1:Math.ceil(z1+mz),types,slime:slime&&dim===0&&view.bpp<=4}).then((r:{structures:Poi[];strongholds:Poi[];slimes:number[]|null})=>{if(id!==overlaySeq.current)return;setPois(r.structures);setStrongholds(r.strongholds);setSlimes(r.slimes)}).catch(()=>{});
  // biomes on screen, for the legend
  const e=engine.current;if(e){const counts=new Map<number,number>();const tx0=Math.floor(x0/TILE_BLOCKS),tx1=Math.floor(x1/TILE_BLOCKS),tz0=Math.floor(z0/TILE_BLOCKS),tz1=Math.floor(z1/TILE_BLOCKS);
   for(let tz=tz0;tz<=tz1;tz++)for(let tx=tx0;tx<=tx1;tx++){const r=e.getRaw(e.tileKey(tileKey,tx,tz));if(!r)continue;for(let j=0;j<TILE_CELLS;j+=4)for(let i=0;i<TILE_CELLS;i+=4){const bx=(tx*TILE_CELLS+i)*4,bz=(tz*TILE_CELLS+j)*4;if(bx<x0||bx>x1||bz<z0||bz>z1)continue;const b=r.ids[j*TILE_CELLS+i];counts.set(b,(counts.get(b)||0)+1)}}
   setLegend([...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(e=>e[0]))}
 },180);return()=>clearTimeout(t)},[view,size,dim,layers,slime,seed,version,tileKey,typeVisible,rect,busy]);

 /* ---- tell the page where we are (for shareable links) ---- */
 useEffect(()=>{if(!onViewChange)return;const t=setTimeout(()=>onViewChange({dim,x:Math.round(view.cx),z:Math.round(view.cz),bpp:view.bpp,y}),400);return()=>clearTimeout(t)},[view,dim,y,onViewChange]);

 /* ---- nearby structures, from spawn (or the origin outside the Overworld) ---- */
 const origin=useMemo(()=>dim===0&&summary?{x:summary.spawnX,z:summary.spawnZ}:{x:0,z:0},[dim,summary]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- clear the list while the new one loads
 useEffect(()=>{if(!summary)return;let live=true;setNearest([]);
  rpc<{results:Poi[]}>('nearest',{seed,version,dim,x:origin.x,z:origin.z,types:layerTypes.map(s=>s.id),radius:dim===1?8000:6000}).then(r=>{if(live)setNearest(r.results.sort((a,b)=>Math.hypot(a.x-origin.x,a.z-origin.z)-Math.hypot(b.x-origin.x,b.z-origin.z)))}).catch(()=>{});
  return()=>{live=false}},[seed,version,dim,summary,origin,layerTypes]);

 /* ---- selection details ---- */
 const selKey=selected?`${selected.type}|${selected.x}|${selected.z}`:'';
 useEffect(()=>{if(!selected||selected.info!==undefined)return;let live=true;
  rpc<{info:Info}>('detail',{seed,version,dim,type:selected.type,x:selected.x,z:selected.z}).then(r=>{if(live)setSelected(s=>s&&`${s.type}|${s.x}|${s.z}`===selKey?{...s,info:r.info}:s)}).catch(()=>{if(live)setSelected(s=>s?{...s,info:null}:s)});
  return()=>{live=false}
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[selKey,seed,version,dim]);

 /* ---- interaction ---- */
 const toBlock=(clientX:number,clientY:number)=>{const r=wrap.current!.getBoundingClientRect();return{x:Math.floor(view.cx+(clientX-r.left-size.w/2)*view.bpp),z:Math.floor(view.cz+(clientY-r.top-size.h/2)*view.bpp)}};
 const sample=(x:number,z:number)=>{const e=engine.current;if(!e)return null;const tx=Math.floor(x/TILE_BLOCKS),tz=Math.floor(z/TILE_BLOCKS);const r=e.getRaw(e.tileKey(tileKey,tx,tz));if(!r)return null;const i=Math.floor((x-tx*TILE_BLOCKS)/4),j=Math.floor((z-tz*TILE_BLOCKS)/4);return{biome:r.ids[j*TILE_CELLS+i],height:r.heights?r.heights[(j+1)*(TILE_CELLS+2)+i+1]:null}};
 useEffect(()=>{const el=wrap.current;if(!el)return;const wheel=(ev:WheelEvent)=>{ev.preventDefault();const r=el.getBoundingClientRect();const mx=ev.clientX-r.left-r.width/2,mz=ev.clientY-r.top-r.height/2;setView(v=>{const nb=clampBpp(v.bpp*(ev.deltaY>0?1.2:1/1.2));const bx=v.cx+mx*v.bpp,bz=v.cz+mz*v.bpp;return{bpp:nb,cx:bx-mx*nb,cz:bz-mz*nb}})};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel)},[]);
 const zoomBy=(f:number)=>setView(v=>({...v,bpp:clampBpp(v.bpp*f)}));
 const centre=(x:number,z:number)=>setView(v=>({...v,cx:x,cz:z}));
 const copyText=async(t:string,tag:string)=>{try{await navigator.clipboard.writeText(t);setCopied(tag);setTimeout(()=>setCopied(''),1800)}catch{setError('Copia non disponibile in questo browser.')}};

 const screen=(x:number,z:number)=>({left:(x-view.cx)/view.bpp+size.w/2,top:(z-view.cz)/view.bpp+size.h/2});
 const onScreen=(x:number,z:number,pad=30)=>{const p=screen(x,z);return p.left>-pad&&p.top>-pad&&p.left<size.w+pad&&p.top<size.h+pad};
 const compact=view.bpp>3;
 const markers=[...pois.filter(p=>layers.has(p.type)),...(layers.has(STRONGHOLD)?strongholds.map(s=>({type:STRONGHOLD,x:s.x,z:s.z})):[])].filter(p=>onScreen(p.x,p.z));
 const spawnHere=summary&&dim===0?{x:summary.spawnX,z:summary.spawnZ}:null;
 const selMeta=selected&&selected.type!=null?STRUCTURE_BY_ID.get(selected.type):null;
 const dist=(p:{x:number;z:number})=>Math.round(Math.hypot(p.x-origin.x,p.z-origin.z));
 const tp=(p:{x:number;z:number},yy?:number)=>`/tp @s ${p.x} ${yy??'~'} ${p.z}`;
 const toggleLayer=(id:number)=>setLayers(l=>{const n=new Set(l);if(n.has(id))n.delete(id);else n.add(id);return n});

 const popupPos=selected?screen(selected.x,selected.z):null;
 return <section className={'map-shell '+(expanded?'expanded':'')} aria-label="Mappa interattiva del seed">
 <div className="map-toolbar">
  <div className="dim-tabs" role="group" aria-label="Dimensione">{DIMENSIONS.map(d=><button key={d.id} className={'dim-'+d.id+(dim===d.id?' active':'')} aria-pressed={dim===d.id} onClick={()=>switchDim(d.id)}>{d.name}</button>)}</div>
  <div className="map-tabs" role="group" aria-label="Stile della mappa">{([['relief','Rilievo'],['biomes','Biomi']] as const).map(([id,label])=><button key={id} className={(dim===0?mode===id:id==='biomes')?'active':''} onClick={()=>setMode(id)} aria-pressed={mode===id} disabled={dim!==0}>{label}</button>)}</div>
  {dim===0&&<label className="height-select"><Mountain size={15}/><span className="sr-only">Quota</span><select value={y} onChange={e=>setY(Number(e.target.value))} aria-label="Quota dei biomi">{HEIGHTS.map(h=><option key={h.y} value={h.y}>{h.name}</option>)}</select></label>}
  <button className={'layers-button'+(layerPanel?' active':'')} onClick={()=>setLayerPanel(!layerPanel)} aria-expanded={layerPanel}><Layers size={16}/><span>Livelli</span></button>
  <button className="icon-button expand" aria-label={expanded?'Riduci mappa':'Espandi mappa'} onClick={()=>setExpanded(!expanded)}>{expanded?<Minimize size={17}/>:<Maximize size={17}/>}</button>
 </div>
 {layerPanel&&<div className="layer-panel">
  <div className="chip-row">{layerTypes.map(s=>{const Icon=s.icon;return <button key={s.id} className={'layer-chip'+(layers.has(s.id)?' on':'')} aria-pressed={layers.has(s.id)} onClick={()=>toggleLayer(s.id)}><i style={{background:s.color}}><Icon size={12}/></i>{s.short}</button>})}</div>
  <div className="chip-row secondary">
   <button className="text-button" onClick={()=>setLayers(new Set(layerTypes.map(s=>s.id)))}>Tutte</button><button className="text-button" onClick={()=>setLayers(new Set())}>Nessuna</button>
   {dim===0&&<button className={'layer-chip'+(slime?' on':'')} aria-pressed={slime} onClick={()=>setSlime(!slime)}><i style={{background:'#7ef56e'}}/>Chunk di slime</button>}
   <button className={'layer-chip'+(grid?' on':'')} aria-pressed={grid} onClick={()=>setGrid(!grid)}><i style={{background:'#445'}}/>Griglia dei chunk</button>
   {(slime||grid)&&view.bpp>(grid&&!slime?2:4)&&<small>Avvicinati per vederli</small>}
  </div>
 </div>}
 <div className={'map-canvas dim'+dim} ref={wrap} tabIndex={0} role="application" aria-label="Mappa: trascina per spostarti, rotella o pulsanti per lo zoom, frecce per muoverti."
  onKeyDown={e=>{const step=view.bpp*120;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();setView(v=>({...v,cx:v.cx+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),cz:v.cz+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0)}))}if(e.key==='+'||e.key==='=')zoomBy(1/1.5);if(e.key==='-')zoomBy(1.5);if(e.key==='Escape'){if(selected)setSelected(null);else setExpanded(false)}}}
  onPointerDown={e=>{if((e.target as HTMLElement).closest('button,.map-popup'))return;touches.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touches.current.size===2){const [a,b]=[...touches.current.values()];pinch.current={d:Math.hypot(a.x-b.x,a.y-b.y)||1,bpp:view.bpp};drag.current=null;return}e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,cx:view.cx,cz:view.cz,moved:false}}}
  onPointerMove={e=>{if(touches.current.has(e.pointerId))touches.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pinch.current&&touches.current.size===2){const [a,b]=[...touches.current.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);const nb=clampBpp(pinch.current.bpp*pinch.current.d/Math.max(1,d));setView(v=>({...v,bpp:nb}));return}const p=drag.current;if(p){const dx=e.clientX-p.x,dy=e.clientY-p.y;if(Math.abs(dx)+Math.abs(dy)>3)p.moved=true;if(p.moved)setView(v=>({...v,cx:p.cx-dx*v.bpp,cz:p.cz-dy*v.bpp}));return}
   if((e.target as HTMLElement).closest('.map-popup'))return;const b=toBlock(e.clientX,e.clientY),s=sample(b.x,b.z);setHover(`${s?biomeName(s.biome):'…'} · X ${fmt(b.x)} / Z ${fmt(b.z)}${s&&s.height!=null&&dim===0?` · Y ≈ ${s.height}`:''}`)}}
  onPointerUp={e=>{touches.current.delete(e.pointerId);if(pinch.current){if(touches.current.size<2)pinch.current=null;drag.current=null;return}const p=drag.current;drag.current=null;if(p&&!p.moved&&!(e.target as HTMLElement).closest('button,.map-popup')){const b=toBlock(e.clientX,e.clientY);setSelected({type:null,x:b.x,z:b.z})}}} onPointerCancel={e=>{touches.current.delete(e.pointerId);pinch.current=null;drag.current=null}}>
  <canvas ref={canvas} aria-hidden="true"/>
  {spawnHere&&onScreen(spawnHere.x,spawnHere.z)&&<button className="map-marker spawn" style={screen(spawnHere.x,spawnHere.z)} onClick={()=>setSelected({type:-1,x:spawnHere.x,z:spawnHere.z})}><MapPin size={30}/><span>Spawn</span></button>}
  {markers.map(p=>{const m=STRUCTURE_BY_ID.get(p.type);if(!m)return null;const Icon=m.icon;const isSel=selected&&selected.type===p.type&&selected.x===p.x&&selected.z===p.z;
   return <button key={p.type+'|'+p.x+'|'+p.z} className={'pin'+(compact?' compact':'')+(isSel?' selected':'')} style={{...screen(p.x,p.z),['--pin' as string]:m.color}} onClick={()=>setSelected({type:p.type,x:p.x,z:p.z})} aria-label={`${m.name}, X ${p.x} Z ${p.z}`}>{!compact&&<Icon size={15} strokeWidth={2.2}/>}<span className="pin-label">{m.name}</span></button>})}
  {selected&&popupPos&&<div className="map-popup" style={{left:Math.max(150,Math.min(size.w-150,popupPos.left)),top:popupPos.top} } data-below={popupPos.top<size.h*.55?'1':undefined} role="dialog" aria-label="Dettagli del punto">
   <button className="popup-close" aria-label="Chiudi" onClick={()=>setSelected(null)}><X size={15}/></button>
   {(()=>{const info=selected.info;const title=selected.type===-1?'Spawn del mondo':selMeta?selMeta.name:'Punto sulla mappa';const color=selMeta?.color||(selected.type===-1?'#cefd82':'#9fb3a5');const Icon=selMeta?.icon||(selected.type===-1?MapPin:Crosshair);
    return <><div className="popup-title"><i style={{background:color}}><Icon size={14}/></i><strong>{title}</strong></div>
    <dl><div><dt>Coordinate</dt><dd>X {fmt(selected.x)} · Z {fmt(selected.z)}</dd></div>
    {info===undefined?<div><dt>Dettagli</dt><dd><LoaderCircle size={13} className="spin"/></dd></div>:info&&<>
     {info.biome!=null&&info.biome>=0&&<div><dt>Bioma</dt><dd>{biomeName(info.biome)}</dd></div>}
     {info.height!=null&&dim===0&&<div><dt>Quota superficie</dt><dd>≈ Y {info.height}</dd></div>}
     {info.eyes!=null&&info.eyes>=0&&<div><dt>Occhi già nel portale</dt><dd>{info.eyes} / 12{info.eyes===12?' · portale già attivo!':''}</dd></div>}
     {info.libraries!=null&&info.libraries>=0&&selected.type===STRONGHOLD&&<div><dt>Biblioteche</dt><dd>{info.libraries}</dd></div>}
    </>}
    {selected.type!==-1&&<div><dt>Distanza da {dim===0?'spawn':'0, 0'}</dt><dd>{fmt(dist(selected))} blocchi</dd></div>}
    </dl>
    {info?.tags&&info.tags.length>0&&<div className="popup-tags">{info.tags.map(t=><span key={t}>{t}</span>)}</div>}
    {selMeta&&<p className="popup-note">{selMeta.note}</p>}
    {selMeta&&LOCATE_ID[selMeta.id]&&<p className="popup-note locate">Per verificarla nel gioco: fai <code>/tp</code> qui vicino, poi <code>{(dim===-1?'/execute in the_nether run locate structure ':dim===1?'/execute in the_end run locate structure ':'/locate structure ')+LOCATE_ID[selMeta.id]}</code>. Da lontano <code>/locate</code> può indicarne un’altra: si ferma alla prima che trova, non alla più vicina.</p>}
    {info?.portal&&<p className="popup-note">Stanza del portale: X {fmt(info.portal.x)} · Z {fmt(info.portal.z)}</p>}
    <div className="popup-actions"><button onClick={()=>copyText(tp(info?.portal||selected,selected.type===STRONGHOLD?undefined:info?.height!=null&&dim===0?info.height+1:undefined),'tp')}>{copied==='tp'?<Check size={14}/>:<Copy size={14}/>}{copied==='tp'?'Copiato':'Copia /tp'}</button>{linkTo?<button onClick={()=>copyText(linkTo({x:selected.x,z:selected.z,type:selected.type,dim}),'link')}>{copied==='link'?<Check size={14}/>:<Link2 size={14}/>}Link</button>:<button onClick={()=>copyText(`${selected.x} ${selected.z}`,'xz')}>{copied==='xz'?<Check size={14}/>:<Copy size={14}/>}X Z</button>}<button onClick={()=>centre(selected.x,selected.z)}><Crosshair size={14}/>Centra</button></div></>})()}
  </div>}
  <div className="map-controls"><button aria-label="Aumenta zoom" onClick={()=>zoomBy(1/1.5)} disabled={view.bpp<=MIN_BPP}><Plus/></button><button aria-label="Riduci zoom" onClick={()=>zoomBy(1.5)} disabled={view.bpp>=MAX_BPP}><Minus/></button><button aria-label={dim===0?'Vai allo spawn':'Vai a 0, 0'} onClick={()=>centre(origin.x,origin.z)}><LocateFixed size={20}/></button><div className="north"><span>N</span><Compass size={22}/></div></div>
  {legend.length>0&&<div className="map-legend" aria-label="Biomi in vista">{legend.map(b=><span key={b}><i style={{background:hex(COLORS[b]||[128,128,128])}}/>{biomeName(b)}</span>)}</div>}
  <div className="scale-bar"><i style={{width:Math.round((view.bpp<=.5?16:view.bpp<=1.5?64:view.bpp<=3?128:view.bpp<=6?512:1000)/view.bpp)}}/><span>{fmt(view.bpp<=.5?16:view.bpp<=1.5?64:view.bpp<=3?128:view.bpp<=6?512:1000)} blocchi</span></div>
  {busy&&<div className="map-loading" role="status"><LoaderCircle className="spin" size={16}/>Genero il terreno…</div>}
  {error&&<div className="map-error" role="alert">{error}</div>}
 </div>
 <div className="map-status"><span>{hover}</span>
  <form className="goto" onSubmit={e=>{e.preventDefault();const x=parseInt(goto.x),z=parseInt(goto.z);if(Number.isFinite(x)&&Number.isFinite(z)){centre(x,z);setSelected({type:null,x,z})}}}><Navigation size={13}/><input aria-label="Coordinata X" placeholder="X" inputMode="numeric" value={goto.x} onChange={e=>setGoto({...goto,x:e.target.value})}/><input aria-label="Coordinata Z" placeholder="Z" inputMode="numeric" value={goto.z} onChange={e=>setGoto({...goto,z:e.target.value})}/><button type="submit">Vai</button></form>
 </div>
 <div className="nearby">
  <div className="nearby-head"><strong>Strutture più vicine {dim===0?'allo spawn':'a 0, 0'}</strong><span>{dim===0&&summary?`Spawn X ${fmt(summary.spawnX)} · Z ${fmt(summary.spawnZ)} · ${biomeName(summary.spawnBiome)}`:dim===-1?'Coordinate del Nether (÷ 8)':'Le città dell’End sono oltre i 1.000 blocchi'}</span></div>
  <div className="nearby-grid">{nearest.length===0?<span className="nearby-empty"><LoaderCircle size={13} className="spin"/>Cerco le strutture…</span>:nearest.map(p=>{const m=STRUCTURE_BY_ID.get(p.type);if(!m)return null;const Icon=m.icon;return <button key={p.type} className="nearby-item" onClick={()=>{if(!layers.has(p.type))toggleLayer(p.type);setView(v=>({...v,cx:p.x,cz:p.z,bpp:Math.min(v.bpp,2)}));setSelected({type:p.type,x:p.x,z:p.z})}}><i style={{background:m.color}}><Icon size={13}/></i><span><b>{m.name}</b><small>{fmt(dist(p))} blocchi · {fmt(p.x)}, {fmt(p.z)}</small></span></button>})}</div>
 </div>
 </section>
}
