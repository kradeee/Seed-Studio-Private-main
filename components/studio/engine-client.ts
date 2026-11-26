/* Shared workers for small requests, one per channel so they never queue behind each
 * other: 'info' serves the map (overlays, details, nearest structures, version support),
 * 'preview' draws the little maps of search results. Tiles and searches have their own. */
import {asset,tr} from './i18n';

export const WORKER_URL=asset('engine/studio-worker.js');
/** Worker messages are codes or engine text: turn them into a sentence for the page. */
export function engineMessage(m:string){
 if(m==='engine-unavailable'||m==='load')return tr('Impossibile caricare il motore. Ricarica la pagina.','The engine could not be loaded. Reload the page.');
 if(m==='engine-error'||!m)return tr('Errore del motore.','Engine error.');
 return m;
}
type Pending={resolve:(v:unknown)=>void;reject:(e:Error)=>void};
type Channel={worker:Worker;ready:Promise<void>;pending:Map<number,Pending>};
const channels=new Map<string,Channel>();
let seq=0;

function get(name:string){
 const have=channels.get(name);if(have)return have;
 const worker=new Worker(WORKER_URL);const pending=new Map<number,Pending>();
 const ready=new Promise<void>((res,rej)=>{
  worker.onmessage=({data:m})=>{
   if(m.kind==='ready'){res();return}
   const p=pending.get(m.id);if(!p)return;pending.delete(m.id);
   if(m.kind==='error')p.reject(new Error(engineMessage(m.message)));else p.resolve(m);
  };
  worker.onerror=()=>{const e=new Error(engineMessage('load'));rej(e);pending.forEach(p=>p.reject(e));pending.clear()};
 });
 const c={worker,ready,pending};channels.set(name,c);return c;
}

export async function rpc<T=unknown>(kind:string,payload:Record<string,unknown>,channel='info'):Promise<T>{
 const c=get(channel);await c.ready;const id=++seq;
 return new Promise<T>((resolve,reject)=>{c.pending.set(id,{resolve:v=>resolve(v as T),reject});c.worker.postMessage({kind,id,...payload})});
}
