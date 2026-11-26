import {useEffect,useRef,useState} from 'react';
import {Eye,Play,LoaderCircle,X,ExternalLink,Blocks} from 'lucide-react';
import {tr} from './i18n';

const SERVICE='http://127.0.0.1:4318';
const SUPPORTED=new Set(['1.21.1','1.21.4']);
type Session={id:string;seed:string;version:string;large:boolean;phase:string;error:string|null;viewerPath:string|null};
const PHASES:Record<string,string>={starting:tr('Preparazione del mondo…','Preparing the world…'),download:tr('Download del server ufficiale Minecraft…','Downloading the official Minecraft server…'),generating:tr('Minecraft sta generando il mondo…','Minecraft is generating the world…'),connecting:tr('Caricamento dei blocchi attorno allo spawn…','Loading blocks around spawn…'),ready:tr('Il tuo primo sguardo al mondo','Your first look at the world')};
/** The preview talks to a service on the visitor's own computer: only offer it when the site
 * itself runs locally (npm run dev / preview). */
export const PREVIEW_AVAILABLE=typeof location!=='undefined'&&['localhost','127.0.0.1'].includes(location.hostname);
async function request<T>(path:string,options?:RequestInit):Promise<T>{
 const response=await fetch(SERVICE+path,{...options,signal:AbortSignal.timeout(15000)});
 if(response.status===204)return undefined as T;
 const body=await response.json() as T&{error?:string};if(!response.ok)throw new Error(body.error||tr('Il servizio non risponde.','The service is not responding.'));return body;
}
function explain(e:unknown){return e instanceof TypeError||e instanceof DOMException?tr('Servizio locale non raggiungibile. Avvia preview-service sul computer e usa il sito su localhost:5173.','Local service not reachable. Start preview-service on your computer and open the site on localhost:5173.'):e instanceof Error?e.message:tr('Impossibile aprire la preview.','Could not open the preview.')}

