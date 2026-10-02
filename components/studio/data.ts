import type {LucideIcon} from 'lucide-react';
import {Pyramid,TreePalm,FlaskConical,Snowflake,House,Waves,Ship,Landmark,Castle,Swords,Orbit,Skull,Columns3,KeyRound,Tent,Flame,Crown,Building2,Eye} from 'lucide-react';

/* ---------- Versions (cubiomes MCVersion ids) ----------
 * Seed Studio covers the modern terrain generator (1.18+): relief, cave biomes and the
 * structure layer all rely on it. The ids are cubiomes' enum values. */
export const VERSIONS=[
 {id:35,name:'26.3'},{id:34,name:'26.2'},{id:33,name:'26.1'},
 {id:32,name:'1.21.11'},{id:31,name:'1.21.9'},{id:30,name:'1.21.6'},{id:29,name:'1.21.5'},{id:28,name:'1.21.4'},{id:27,name:'1.21.3'},{id:26,name:'1.21.1'},
 {id:25,name:'1.20'},{id:24,name:'1.19.4'},{id:23,name:'1.19.2'},{id:22,name:'1.18'}
];
export const LARGE_BIOMES_FLAG=1<<16; // packed into the version argument (see api-source.c unpackVersion)
export const packVersion=(version:number,large:boolean)=>version|(large?LARGE_BIOMES_FLAG:0);

export type Dimension=0|-1|1;
export const DIMENSIONS:{id:Dimension;name:string}[]=[{id:0,name:'Overworld'},{id:-1,name:'Nether'},{id:1,name:'End'}];

/* ---------- Heights (Overworld, 1.18+) ---------- */
export const HEIGHTS=[
 {y:256,name:'Superficie',hint:'Biomi visibili all’aperto'},
 {y:64,name:'Y 64 · livello del mare',hint:'Grotte appena sotto il suolo'},
 {y:0,name:'Y 0 · grotte',hint:'Grotte rigogliose, speleotemi'},
 {y:-52,name:'Y −52 · abisso',hint:'Oscurità profonda e città antiche'}
];

/* ---------- Biomes ---------- */
export type BiomeGroup={name:string;dim:Dimension;cave?:boolean;ids:number[]};
export const BIOME_GROUPS:BiomeGroup[]=[
 {name:'Pianure e foreste',dim:0,ids:[1,129,177,4,132,27,155,29,186,185,188,6,184,14]},
 {name:'Montagne e freddo',dim:0,ids:[5,32,160,30,12,140,178,179,180,181,182,3,131,34]},
 {name:'Caldi e aridi',dim:0,ids:[2,35,36,163,37,38,165,21,23,168]},
 {name:'Acque e coste',dim:0,ids:[0,24,44,45,48,46,49,10,50,7,11,16,26,25]},
 {name:'Grotte',dim:0,cave:true,ids:[175,174,183,187]},
 {name:'Nether',dim:-1,ids:[8,170,171,172,173]},
 {name:'End',dim:1,ids:[9,40,41,42,43]}
];
export const CAVE_BIOMES=new Set([174,175,183,187]);

/* Map palette: softer, more natural tones than the engine's debug colours. Anything
 * missing here falls back to the engine palette. */
