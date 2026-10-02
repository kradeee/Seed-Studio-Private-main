import test from 'node:test';
import assert from 'node:assert/strict';
import {PreviewManager} from '../src/manager.mjs';
import {validateRequest,properties} from '../src/config.mjs';
const input={seed:'-9223372036854775808',version:'1.21.1',large:false};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('64-bit seeds stay strings; unsupported versions and injection are rejected',()=>{
 assert.deepEqual(validateRequest(input),input);
 assert.equal(validateRequest({...input,seed:'9223372036854775807'}).seed,'9223372036854775807');
 for(const seed of ['9223372036854775808','-9223372036854775809','12\nserver-ip=0.0.0.0','hello',12345])assert.throws(()=>validateRequest({...input,seed}));
 for(const version of ['26.3','1.21.3','__proto__','constructor'])assert.throws(()=>validateRequest({...input,version}));
 assert.throws(()=>validateRequest({...input,large:'false'}));
});
test('world settings preserve seed/large biomes and keep the game server local',()=>{
 const text=properties({...input,large:true},25566);
 assert.match(text,/level-seed=-9223372036854775808\n/);assert.match(text,/level-type=minecraft:large_biomes/);
 assert.match(text,/server-ip=127.0.0.1/);assert.match(text,/enable-rcon=false/);assert.match(text,/generate-structures=true/);
});
test('no Minecraft launch without explicit EULA acceptance',async()=>{
 let launched=false;const m=new PreviewManager({eula:async()=>false,launch:async()=>{launched=true}});
 await assert.rejects(m.start(input),{status:412});assert.equal(launched,false);assert.equal(m.busy,false);
});
test('one active world, exact version reported, cancellation waits for cleanup',async()=>{
 let disposed=0;const m=new PreviewManager({eula:async()=>true,launch:async()=>({}),dispose:async()=>{disposed++}});
 const state=await m.start(input);await tick();assert.equal(m.get(state.id).phase,'ready');assert.equal(m.get(state.id).version,'1.21.1');
 await assert.rejects(m.start(input),{status:409});assert.throws(()=>m.get('other'),{status:404});
 await m.stop('other');assert.ok(m.current);await m.stop(state.id);assert.equal(disposed,1);assert.equal(m.current,null);assert.equal(m.busy,false);
});
test('cancel while generation is in flight releases resources only once',async()=>{
 let disposed=0;const m=new PreviewManager({eula:async()=>true,launch:job=>new Promise((resolve,reject)=>job.abort.signal.addEventListener('abort',()=>reject(new Error('cancel')),{once:true})),dispose:async()=>{disposed++}});
 const state=await m.start(input);await m.stop(state.id);assert.equal(disposed,1);assert.equal(m.current,null);
});
test('startup errors are visible and a stopped failed session can be retried',async()=>{
 let disposed=0;const m=new PreviewManager({eula:async()=>true,launch:async()=>{throw new Error('Java 21 richiesto')},dispose:async()=>{disposed++}});
 const state=await m.start(input);await tick();assert.equal(m.get(state.id).phase,'error');assert.match(m.get(state.id).error,/Java 21/);
 await m.stop(state.id);assert.equal(disposed,1);await m.start(input);await tick();assert.equal(m.current.phase,'error');await m.stop(m.current.id);
});
test('idle and maximum-duration expiry stop worlds',async()=>{
 let time=0;const m=new PreviewManager({now:()=>time,eula:async()=>true,launch:async()=>({}),dispose:async()=>{}});
 await m.start(input);await tick();time=120001;await m.expire();assert.equal(m.current,null);
 const state=await m.start(input);await tick();time+=20*60000+1;m.get(state.id);await m.expire();assert.equal(m.current,null);
});
