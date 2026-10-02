'use client';
/* Tile engine for the world map.
 *
 * The world is cut into 512×512-block tiles (128×128 cells at the engine's 1:4 biome
 * resolution). A small pool of WebAssembly workers renders missing tiles, nearest to the
 * centre of the view first, and finished tiles stay cached, so panning back and forth is
 * instant and zooming never recomputes what is already known. */
import {COLORS,OCEANS} from './data';

export const TILE_CELLS=128;
export const TILE_BLOCKS=TILE_CELLS*4;
const MAX_TILES=320;

export type TileKey={seed:string;version:number;dim:number;y:number};
export type Raw={ids:Int32Array;heights:Int16Array|null;fallback:Uint8ClampedArray};
type Job={key:string;tx:number;tz:number;k:TileKey;prio:number};

const RIVERS=new Set([7,11]);
const END_ISLAND=[214,212,156],END_VOID=[18,16,28],END_SMALL=[40,36,60];
const keyStr=(k:TileKey)=>`${k.seed}|${k.version}|${k.dim}|${k.y}`;

export class TileEngine{
 private workers:{w:Worker;busy:Job|null;ready:boolean}[]=[];
 private raw=new Map<string,Raw>();
 private painted=new Map<string,HTMLCanvasElement>();
 private pending=new Map<string,Job>();
 private inflight=new Set<string>();
 private failed=new Set<string>();
 onTile:()=>void=()=>{};
 onError:(m:string)=>void=()=>{};
 constructor(n:number){
  for(let i=0;i<n;i++){
   const w=new Worker('/engine/studio-worker.js');const slot={w,busy:null as Job|null,ready:false};
   w.onmessage=({data:m})=>{
    if(m.kind==='ready'){slot.ready=true;this.pump();return}
    if(m.kind==='map'&&slot.busy){const j=slot.busy;slot.busy=null;this.inflight.delete(j.key);this.store(j.key,{ids:m.ids,heights:m.heights,fallback:m.rgba});this.onTile();this.pump();return}
    if(m.kind==='error'){const j=slot.busy;slot.busy=null;if(j){this.inflight.delete(j.key);this.failed.add(j.key)}this.onError(m.message);this.pump()}
   };
   w.onerror=()=>{slot.busy=null;this.onError('Impossibile caricare il motore. Ricarica la pagina.')};
   this.workers.push(slot);
  }
 }
 dispose(){this.workers.forEach(s=>s.w.terminate());this.workers=[]}
 get ready(){return this.workers.some(s=>s.ready)}
 get busy(){return this.pending.size+this.inflight.size>0}
 private store(key:string,r:Raw){this.raw.set(key,r);if(this.raw.size>MAX_TILES){const first=this.raw.keys().next().value as string;this.raw.delete(first);for(const m of ['relief','biomes'])this.painted.delete(m+'|'+first)}}
 tileKey(k:TileKey,tx:number,tz:number){return keyStr(k)+'|'+tx+'|'+tz}
 /* Replace the wish list: exactly these tiles, closest first. */
 want(k:TileKey,tiles:{tx:number;tz:number;prio:number}[]){
  this.pending.clear();
  for(const t of tiles){const key=this.tileKey(k,t.tx,t.tz);if(this.raw.has(key)||this.inflight.has(key)||this.failed.has(key))continue;this.pending.set(key,{key,tx:t.tx,tz:t.tz,k,prio:t.prio})}
  this.pump();
 }
 private pump(){
  for(const s of this.workers){
   if(!s.ready||s.busy||!this.pending.size)continue;
   let best:Job|null=null;for(const j of this.pending.values())if(!best||j.prio<best.prio)best=j;
   if(!best)return;this.pending.delete(best.key);this.inflight.add(best.key);s.busy=best;
   s.w.postMessage({kind:'map',id:best.key,seed:best.k.seed,version:best.k.version,dim:best.k.dim,y:best.k.y,x:best.tx*TILE_CELLS,z:best.tz*TILE_CELLS,w:TILE_CELLS,h:TILE_CELLS});
  }
 }
 getRaw(key:string){const r=this.raw.get(key);if(r){this.raw.delete(key);this.raw.set(key,r)}return r}
 /* The painted tile for a shading mode, built once from the raw ids and heights. */
 canvas(key:string,mode:string){
  const pk=mode+'|'+key;const hit=this.painted.get(pk);if(hit)return hit;
  const r=this.raw.get(key);if(!r)return null;
  const c=document.createElement('canvas');c.width=c.height=TILE_CELLS;const ctx=c.getContext('2d');if(!ctx)return null;
  const parts=key.split('|'),dim=Number(parts[2]),tx=Number(parts[4]),tz=Number(parts[5]);
  const img=ctx.createImageData(TILE_CELLS,TILE_CELLS);paint(img.data,r,mode==='relief',TILE_CELLS,TILE_CELLS,dim===1?{x0:tx*TILE_CELLS,z0:tz*TILE_CELLS}:null);ctx.putImageData(img,0,0);
  this.painted.set(pk,c);if(this.painted.size>MAX_TILES*2){const first=this.painted.keys().next().value as string;this.painted.delete(first)}
  return c;
 }
}

/* Biome colours, shaded from the engine's surface heights: slopes catch the light from
 * the north-west, higher ground is a touch brighter, and the sea gets darker with depth. */
export function paint(px:Uint8ClampedArray,r:Raw,relief:boolean,W:number,H:number,end:{x0:number;z0:number}|null){
 const hs=r.heights,bw=W+2;
 for(let j=0;j<H;j++)for(let i=0;i<W;i++){
  const n=j*W+i,id=r.ids[n];let c=COLORS[id];
  if(end){ // The End: the central biome is mostly void around a ~150-block main island
   if(id===9){const bx=(end.x0+i)*4+2,bz=(end.z0+j)*4+2;c=bx*bx+bz*bz<150*150?END_ISLAND:END_VOID}
   else if(id===40)c=END_SMALL;
  }
  let R=c?c[0]:r.fallback[n*4],G=c?c[1]:r.fallback[n*4+1],B=c?c[2]:r.fallback[n*4+2];
  if(relief&&hs){
   const k=(j+1)*bw+i+1,h=hs[k];
   const dx=hs[k+1]-hs[k-1],dz=hs[k+bw]-hs[k-bw];
   const water=OCEANS.has(id)||RIVERS.has(id);
   let light;
   if(water){const depth=Math.max(0,63-h);light=Math.max(.55,1.08-depth*.012)+(dx+dz)*.006}
   else{light=1+(dx+dz)*.03+Math.max(-.08,Math.min(.16,(h-70)/900))}
   light=Math.max(.5,Math.min(1.32,light));R*=light;G*=light;B*=light;
  }
  const o=n*4;px[o]=R;px[o+1]=G;px[o+2]=B;px[o+3]=255;
 }
}