/** The parent keys this component by seed/version/world type, invalidating old worlds. */
export default function MinecraftPreview({seed,version,large,onSupportedVersion}:{seed:string;version:string;large:boolean;onSupportedVersion:()=>void}){
 const [session,setSession]=useState<Session|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[help,setHelp]=useState(false);
 const alive=useRef(true),sessionId=useRef<string|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const supported=SUPPORTED.has(version);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;if(timer.current)clearTimeout(timer.current);const id=sessionId.current;if(id)void fetch(`${SERVICE}/api/previews/${id}`,{method:'DELETE',keepalive:true}).catch(()=>{})}},[]);
 const poll=async(id:string)=>{
  try{const value=await request<Session>(`/api/previews/${id}`);if(!alive.current||sessionId.current!==id)return;setSession(value);
   if(value.phase==='error'){setError(value.error||tr('Generazione non riuscita.','Generation failed.'));setBusy(false);return}
   if(value.phase==='ready')setBusy(false);
   timer.current=setTimeout(()=>void poll(id),value.phase==='ready'?10000:1000);
  }catch(e){if(alive.current&&sessionId.current===id){setError(explain(e));setBusy(false)}}
 };
 const start=async()=>{
  if(busy||sessionId.current)return;
  setBusy(true);setError('');
  try{
   const value=await request<Session>('/api/previews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seed,version,large})});
   if(!alive.current){void request(`/api/previews/${value.id}`,{method:'DELETE'}).catch(()=>{});return}
   sessionId.current=value.id;setSession(value);void poll(value.id);
  }catch(e){if(alive.current){setError(explain(e));setBusy(false);setHelp(true)}}
 };
 const close=async()=>{
  const id=sessionId.current;if(!id)return;if(timer.current)clearTimeout(timer.current);
  sessionId.current=null;setSession(null);setBusy(true);setError('');
  try{await request(`/api/previews/${id}`,{method:'DELETE'})}catch(e){if(alive.current)setError(explain(e))}finally{if(alive.current)setBusy(false)}
 };
 const ready=session?.phase==='ready'&&!error;
 return <section className="minecraft-preview" aria-label={tr('Anteprima Minecraft in prima persona','First-person Minecraft preview')}>
  <div className="mc-preview-heading"><div><span className="mc-eyebrow">{tr('DALLA MAPPA AL MONDO','FROM MAP TO WORLD')}</span><h2><Eye size={20}/>{tr('Il primo sguardo','First look')}</h2></div><span className="mc-tag">Minecraft Java · {version}</span></div>
  {ready&&session.viewerPath?<div className="mc-viewport"><iframe key={session.id} title={`Minecraft ${version}, seed ${seed}: ${tr('vista dallo spawn','view from spawn')}`} src={SERVICE+session.viewerPath} allow="fullscreen" allowFullScreen/><div className="mc-world-caption"><span>Overworld · spawn · {large?tr('biomi grandi','large biomes'):tr('mondo predefinito','default world')}</span><a href={SERVICE+session.viewerPath} target="_blank" rel="noreferrer">{tr('Apri in una scheda','Open in a tab')} <ExternalLink size={13}/></a></div></div>:<div className="mc-preview-empty">
   <div className="mc-preview-symbol">{busy?<LoaderCircle className="mc-spin" size={36}/>:<Blocks size={36} strokeWidth={1.3}/>}</div>
   <h3>{busy?(PHASES[session?.phase||'starting']||tr('Preparazione…','Preparing…')):tr('Come arrivare qui per la prima volta.','Arrive here for the first time.')}</h3>
   <p>{busy?tr('La prima generazione può richiedere qualche minuto. Il paesaggio viene generato da Minecraft con questo seed.','The first generation can take a few minutes. Minecraft itself generates the landscape with this seed.'):tr('Apri una finestra sullo spawn: blocchi, alberi, acqua e strutture del mondo generato, da osservare in prima persona.','Open a window on spawn: blocks, trees, water and structures of the generated world, in first person.')}</p>
   {!supported?<div className="mc-unsupported">{tr('Preview disponibile per Java 1.21.1 e 1.21.4.','Preview available for Java 1.21.1 and 1.21.4.')}<button onClick={onSupportedVersion}>{tr('Seleziona Java 1.21.1','Select Java 1.21.1')}</button></div>:!session&&!busy?<button className="mc-enter" onClick={()=>void start()}><Play size={16} fill="currentColor"/>{tr('Anteprima nel mondo','Preview the world')}</button>:null}
  </div>}
  {error&&<p className="mc-preview-error" role="alert">{error}</p>}
  <div className="mc-preview-footer"><span>{ready?tr('Trascina nella scena per guardarti intorno.','Drag in the scene to look around.'):tr('Preview locale · area iniziale dell’Overworld','Local preview · Overworld starting area')}</span>{session?<button onClick={()=>void close()}><X size={14}/>{busy?tr('Annulla','Cancel'):tr('Chiudi mondo','Close world')}</button>:<button onClick={()=>setHelp(v=>!v)} aria-expanded={help}>{tr('Come si avvia?','How to start it?')}</button>}</div>
  {help&&<div className="mc-preview-help"><strong>{tr('Prima configurazione sul computer','First-time setup on your computer')}</strong><ol><li>{tr('Installa Node.js 22 o successivo e Java 21.','Install Node.js 22 or later and Java 21.')}</li><li>{tr('Apri il terminale nella cartella','Open a terminal in the')} <code>preview-service</code> {tr('del progetto ed esegui','folder of the project and run')} <code>npm install</code>.</li><li>{tr('Leggi e accetta la licenza con','Read and accept the licence with')} <code>npm run accept-eula</code>{tr(', poi esegui',', then run')} <code>npm start</code>.</li><li>{tr('Lascia quel terminale aperto. In un altro terminale avvia il sito con','Leave that terminal open. In another terminal start the site with')} <code>npm run dev</code> {tr('dalla cartella principale.','from the main folder.')}</li></ol><p>{tr('Apri il sito su','Open the site on')} <code>http://localhost:5173</code>. {tr('Una preview alla volta; «Chiudi mondo» arresta il server e rimuove il mondo temporaneo. Il servizio si ferma anche dopo 20 minuti.','One preview at a time; “Close world” stops the server and deletes the temporary world. The service also stops after 20 minutes.')}</p></div>}
  <p className="mc-preview-note">{tr('Chunk generati dal server ufficiale, visualizzati con Prismarine Viewer. Illuminazione e alcuni effetti grafici differiscono dal gioco; shader, mod e datapack non sono inclusi. La posizione iniziale può variare di qualche blocco per la dispersione dello spawn.','Chunks generated by the official server, shown with Prismarine Viewer. Lighting and some effects differ from the game; shaders, mods and datapacks are not included. The starting position can vary by a few blocks because of spawn spread.')}</p>
 </section>
}
