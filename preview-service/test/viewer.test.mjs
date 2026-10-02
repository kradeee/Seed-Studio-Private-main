import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {EventEmitter} from 'node:events';
import {createService} from '../src/server.mjs';
import {PreviewManager} from '../src/manager.mjs';
import {attachViewer} from '../src/viewer.mjs';
const require=createRequire(import.meta.url);
const {io}=require('socket.io-client');
const {Vec3}=require('vec3');
const Chunk=require('prismarine-chunk')('1.21.1');
// Transport fixture only. It deliberately does not emulate Minecraft world generation.
test('viewer receives version/chunks/first-person pose; look and repeated teardown work',async()=>{
 let service;const bots=[];
 const manager=new PreviewManager({eula:async()=>true,launch:async job=>{
  const bot=new EventEmitter();bot.username='Test';bot.entity={position:new Vec3(8,64,8),yaw:0,pitch:0};bot.entities={};bot.world={getColumnAt:async()=>new Chunk(),raycast:()=>null};bot.look=async(yaw,pitch)=>{bot.entity.yaw=yaw;bot.entity.pitch=pitch};job.bot=bot;bots.push(bot);return bot;
 },dispose:async job=>job.closeViewer?.(),onReady:(job,bot)=>attachViewer(service.server,job,bot)});
 service=createService({manager});await new Promise(r=>service.server.listen(4318,'127.0.0.1',r));
 const original=service.server.listenerCount('request');
 try{
  for(let repeat=0;repeat<2;repeat++){
   const state=await manager.start({seed:'12345',version:'1.21.1',large:false});await manager.current.task;
   const socket=io('http://127.0.0.1:4318',{path:`/view/${state.id}/socket.io`,transports:['websocket'],extraHeaders:{Origin:'http://127.0.0.1:4318'},autoConnect:false});
   try{
    await new Promise((resolve,reject)=>{
     const seen=new Set();const timeout=setTimeout(()=>reject(new Error('Missing viewer packets')),5000);
     const mark=key=>{seen.add(key);if(seen.size===3){clearTimeout(timeout);resolve()}};
     socket.on('version',version=>{assert.equal(version,'1.21.1');mark('version')});
     socket.on('position',pose=>{assert.equal(pose.pos.y,64);assert.equal(typeof pose.yaw,'number');assert.equal(typeof pose.pitch,'number');mark('pose')});
     socket.on('loadChunk',payload=>{assert.ok(payload.chunk);mark('chunk')});
     socket.on('connect_error',e=>{clearTimeout(timeout);reject(e)});socket.connect();
    });
    const r=await fetch(`http://127.0.0.1:4318/api/previews/${state.id}/look`,{method:'POST',headers:{Origin:'http://localhost:5173','Content-Type':'application/json'},body:JSON.stringify({yaw:1,pitch:.2})});
    assert.equal(r.status,204);assert.equal(bots.at(-1).entity.yaw,1);
    assert.equal((await fetch(`http://127.0.0.1:4318/view/${state.id}/`)).status,200);
   }finally{socket.disconnect();await manager.stop(state.id)}
   assert.equal(service.server.listenerCount('request'),original);
   assert.equal((await fetch('http://127.0.0.1:4318/health')).status,200);
   assert.equal((await fetch(`http://127.0.0.1:4318/view/${state.id}/`)).status,404);
  }
 }finally{if(manager.current)await manager.stop(manager.current.id);service.server.closeAllConnections();await new Promise(r=>service.server.close(r))}
});
