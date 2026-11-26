/* Cookie-free visit and event counting with GoatCounter, without their script.
 *
 * GoatCounter's count.js always sends location.search (and the full referrer), and on this
 * site the address holds the seed and map position. So we speak its documented /count
 * protocol directly and send only: page path, title, event flag, screen width, a bot hint and
 * the referring page without its query string. Nothing is sent when site.config.ts has no
 * goatcounterCode, on localhost or private networks, in frames or prerendering. Event names
 * are fixed English slugs, never user data. */
import {SITE} from '../../site.config';

const LOCAL=/(localhost$|^127\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|^192\.168\.|^0\.0\.0\.0$)/;

function blocked(){
 if(!SITE.goatcounterCode||typeof window==='undefined')return true;
 if((document.visibilityState as string)==='prerender'||window.top!==window.self)return true;
 if(LOCAL.test(location.hostname)||location.protocol==='file:')return true;
 try{if(localStorage.getItem('skipgc')==='t')return true}catch{/* storage unavailable */}
 return false;
}

/** Referring page without query or fragment (it could be one of our own seed links). */
function referrer(){
 if(!document.referrer)return '';
 try{const u=new URL(document.referrer);return u.origin+u.pathname}catch{return ''}
}

function send(data:Record<string,string|number|boolean>){
 if(blocked())return;
 const q=new URLSearchParams();
 for(const [k,v] of Object.entries(data))if(v!==''&&v!==false)q.set(k,String(v));
 q.set('s',String(window.screen.width));
 if(navigator.webdriver)q.set('b','153'); // automated browsers: GoatCounter discards them
 q.set('rnd',Math.random().toString(36).slice(2,7));
 const url=`https://${encodeURIComponent(SITE.goatcounterCode)}.goatcounter.com/count?${q}`;
 try{if(navigator.sendBeacon?.(url))return}catch{/* fall back below */}
 const img=new Image(1,1);img.alt='';img.src=url;
}

/** One page view: the path only (/, /en/, /privacy.html), never the query string. */
export function trackPageview(){send({p:location.pathname,t:document.title,r:referrer()})}

/** One usage event, e.g. track('copy-seed'). */
export function track(name:string){send({p:name,t:name,e:true})}