export const COLORS:Record<number,number[]>={0:[35,88,113],1:[140,170,94],2:[214,190,131],3:[115,140,117],4:[66,113,70],5:[64,102,83],6:[91,112,79],7:[55,125,156],8:[122,48,44],9:[214,212,156],10:[77,127,159],11:[123,162,185],12:[209,221,220],14:[159,116,153],16:[222,210,162],21:[66,121,59],23:[115,142,71],24:[30,67,99],25:[149,154,134],26:[211,218,199],27:[125,153,95],29:[48,86,69],30:[140,170,164],32:[69,100,74],34:[81,124,82],35:[169,168,91],36:[154,151,87],37:[185,111,69],38:[153,128,73],40:[40,36,60],41:[160,154,120],42:[196,190,146],43:[122,117,98],44:[49,145,162],45:[40,115,137],46:[46,100,136],48:[31,87,112],49:[30,75,112],50:[40,89,129],129:[162,181,96],131:[128,135,128],132:[110,153,98],140:[187,213,222],155:[145,165,113],160:[74,101,77],163:[160,154,86],165:[185,118,73],168:[83,132,70],170:[94,76,62],171:[148,40,48],172:[38,128,120],173:[88,84,92],174:[126,104,86],175:[92,146,70],177:[135,168,119],178:[135,162,150],179:[201,215,214],180:[198,205,204],181:[220,233,231],182:[145,158,155],183:[22,42,48],184:[82,115,91],185:[223,158,181],186:[157,169,151],187:[196,184,86],188:[116,146,88]};
export const OCEANS=new Set([0,10,24,44,45,46,48,49,50]);
export const hex=(c:number[])=>'#'+c.slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('');

/* ---------- Structures (cubiomes StructureType ids) ---------- */
export type StructureMeta={id:number;name:string;short:string;icon:LucideIcon;color:string;dims:Dimension[];search:boolean;note:string};
export const STRONGHOLD=99;
export const STRUCTURES:StructureMeta[]=[
 {id:5,name:'Villaggio',short:'Villaggi',icon:House,color:'#e3a257',dims:[0],search:true,note:'Commercio con i villici, letti e cibo.'},
 {id:10,name:'Avamposto dei predoni',short:'Avamposti',icon:Swords,color:'#b9c1c4',dims:[0],search:true,note:'Predoni e il loro stendardo: attenzione.'},
 {id:1,name:'Tempio del deserto',short:'Templi del deserto',icon:Pyramid,color:'#e8c26c',dims:[0],search:true,note:'Tesoro sotto la piramide (occhio alla TNT).'},
 {id:2,name:'Tempio della giungla',short:'Templi della giungla',icon:TreePalm,color:'#72b34c',dims:[0],search:true,note:'Trappole con frecce e un enigma a leve.'},
 {id:3,name:'Capanna della strega',short:'Capanne della strega',icon:FlaskConical,color:'#a17ad0',dims:[0],search:true,note:'Streghe e un gatto nero.'},
 {id:4,name:'Igloo',short:'Igloo',icon:Snowflake,color:'#bfe3f0',dims:[0],search:true,note:'A volte con un laboratorio segreto sotterraneo.'},
 {id:6,name:'Rovine oceaniche',short:'Rovine oceaniche',icon:Waves,color:'#57bdd1',dims:[0],search:true,note:'Annegati e mappe del tesoro.'},
 {id:7,name:'Relitto',short:'Relitti',icon:Ship,color:'#c39a66',dims:[0],search:true,note:'Forzieri con mappe del tesoro sepolto.'},
 {id:8,name:'Monumento oceanico',short:'Monumenti',icon:Landmark,color:'#46c9ae',dims:[0],search:true,note:'Guardiani, spugne e blocchi d’oro.'},
 {id:9,name:'Magione nel bosco',short:'Magioni',icon:Castle,color:'#a9774b',dims:[0],search:true,note:'Molto rara, nelle foreste scure.'},
 {id:11,name:'Portale in rovina',short:'Portali in rovina',icon:Orbit,color:'#b67cf0',dims:[0,-1],search:true,note:'Ossidiana e oro: la via rapida per il Nether. Il tipo (oceano, deserto, giungla…) dipende dal terreno e il sito non lo prevede.'},
 {id:13,name:'Città antica',short:'Città antiche',icon:Skull,color:'#4aa6bd',dims:[0],search:true,note:'Nell’oscurità profonda. Custodita dal Warden.'},
 {id:24,name:'Rovine di sentiero',short:'Rovine di sentiero',icon:Columns3,color:'#cf9470',dims:[0],search:true,note:'Da scavare con il pennello: cocci e vasi.'},
 {id:25,name:'Camere della prova',short:'Camere della prova',icon:KeyRound,color:'#e08a42',dims:[0],search:true,note:'Generatori della prova e la mazza.'},
 {id:26,name:'Accampamento abbandonato',short:'Accampamenti',icon:Tent,color:'#a9b85f',dims:[0],search:true,note:'Novità della 26.3.'},
 {id:STRONGHOLD,name:'Roccaforte',short:'Roccaforti',icon:Eye,color:'#7fdca4',dims:[0],search:false,note:'Il portale dell’End. Fino a 128 per mondo.'},
 {id:18,name:'Fortezza del Nether',short:'Fortezze',icon:Flame,color:'#e0574a',dims:[-1],search:true,note:'Blaze e verruche del Nether.'},
 {id:19,name:'Bastione',short:'Bastioni',icon:Crown,color:'#ecc94b',dims:[-1],search:true,note:'Piglin, oro e frammenti di netherite.'},
 {id:21,name:'Città dell’End',short:'Città dell’End',icon:Building2,color:'#d9bbf5',dims:[1],search:true,note:'Shulker e, a volte, la nave con le elitre.'}
];
/* The id to check a structure in game: /locate structure <id> (# = every variant). */
export const LOCATE_ID:Record<number,string>={5:'#village',10:'pillager_outpost',1:'desert_pyramid',2:'jungle_pyramid',3:'swamp_hut',4:'igloo',6:'#ocean_ruin',7:'#shipwreck',8:'monument',9:'mansion',11:'#ruined_portal',13:'ancient_city',24:'trail_ruins',25:'trial_chambers',99:'stronghold',18:'fortress',19:'bastion_remnant',21:'end_city'};
export const STRUCTURE_BY_ID=new Map(STRUCTURES.map(s=>[s.id,s]));
export const DEFAULT_LAYERS=[5,10,1,2,3,4,8,9,11,13,24,25,26,STRONGHOLD,18,19,21];

