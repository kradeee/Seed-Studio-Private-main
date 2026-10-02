import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA=path.join(ROOT,'.data');
export const PROFILES=Object.freeze({'1.21.1':{java:21},'1.21.4':{java:21}});
export const PORT=4318;
export const ORIGINS=new Set([`http://127.0.0.1:${PORT}`,`http://localhost:${PORT}`,'http://127.0.0.1:5173','http://localhost:5173']);
export function validateRequest(value){
 if(!value||typeof value.seed!=='string'||!/^[-]?\d{1,19}$/.test(value.seed))throw new Error('Seed numerico a 64 bit richiesto.');
 const n=BigInt(value.seed);
 if(n<-(1n<<63n)||n>(1n<<63n)-1n)throw new Error('Seed fuori dall’intervallo a 64 bit.');
 if(!Object.hasOwn(PROFILES,value.version))throw new Error('Preview disponibile solo per Java 1.21.1 e 1.21.4.');
 if(typeof value.large!=='boolean')throw new Error('Tipo di mondo non valido.');
 return {seed:n.toString(),version:value.version,large:value.large};
}
export function properties({seed,large},port){
 return `server-ip=127.0.0.1\nserver-port=${port}\nonline-mode=false\nenforce-secure-profile=false\nlevel-name=world\nlevel-seed=${seed}\nlevel-type=${large?'minecraft:large_biomes':'minecraft:normal'}\ngenerate-structures=true\ngamemode=adventure\nforce-gamemode=true\ndifficulty=peaceful\nmax-players=1\nview-distance=5\nsimulation-distance=3\nspawn-protection=0\nspawn-animals=false\nspawn-monsters=false\nspawn-npcs=false\nenable-rcon=false\nenable-query=false\nallow-nether=false\nmax-tick-time=120000\nnetwork-compression-threshold=256\nmotd=Seed Studio local preview\n`;
}
