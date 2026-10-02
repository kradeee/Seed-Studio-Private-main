/* Camera controls only: no block edits, chat commands or arbitrary server input. */
(() => {
 const id=location.pathname.split('/')[2];
 const problem=document.getElementById('problem');
 const fail=message=>{problem.textContent=message;problem.style.display='grid'};
 let yaw=0,pitch=0,drag=null,dirty=false,sending=false;
 const clamp=()=>{yaw=((yaw+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;pitch=Math.max(-1.45,Math.min(1.45,pitch));dirty=true};
 window.addEventListener('error',()=>fail('Il visualizzatore non è riuscito a disegnare il mondo. Verifica che WebGL e l’accelerazione grafica siano attivi, poi riapri la preview.'));
 document.addEventListener('pointerdown',e=>{if(e.target.tagName!=='CANVAS')return;drag={x:e.clientX,y:e.clientY};e.target.setPointerCapture(e.pointerId);e.preventDefault()});
 document.addEventListener('pointermove',e=>{if(!drag)return;yaw-=(e.clientX-drag.x)*.004;pitch-=(e.clientY-drag.y)*.004;drag={x:e.clientX,y:e.clientY};clamp()});
 for(const event of ['pointerup','pointercancel'])document.addEventListener(event,()=>{drag=null});
 document.addEventListener('keydown',e=>{if(e.target.tagName==='BUTTON')return;const delta=.12;if(e.key==='ArrowLeft')yaw+=delta;else if(e.key==='ArrowRight')yaw-=delta;else if(e.key==='ArrowUp')pitch+=delta;else if(e.key==='ArrowDown')pitch-=delta;else return;e.preventDefault();clamp()});
 document.getElementById('reset').onclick=()=>{yaw=0;pitch=0;clamp()};
 document.getElementById('full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{document.getElementById('full').textContent='Usa una nuova scheda'}};
 setInterval(async()=>{if(!dirty||sending)return;sending=true;dirty=false;try{const r=await fetch(`/api/previews/${id}/look`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({yaw,pitch}),signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Error()}catch{fail('La preview è stata chiusa o il servizio locale si è fermato. Torna a Seed Studio per rigenerarla.')}finally{sending=false}},60);
 setInterval(async()=>{try{const r=await fetch(`/api/previews/${id}`,{signal:AbortSignal.timeout(5000)});const state=await r.json();if(!r.ok||state.phase!=='ready')throw new Error()}catch{fail('Sessione terminata. Torna a Seed Studio per riaprire il mondo.')}},10000);
})();
