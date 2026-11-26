/* One responsive AdSense unit. Renders nothing (and loads no script) until site.config.ts has
 * both a publisher id and a slot id. Consent in the EU is handled by Google's own certified
 * consent message, enabled from the AdSense dashboard. */
import {useEffect,useRef} from 'react';
import {SITE} from '../../site.config';
import {tr} from './i18n';

declare global{interface Window{adsbygoogle?:unknown[]}}

function loadScript(client:string){
 if(document.querySelector('script[data-adsense]'))return;
 const s=document.createElement('script');s.async=true;s.crossOrigin='anonymous';s.dataset.adsense='1';
 s.src=`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
 document.head.appendChild(s);
}

export default function AdSlot(){
 const pushed=useRef(false);
 const on=!!(SITE.adsenseClient&&SITE.adsenseSlot);
 useEffect(()=>{if(!on||pushed.current)return;pushed.current=true;loadScript(SITE.adsenseClient);
  try{(window.adsbygoogle=window.adsbygoogle||[]).push({})}catch{/* blocked by an ad blocker: fine */}},[on]);
 if(!on)return null;
 return <aside className="ad-slot" aria-label={tr('Pubblicità','Advertisement')}><small>{tr('Pubblicità','Advertisement')}</small>
  <ins className="adsbygoogle" style={{display:'block'}} data-ad-client={SITE.adsenseClient} data-ad-slot={SITE.adsenseSlot} data-ad-format="auto" data-full-width-responsive="true"/></aside>;
}
