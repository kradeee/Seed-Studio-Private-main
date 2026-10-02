import {createInterface} from 'node:readline/promises';
import {mkdir,writeFile} from 'node:fs/promises';
import {DATA} from './config.mjs';
const rl=createInterface({input:process.stdin,output:process.stdout});
console.log('Il servizio usa il server ufficiale Minecraft. Leggi la licenza prima di proseguire:');
console.log('https://www.minecraft.net/eula');
try{
 const reply=await rl.question('Accetti la EULA di Minecraft? Scrivi ACCETTO per confermare: ');
 if(reply.trim()!=='ACCETTO'){console.log('Nessuna accettazione registrata.');process.exitCode=1}
 else{await mkdir(DATA,{recursive:true});await writeFile(`${DATA}/eula-acceptance.json`,JSON.stringify({accepted:true,at:new Date().toISOString(),url:'https://www.minecraft.net/eula'},null,2));console.log('Accettazione registrata localmente. Ora esegui npm start.')}
}finally{rl.close()}
