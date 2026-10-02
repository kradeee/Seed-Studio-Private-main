'use client';
import {useEffect,useRef,useState} from 'react';
import {Eye,Play,LoaderCircle,X,ExternalLink,Blocks} from 'lucide-react';

const SERVICE='http://127.0.0.1:4318';
const SUPPORTED=new Set(['1.21.1','1.21.4']);
type Session={id:string;seed:string;version:string;large:boolean;phase:string;error:string|null;viewerPath:string|null};
const PHASES:Record<string,string>={starting:'Preparazione del mondo…',download:'Download del server ufficiale Minecraft…',generating:'Minecraft sta generando il mondo…',connecting:'Caricamento dei blocchi attorno allo spawn…',ready:'Il tuo primo sguardo al mondo'};
async function request<T>(path:string,options?:RequestInit):Promise<T>{
 const response=await fetch(SERVICE+path,{...options,signal:AbortSignal.timeout(15000)});
 if(response.status===204)return undefined as T;
 const body=await response.json() as T&{error?:string};if(!response.ok)throw new Error(body.error||'Il servizio non risponde.');return body;
}
function explain(e:unknown){return e instanceof TypeError||e instanceof DOMException?'Servizio locale non raggiungibile. Avvia preview-service sul computer e usa il sito su localhost:5173.':e instanceof Error?e.message:'Impossibile aprire la preview.'}

/** The parent keys this component by seed/version/world type, invalidating old worlds. */
export default function MinecraftPreview({seed,version,large,onSupportedVersion}:{seed:string;version:string;large:boolean;onSupportedVersion:()=>void}){
 const [session,setSession]=useState<Session|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[help,setHelp]=useState(false);
 const alive=useRef(true),sessionId=useRef<string|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const supported=SUPPORTED.has(version);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;if(timer.current)clearTimeout(timer.current);const id=sessionId.current;if(id)void fetch(`${SERVICE}/api/previews/${id}`,{method:'DELETE',keepalive:true}).catch(()=>{})}},[]);
 const poll=async(id:string)=>{
  try{const value=await request<Session>(`/api/previews/${id}`);if(!alive.current||sessionId.current!==id)return;setSession(value);
   if(value.phase==='error'){setError(value.error||'Generazione non riuscita.');setBusy(false);return}
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
 return <section className="minecraft-preview" aria-label="Anteprima Minecraft in prima persona">
  <div className="mc-preview-heading"><div><span className="mc-eyebrow">DALLA MAPPA AL MONDO</span><h2><Eye size={20}/>Il primo sguardo</h2></div><span className="mc-tag">Minecraft Java · {version}</span></div>
  {ready&&session.viewerPath?<div className="mc-viewport"><iframe key={session.id} title={`Minecraft ${version}, seed ${seed}: vista dallo spawn`} src={SERVICE+session.viewerPath} allow="fullscreen" allowFullScreen/><div className="mc-world-caption"><span>Overworld · spawn · {large?'biomi grandi':'mondo predefinito'}</span><a href={SERVICE+session.viewerPath} target="_blank" rel="noreferrer">Apri in una scheda <ExternalLink size={13}/></a></div></div>:<div className="mc-preview-empty">
   <div className="mc-preview-symbol">{busy?<LoaderCircle className="mc-spin" size={36}/>:<Blocks size={36} strokeWidth={1.3}/>}</div>
   <h3>{busy?(PHASES[session?.phase||'starting']||'Preparazione…'):'Come arrivare qui per la prima volta.'}</h3>
   <p>{busy?'La prima generazione può richiedere qualche minuto. Il paesaggio viene generato da Minecraft con questo seed.':'Apri una finestra sullo spawn: blocchi, alberi, acqua e strutture del mondo generato, da osservare in prima persona.'}</p>
   {!supported?<div className="mc-unsupported">Preview disponibile per Java 1.21.1 e 1.21.4.<button onClick={onSupportedVersion}>Seleziona Java 1.21.1</button></div>:!session&&!busy?<button className="mc-enter" onClick={()=>void start()}><Play size={16} fill="currentColor"/>Anteprima nel mondo</button>:null}
  </div>}
  {error&&<p className="mc-preview-error" role="alert">{error}</p>}
  <div className="mc-preview-footer"><span>{ready?'Trascina nella scena per guardarti intorno.':'Preview locale · area iniziale dell’Overworld'}</span>{session?<button onClick={()=>void close()}><X size={14}/>{busy?'Annulla':'Chiudi mondo'}</button>:<button onClick={()=>setHelp(v=>!v)} aria-expanded={help}>Come si avvia?</button>}</div>
  {help&&<div className="mc-preview-help"><strong>Prima configurazione sul computer</strong><ol><li>Installa Node.js 22 o successivo e Java 21.</li><li>Apri il terminale nella cartella <code>preview-service</code> del progetto ed esegui <code>npm install</code>.</li><li>Leggi e accetta la licenza con <code>npm run accept-eula</code>, poi esegui <code>npm start</code>.</li><li>Lascia quel terminale aperto. In un altro terminale avvia il sito con <code>npm run dev</code> dalla cartella principale.</li></ol><p>Apri il sito su <code>http://localhost:5173</code>. Una preview alla volta; «Chiudi mondo» arresta il server e rimuove il mondo temporaneo. Il servizio si ferma anche dopo 20 minuti.</p></div>}
  <p className="mc-preview-note">Chunk generati dal server ufficiale, visualizzati con Prismarine Viewer. Illuminazione e alcuni effetti grafici differiscono dal gioco; shader, mod e datapack non sono inclusi. La posizione iniziale può variare di qualche blocco per la dispersione dello spawn.</p>
 </section>
}
