import {createRequire} from 'node:module';
import {Server} from 'socket.io';
import {ORIGINS,PORT} from './config.mjs';
const require=createRequire(import.meta.url);
const {WorldView}=require('prismarine-viewer/viewer/lib/worldView');
export function attachViewer(http,job,bot){
 const events=['request','upgrade','close','listening'];
 const original=new Map(events.map(event=>[event,http.listeners(event)]));
 const io=new Server(http,{path:`/view/${job.id}/socket.io`,serveClient:false,maxHttpBufferSize:16384,allowRequest:(req,callback)=>callback(null,([`127.0.0.1:${PORT}`,`localhost:${PORT}`].includes(req.headers.host))&&(!req.headers.origin||ORIGINS.has(req.headers.origin)))});
 io.on('connection',socket=>{
  socket.emit('version',job.version);
  const world=new WorldView(bot.world,5,bot.entity.position,socket);
  const position=()=>{if(bot.entity)socket.emit('position',{pos:bot.entity.position,yaw:bot.entity.yaw,pitch:bot.entity.pitch,addMesh:false})};
  const timer=setInterval(position,100);position();
  world.listenToBot(bot);
  world.init(bot.entity.position).catch(()=>socket.disconnect());
  socket.on('disconnect',()=>{clearInterval(timer);world.removeListenersFromBot(bot)});
 });
 return ()=>{io.disconnectSockets(true);io.engine.close();io.removeAllListeners();for(const event of events){http.removeAllListeners(event);for(const listener of original.get(event))http.on(event,listener)}};
}
