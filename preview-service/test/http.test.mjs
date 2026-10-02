import test from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createService} from '../src/server.mjs';
import {PreviewManager} from '../src/manager.mjs';
test('HTTP API enforces origin/host, returns explicit EULA error, no stale worlds',async()=>{
 const manager=new PreviewManager({eula:async()=>false});const {server}=createService({manager});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const request=(url,options={})=>new Promise((resolve,reject)=>{const req=http.request(base+url,{method:options.method||'GET',headers:{Host:'127.0.0.1:4318',Origin:'http://localhost:5173',...options.headers}},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,json:()=>JSON.parse(body)}))});req.on('error',reject);req.end(options.body)});
  assert.equal((await request('/health')).status,200);
  assert.equal((await request('/health',{headers:{Origin:'https://untrusted.example'}})).status,403);
  assert.equal((await fetch(base+'/health')).status,403);
  const r=await request('/api/previews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seed:'12345',version:'1.21.1',large:false})});assert.equal(r.status,412);assert.match((await r.json()).error,/EULA/);
  assert.equal((await request('/api/previews/expired')).status,404);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
});
