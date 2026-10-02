import {randomBytes} from 'node:crypto';
import {validateRequest} from './config.mjs';
import {acceptedEula,startMinecraft,disposeWorld} from './minecraft.mjs';
export class PreviewManager{
 constructor({launch=startMinecraft,dispose=disposeWorld,eula=acceptedEula,onReady=()=>{},now=Date.now}={}){Object.assign(this,{launch,dispose,eula,onReady,now});this.current=null;this.busy=false}
 async start(body){
  const input=validateRequest(body);
  if(this.busy)throw Object.assign(new Error('È già aperta una preview. Chiudila prima di avviarne un’altra.'),{status:409});
  this.busy=true;
  try{
   if(!await this.eula())throw Object.assign(new Error('Prima leggi e accetta la EULA: nella cartella preview-service esegui npm run accept-eula.'),{status:412});
   const job={...input,id:randomBytes(24).toString('hex'),phase:'starting',created:this.now(),touched:this.now(),abort:new AbortController(),error:null};
   this.current=job;
   job.task=(async()=>{try{const bot=await this.launch(job);job.abort.signal.throwIfAborted();job.closeViewer=this.onReady(job,bot);job.phase='ready'}catch(e){if(!job.abort.signal.aborted){job.phase='error';job.error=e.message}await this.disposeOnce(job)}})();
   return this.public(job);
  }catch(e){this.busy=false;throw e}
 }
 public(job=this.current){return job?{id:job.id,seed:job.seed,version:job.version,large:job.large,phase:job.phase,error:job.error,viewerPath:job.phase==='ready'?`/view/${job.id}/`:null}:null}
 get(id){if(!this.current||this.current.id!==id)throw Object.assign(new Error('La preview è scaduta o è stata chiusa.'),{status:404});this.current.touched=this.now();return this.public()}
 async disposeOnce(job){if(!job.disposal)job.disposal=this.dispose(job);return job.disposal}
 async stop(id){const job=this.current;if(!job||job.id!==id)return;job.abort.abort();await job.task;await this.disposeOnce(job);if(this.current===job){this.current=null;this.busy=false}}
 async expire(){const job=this.current;if(job&&(this.now()-job.touched>120000||this.now()-job.created>20*60000))await this.stop(job.id)}
}
