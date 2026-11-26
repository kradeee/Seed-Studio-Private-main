/* Saved seeds, kept in this browser only (localStorage): no account, nothing sent anywhere. */
import {useCallback,useEffect,useState} from 'react';

export type Favorite={seed:string;version:number;large:boolean;at:number};
const KEY='seed-studio:favorites',MAX=50;

function read():Favorite[]{
 try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');
  return Array.isArray(v)?v.filter(f=>f&&typeof f.seed==='string'&&typeof f.version==='number').slice(0,MAX):[]}
 catch{return[]}
}
const same=(f:Favorite,seed:string,version:number,large:boolean)=>f.seed===seed&&f.version===version&&!!f.large===large;

export function useFavorites(){
 const [list,setList]=useState<Favorite[]>(()=>typeof localStorage==='undefined'?[]:read());
 // keep several open tabs in step
 useEffect(()=>{const on=(e:StorageEvent)=>{if(e.key===KEY)setList(read())};addEventListener('storage',on);return()=>removeEventListener('storage',on)},[]);
 const store=useCallback((l:Favorite[])=>{setList(l);try{localStorage.setItem(KEY,JSON.stringify(l))}catch{/* private mode or full: keep it for this visit */}},[]);
 const has=(seed:string,version:number,large:boolean)=>list.some(f=>same(f,seed,version,large));
 const toggle=(seed:string,version:number,large:boolean)=>store(has(seed,version,large)?list.filter(f=>!same(f,seed,version,large)):[{seed,version,large,at:Date.now()},...list].slice(0,MAX));
 const remove=(f:Favorite)=>store(list.filter(x=>x!==f));
 return {list,has,toggle,remove};
}
