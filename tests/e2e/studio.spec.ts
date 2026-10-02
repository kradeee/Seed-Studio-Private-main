import {test,expect,type Page} from '@playwright/test';

async function load(page:Page){
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Il tuo prossimo mondo, da qui.'})).toBeVisible();
 await expect(page.getByRole('group',{name:'Dimensione',exact:true})).toBeVisible();
 // SSR text appears before the client handlers are attached. URL sync runs on mount.
 await expect.poll(()=>new URL(page.url()).searchParams.get('seed')).toBeTruthy();
}

// Real WASM workers: a result must open a seed, and a shared URL must restore it.
test('search, choose, explore, share and reopen a real seed',async({page,context})=>{
 const errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 await load(page);
 // A village alone is intentionally common, making this test independent of rare seeds.
 await page.getByRole('button',{name:'Pianura',exact:true}).click();
 await page.getByRole('button',{name:'Pianura',exact:true}).click();
 await page.getByRole('button',{name:'Boschetto di ciliegi',exact:true}).click();
 await page.getByRole('button',{name:'Boschetto di ciliegi',exact:true}).click();
 await page.getByRole('button',{name:'Cerca seed',exact:true}).click();
 await expect(page.locator('.result').first()).toBeVisible({timeout:30000});
 const chosen=await page.locator('.result code').first().innerText();
 await page.locator('.result').filter({hasText:chosen}).click();
 await expect(page.locator('#seed')).toHaveValue(chosen);
 await expect(page.getByRole('button',{name:'Cerca seed',exact:true})).toBeVisible();
 const dimensions=page.getByRole('group',{name:'Dimensione',exact:true});
 await dimensions.getByRole('button',{name:'Nether',exact:true}).click();
 await expect(dimensions.getByRole('button',{name:'Nether',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect.poll(()=>new URL(page.url()).searchParams.get('d')).toBe('nether');
 await page.getByRole('button',{name:'Condividi',exact:true}).click();
 await expect(page.getByRole('button',{name:'Link copiato!',exact:true})).toBeVisible();
 const link=await page.evaluate(()=>navigator.clipboard.readText());
 const reopened=await context.newPage();await reopened.goto(link);
 await expect(reopened.locator('#seed')).toHaveValue(chosen);
 await expect(reopened.getByRole('group',{name:'Dimensione',exact:true}).getByRole('button',{name:'Nether',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(reopened.locator('.map-legend')).toContainText(/./);
 expect(errors).toEqual([]);
});

// Only the search and result-preview worker is controlled here. Map workers stay real.
// Releasing a preview after cancellation reproduces the original race deterministically.
async function delayedSearch(page:Page){
 await page.addInitScript(()=>{
  const NativeWorker=window.Worker;
  const previews:Array<{worker:Worker;id:number;seed:string}>=[];
  const jobs:Array<Worker>=[];
  class SearchWorker extends EventTarget{
   onmessage:((event:MessageEvent)=>void)|null=null;
   onerror:((event:ErrorEvent)=>void)|null=null;
   stopped=false;
   constructor(){super();setTimeout(()=>this.deliver({kind:'ready'}),0)}
   deliver(data:unknown){this.onmessage?.(new MessageEvent('message',{data}))}
   postMessage(message:{kind:string;id:number;seed:string}){
    if(message.kind==='search'){jobs.push(this as unknown as Worker);this.deliver({kind:'SEED_FOUND',data:{seed:'12345',spawnX:96,spawnZ:-32,structures:[],island:null}})}
    else if(message.kind==='preview')previews.push({worker:this as unknown as Worker,id:message.id,seed:message.seed});
    else if(message.kind==='support')this.deliver({kind:'support',id:message.id,biomes:[1,185],structures:{5:1}});
   }
   terminate(){this.stopped=true}
  }
  window.Worker=class extends NativeWorker{
   constructor(url:string|URL,options?:WorkerOptions){
    if(String(url)==='/engine/studio-worker.js')return new SearchWorker() as unknown as Worker;
    super(url,options);
   }
  };
  Object.assign(window,{
   pendingSearchPreviews:()=>previews.length,
   releaseSearchPreviews:()=>{
    for(const {worker,id} of previews.splice(0)){
     (worker as unknown as SearchWorker).deliver({kind:'preview',id,ids:new Int32Array([1]),heights:null,rgba:new Uint8ClampedArray([0,255,0,255]),x:0,z:0,w:1,h:1,biomeDist:{1:0,185:0}});
    }
    // Events already queued before terminate must also be ignored.
    for(const w of jobs)(w as unknown as SearchWorker).deliver({kind:'error',message:'late error'});
   },
  });
 });
}

for(const action of ['stop','manual seed','random seed','change version'] as const){
 test(`late search results cannot change the world after ${action}`,async({page})=>{
  await delayedSearch(page);await load(page);
  await page.getByRole('button',{name:'Cerca seed',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'pendingSearchPreviews')())).toBeGreaterThan(0);
  if(action==='stop')await page.getByRole('button',{name:'Interrompi ricerca',exact:true}).click();
  if(action==='manual seed'){
   await page.locator('#seed').fill('67890');await page.getByRole('button',{name:'Esplora questo seed',exact:true}).click();
  }
  if(action==='random seed')await page.getByRole('button',{name:'Genera seed casuale',exact:true}).click();
  if(action==='change version'){
   // Preview has an independent version action, even while composer controls are disabled.
   await page.getByRole('button',{name:'Interrompi ricerca',exact:true}).click();
   await page.getByRole('combobox',{name:'Versione Minecraft'}).selectOption('22');
  }
  const seed=await page.locator('#seed').inputValue();
  const status=await page.locator('.search-message').innerText();
  await page.evaluate(()=>Reflect.get(window,'releaseSearchPreviews')());
  await page.waitForTimeout(200);
  await expect(page.locator('#seed')).toHaveValue(seed);
  await expect(page.locator('.result')).toHaveCount(0);
  await expect(page.locator('.search-message')).toHaveText(status);
  await expect(page.getByRole('alert')).toHaveCount(0);
 });
}

test('mobile fits the viewport and guide opens and closes',async({page})=>{
 await page.setViewportSize({width:390,height:844});await load(page);
 const widths=await page.evaluate(()=>({screen:innerWidth,document:document.documentElement.scrollWidth}));
 expect(widths.document).toBeLessThanOrEqual(widths.screen);
 await page.getByRole('button',{name:'Guida',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Prima di partire'})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('heading',{name:'Prima di partire'})).not.toBeVisible();
});
