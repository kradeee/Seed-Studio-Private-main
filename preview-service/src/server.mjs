import express from 'express';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {ROOT,PORT,ORIGINS,PROFILES} from './config.mjs';
import {acceptedEula} from './minecraft.mjs';
import {PreviewManager} from './manager.mjs';
import {attachViewer} from './viewer.mjs';
const require=createRequire(import.meta.url);
const assets=path.join(path.dirname(require.resolve('prismarine-viewer/package.json')),'public');
export function createService({manager:provided}={}){
 const app=express(),server=http.createServer(app);
 const manager=provided||new PreviewManager({onReady:(job,bot)=>{
  const close=attachViewer(server,job,bot);
  const lost=()=>{if(job.phase==='ready'){job.phase='error';job.error='La connessione al mondo si è interrotta. Chiudi e rigenera la preview.';void manager.disposeOnce(job)}};
  bot.once('end',lost);job.child.once('exit',lost);return close;
 }});
 app.disable('x-powered-by');
 app.use((req,res,next)=>{
  if(!new Set([`127.0.0.1:${PORT}`,`localhost:${PORT}`]).has(req.headers.host))return res.status(403).json({error:'Host non consentito.'});
  const origin=req.headers.origin;
  if(origin&&!ORIGINS.has(origin))return res.status(403).json({error:'Origine non consentita. Apri Seed Studio su localhost:5173.'});
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin')}
  res.setHeader('Access-Control-Allow-Methods','GET, POST, DELETE, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method==='OPTIONS')return res.sendStatus(204);next();
 });
 app.use(express.json({limit:'4kb'}));
 const route=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
 app.get('/health',route(async(req,res)=>res.json({ok:true,versions:Object.keys(PROFILES),eulaAccepted:await acceptedEula(),mode:'local'})));
 app.post('/api/previews',route(async(req,res)=>res.status(202).json(await manager.start(req.body))));
 app.get('/api/previews/:id',route(async(req,res)=>res.json(manager.get(req.params.id))));
 app.delete('/api/previews/:id',route(async(req,res)=>{await manager.stop(req.params.id);res.sendStatus(204)}));
 app.post('/api/previews/:id/look',route(async(req,res)=>{
  const state=manager.get(req.params.id);if(state.phase!=='ready')return res.status(409).json({error:'Mondo non ancora pronto.'});
  const {yaw,pitch}=req.body||{};
  if(!Number.isFinite(yaw)||!Number.isFinite(pitch)||Math.abs(yaw)>1000||Math.abs(pitch)>Math.PI/2)return res.status(400).json({error:'Orientamento non valido.'});
  await manager.current.bot.look(yaw,pitch,true);res.sendStatus(204);
 }));
 app.use('/view/:id',(req,res,next)=>{
  try{const state=manager.get(req.params.id);if(state.phase!=='ready')return res.status(409).send('Preview non disponibile.');next()}catch(e){next(e)}
 });
 app.get('/view/:id/',(req,res)=>res.sendFile(path.join(ROOT,'public','viewer.html')));
 app.get('/view/:id/controls.js',(req,res)=>res.sendFile(path.join(ROOT,'public','controls.js')));
 app.use('/view/:id',express.static(assets,{index:false}));
 app.use((error,req,res,next)=>{if(res.headersSent)return next(error);res.status(error.status||400).json({error:error.message||'Errore del servizio.'})});
 return {server,manager};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const {server,manager}=createService();
 server.listen(PORT,'127.0.0.1',()=>console.log(`Preview Minecraft: http://127.0.0.1:${PORT}\nApri Seed Studio su http://localhost:5173\nPrima generazione: Java 21 e npm run accept-eula sono necessari.`));
 server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`La porta ${PORT} è occupata: il servizio potrebbe essere già avviato.`:e.message);process.exitCode=1});
 const timer=setInterval(()=>manager.expire().catch(console.error),15000);timer.unref();
 let closing=false;
 const stop=async()=>{if(closing)return;closing=true;clearInterval(timer);if(manager.current)await manager.stop(manager.current.id);server.close(()=>process.exit(0));server.closeAllConnections()};
 process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