/* ---------- Search presets ---------- */
export const PRESETS=[
 {name:'Valle in fiore',detail:'Ciliegi, prati e un villaggio vicino.',biomes:[185,1],structures:[5],radius:1024,island:0,dimension:0 as Dimension},
 {name:'Tra le vette',detail:'Vette frastagliate e taiga ai piedi dei monti.',biomes:[180,5],structures:[],radius:1024,island:0,dimension:0 as Dimension},
 {name:'Isola sperduta',detail:'Spawn su un’isola, oceano tutt’intorno.',biomes:[],structures:[],radius:512,island:128,dimension:0 as Dimension},
 {name:'Speedrun',detail:'Villaggio e portale in rovina a due passi.',biomes:[],structures:[5,11],radius:256,island:0,dimension:0 as Dimension},
 {name:'Avventura nel profondo',detail:'Camere della prova e città antica.',biomes:[],structures:[25,13],radius:768,island:0,dimension:0 as Dimension},
 {name:'Nether ospitale',detail:'Fortezza e bastione vicino all’origine.',biomes:[],structures:[18,19],radius:384,island:0,dimension:-1 as Dimension}
];

/* ---------- Helpers ---------- */
// Locale-free number formatting (identical on server and client: no hydration mismatch).
export function fmt(n:number){const s=Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');return (n<0?'−':'')+s}
export function normalizeSeed(input:string){const s=input.trim();if(!s)throw new Error('Inserisci un seed.');if(/^-?\d+$/.test(s)){const n=BigInt(s);if(n>=-(1n<<63n)&&n<=(1n<<63n)-1n)return n.toString()}
 // Like the game: any other text is hashed with Java's String.hashCode.
 let h=0;for(const ch of s)for(let i=0;i<ch.length;i++)h=(Math.imul(31,h)+ch.charCodeAt(i))|0;return String(h)}
export function randomSeed(){const a=crypto.getRandomValues(new Uint32Array(2));return BigInt.asIntN(64,(BigInt(a[0])<<32n)|BigInt(a[1])).toString()}
