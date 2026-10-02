import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import net from 'node:net';
import path from 'node:path';
import {createRequire} from 'node:module';
import {DATA,PROFILES,properties} from './config.mjs';
const require=createRequire(import.meta.url);
const mineflayer=require('mineflayer');
const exec=promisify(execFile);
export async function acceptedEula(){try{return JSON.parse(await readFile(path.join(DATA,'eula-acceptance.json'),'utf8')).accepted===true}catch{return false}}
export async function checkJava(version){
 let stderr,stdout;
 try{({stderr,stdout}=await exec(process.env.JAVA_BIN||'java',['-version'],{timeout:10000}))}
 catch{throw new Error('Java non disponibile. Installa Java 21 e verifica java -version. Puoi impostare JAVA_BIN al percorso di java.')}
 const match=(stderr+stdout).match(/version\s+"(\d+)/);
 if(!match||Number(match[1])<PROFILES[version].java)throw new Error(`Minecraft ${version} richiede Java ${PROFILES[version].java} o successivo. Java rilevato: ${match?.[1]||'sconosciuto'}.`);
}
async function json(url,signal){const r=await fetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(45000)])});if(!r.ok)throw new Error(`Download metadati Minecraft fallito (${r.status}).`);return r.json()}
export async function ensureJar(version,signal){
 const dir=path.join(DATA,'jars');await mkdir(dir,{recursive:true});
 const target=path.join(dir,`${version}.jar`),manifestFile=path.join(dir,`${version}.json`);
 // A cached jar is used offline only after its saved official digest is rechecked.
 try{const meta=JSON.parse(await readFile(manifestFile,'utf8'));const bytes=await readFile(target);if(meta.version===version&&bytes.length===meta.size&&createHash('sha1').update(bytes).digest('hex')===meta.sha1)return target}catch{}
 const manifest=await json('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json',signal);
 const entry=manifest.versions.find(v=>v.id===version);if(!entry)throw new Error('Versione assente dal catalogo ufficiale Minecraft.');
 const metadata=await json(entry.url,signal),download=metadata.downloads?.server;
 if(!download?.url||!download.sha1)throw new Error('Download del server non disponibile.');
 const r=await fetch(download.url,{signal:AbortSignal.any([signal,AbortSignal.timeout(180000)])});if(!r.ok)throw new Error(`Download server fallito (${r.status}).`);
 const bytes=Buffer.from(await r.arrayBuffer());signal.throwIfAborted();
 if(bytes.length!==download.size||createHash('sha1').update(bytes).digest('hex')!==download.sha1)throw new Error('Il download Minecraft non supera la verifica di integrità. Riprova.');
 await writeFile(target+'.tmp',bytes);await rename(target+'.tmp',target);
 await writeFile(manifestFile,JSON.stringify({version,sha1:download.sha1,size:download.size}));return target;
}
async function freePort(){const s=net.createServer();await new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,'127.0.0.1',resolve)});const port=s.address().port;await new Promise(resolve=>s.close(resolve));return port}
export async function terminate(child){
 if(!child||!child.pid||child.exitCode!==null)return;
 await new Promise(resolve=>{const timer=setTimeout(()=>child.kill('SIGKILL'),10000);child.once('exit',()=>{clearTimeout(timer);resolve()});if(child.stdin.writable)child.stdin.write('stop\n');else child.kill('SIGTERM')});
}
export async function startMinecraft(job){
 const {signal}=job.abort;
 await checkJava(job.version);signal.throwIfAborted();job.phase='download';
 const jar=await ensureJar(job.version,signal);signal.throwIfAborted();
 const port=await freePort();job.directory=path.join(DATA,'worlds',job.id);await mkdir(job.directory,{recursive:true});
 await writeFile(path.join(job.directory,'server.properties'),properties(job,port));
 // Only reached after the user explicitly ran accept-eula.
 await writeFile(path.join(job.directory,'eula.txt'),'eula=true\n');signal.throwIfAborted();
 job.phase='generating';
 const child=spawn(process.env.JAVA_BIN||'java',['-Xms512M','-Xmx2G','-jar',jar,'nogui'],{cwd:job.directory,stdio:['pipe','pipe','pipe'],windowsHide:true});job.child=child;
 child.stdin.on('error',()=>{});
 await new Promise((resolve,reject)=>{
  let tail='';const timer=setTimeout(()=>finish(new Error('Generazione troppo lenta (4 minuti). Controlla Java e la RAM disponibile.')),240000);
  const aborted=()=>finish(new Error('Generazione annullata.'));
  const exited=(code)=>finish(new Error(`Minecraft si è chiuso (${code}). ${tail.slice(-450)}`));
  const failed=e=>finish(new Error(`Avvio Java fallito: ${e.message}`));
  let settled=false;
  function finish(error){if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',aborted);child.off('exit',exited);child.off('error',failed);if(error)reject(error);else resolve()}
  function read(data){tail=(tail+data.toString()).slice(-3000);if(/Done \([^\n]+\)!/.test(tail))finish()}
  child.stdout.on('data',read);child.stderr.on('data',read);child.once('exit',exited);child.once('error',failed);signal.addEventListener('abort',aborted,{once:true});if(signal.aborted)aborted();
 });
 signal.throwIfAborted();job.phase='connecting';
 child.stdin.write('gamerule doDaylightCycle false\ntime set day\nweather clear\ngamerule doWeatherCycle false\n');
 const bot=mineflayer.createBot({host:'127.0.0.1',port,username:'SeedPreview',auth:'offline',version:job.version,viewDistance:'short',hideErrors:true});job.bot=bot;
 bot.on('error',()=>{}); // Handled during startup, then by the manager.
 await new Promise((resolve,reject)=>{
  let settled=false;const timer=setTimeout(()=>finish(new Error('Impossibile ricevere i chunk dal server Minecraft.')),60000);
  const aborted=()=>finish(new Error('Generazione annullata.'));
  const failed=e=>finish(new Error(`Connessione al mondo fallita: ${e.message}`));
  const ended=()=>finish(new Error('Minecraft ha chiuso la connessione prima della preview.'));
  function finish(e){if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',aborted);bot.off('error',failed);bot.off('end',ended);if(e)reject(e);else resolve()}
  bot.once('error',failed);bot.once('end',ended);
  bot.once('spawn',async()=>{try{await bot.waitForChunksToLoad();finish()}catch(e){finish(e)}});
  signal.addEventListener('abort',aborted,{once:true});if(signal.aborted)aborted();
 });
 signal.throwIfAborted();
 return bot;
}
export async function disposeWorld(job){
 job.abort.abort();job.closeViewer?.();job.bot?.quit();await terminate(job.child);
 if(job.directory)await rm(job.directory,{recursive:true,force:true,maxRetries:3,retryDelay:200});
}
