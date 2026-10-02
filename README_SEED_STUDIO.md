# Seed Studio

Strumento web per comporre criteri di ricerca ed esplorare seed di Minecraft Java Edition.

## Cosa contiene

- interfaccia React/Vinext in `app/` e `components/studio/`;
- mappa interattiva a tessere (più worker in parallelo, cache) con zoom, trascinamento e pinch;
- Overworld, Nether ed End; quota dei biomi (superficie, grotte, abisso);
- tutte le strutture Java 1.18+: villaggi, avamposti, templi, capanne, igloo, rovine oceaniche, relitti, monumenti, magioni, portali in rovina, città antiche, rovine di sentiero, camere della prova, accampamenti (26.3), roccaforti, fortezze, bastioni, città dell’End;
- dettagli per struttura (villaggio zombi, portale gigante, tipo di bastione, nave dell’End, occhi nel portale della roccaforte, generatori di blaze) e comando /tp;
- chunk di slime, griglia dei chunk, legenda dei biomi in vista, strutture più vicine allo spawn;
- link condivisibili (seed, versione, dimensione, posizione, struttura selezionata nell’indirizzo);
- risultati con mini-mappa, distanze misurate dallo spawn e ordinamento per compattezza;
- ricerca parallela: biomi richiesti/esclusi, fino a 8 strutture, spawn su isola, Nether ed End, biomi grandi, versioni 1.18 → 26.3;
- ricerca di seed tramite motore Cubiomes/Seeder in `public/engine/`;
- asset visivo in `public/landscape.webp`;
- favicon e configurazione del sito.

## Avvio locale

Richiede Node.js 22 o superiore.

```bash
npm install
npm run dev
```

Per la build di produzione:

```bash
npm run build
```

## Note sul motore

La mappa viene calcolata nel browser con WebAssembly. Il file `public/engine/licenses.txt` contiene le licenze dei componenti Cubiomes e Seeder.

La mappa è una preview dei biomi a risoluzione 4 blocchi. Lo spawn e le posizioni dei villaggi sono indicativi; quando si usa Minecraft bisogna mantenere la stessa versione Java e la generazione predefinita.

## Strutture sulla mappa

`public/engine/structures.js` calcola in JavaScript la posizione di ogni tentativo di struttura nelle regioni visibili (la stessa aritmetica LCG di Cubiomes, `getFeaturePos` / `getLargeStructurePos`). La verifica di bioma e terreno la fa il motore WebAssembly: `nearest_structures` con raggio 0 sulla posizione del tentativo. Il calcolo è stato confrontato con `get_structure_in_regions` del motore su più seed e versioni, senza differenze. Nessuna ricompilazione del file `.wasm` è necessaria.

Nell’End, l’isola principale è disegnata come un disco approssimativo di ~150 blocchi: il motore fornisce i biomi, non la forma esatta del terreno.

## Verifica nel gioco

`VERIFICA.md` elenca posizioni attese per due seed, con i comandi `/locate` per controllarle in Minecraft.

## Test del motore

```bash
npm run test:engine
```

Non serve `npm install`. I test (`tests/engine.test.mjs`) controllano:

- le posizioni verificate nel gioco su Java 26.3 (seed 12345: spawn, villaggio, città antica, camere della prova, portali in rovina, fortezze, bastione, roccaforte con il numero di occhi);
- che il calcolo delle strutture in JavaScript coincida con il motore, per più seed e versioni, compresa la più recente che il motore conosce.

Su GitHub girano a ogni push (`.github/workflows/test.yml`).

## Aggiornare il motore (nuove versioni di Minecraft)

Il motore (`public/engine/api.js` + `api.wasm`) si ricompila da Cubiomes, fork di xpple.

- **Su GitHub:** Actions → *Rebuild engine* → *Run workflow*. Scarica Cubiomes, compila con Emscripten, esegue i test e apre una pull request. Ogni lunedì controlla da solo e compila solo se Cubiomes è cambiato. Il riepilogo dell'esecuzione dice se c'è una nuova versione di Minecraft da aggiungere e quali righe incollare in `VERSIONS` (`components/studio/data.ts`).
- **In locale:** con Emscripten installato, `git clone https://github.com/xpple/cubiomes engine/cubiomes` e poi `bash engine/build.sh`.
- **Dopo una nuova versione:** verificarla nel gioco (`VERIFICA.md`) e aggiungere un blocco `GROUND_TRUTH` ai test.

`public/engine/ENGINE_VERSION.txt` registra da quale commit di Cubiomes è stato compilato il motore.

## Preview in prima persona

Il pannello **Il primo sguardo** usa il servizio locale in `preview-service/` per
generare chunk reali con Minecraft Java 1.21.1 o 1.21.4 e mostrarli con Prismarine
Viewer. Richiede Java 21 e un terminale aggiuntivo oltre al sito. Leggi
**[PRIMO_AVVIO_PREVIEW.md](PRIMO_AVVIO_PREVIEW.md)** per installazione, accettazione
della EULA, avvio e limiti di questa prima versione locale.
