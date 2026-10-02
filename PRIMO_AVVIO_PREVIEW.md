# Preview Minecraft in prima persona — avvio locale

Questa versione aggiunge **«Il primo sguardo»** sotto la mappa. Il server ufficiale
Minecraft genera il seed selezionato; Prismarine Viewer mostra i chunk ricevuti,
con una camera all’altezza del giocatore. Non usa il rilievo approssimato di Cubiomes
per costruire la scena.

## Requisiti

- Node.js **22.13 o successivo** (`node -v`).
- **Java 21** o successivo (`java -version`). Java deve essere raggiungibile dal terminale.
- Una connessione Internet per installazione e primo download del server.
- Indicativamente almeno 4 GB di RAM liberi: il processo Minecraft può usarne 2 GB,
  ai quali si aggiungono il servizio Node e il browser.
- Un browser desktop con WebGL e accelerazione grafica attivi.

Questa prima integrazione è **locale e per un solo utente**. Non è stata pubblicata
sul sito online e non va esposta direttamente a Internet.

## 1. Estrai lo ZIP e installa

Apri un terminale nella cartella `Seed-Studio-Private-main`, quella che contiene
`package.json`. Su Mac puoi scrivere `cd ` e trascinare la cartella nel Terminale.
Poi esegui:

```bash
npm install
npm run preview:install
```

Il visualizzatore contiene asset e texture di Minecraft: l’installazione è
più grande rispetto a quella del solo sito. Non servono pnpm o corepack.

## 2. Leggi e accetta la licenza Minecraft

```bash
npm run preview:eula
```

Il comando mostra il collegamento a https://www.minecraft.net/eula e chiede di
scrivere **ACCETTO**. Eseguilo solo se hai letto e accetti la licenza. Nessuna
accettazione è inclusa nello ZIP e il servizio non avvia Minecraft senza questo passaggio.

## 3. Avvia il servizio — primo terminale

```bash
npm run preview:start
```

Lascia questo terminale aperto. Il servizio ascolta soltanto su
`http://127.0.0.1:4318`. Il server di gioco viene avviato solo quando chiedi una preview.

## 4. Avvia il sito — secondo terminale

Dalla stessa cartella principale:

```bash
npm run dev
```

Apri **http://localhost:5173**. Per questa integrazione usa quella porta, senza
HTTPS o un dominio remoto.

## 5. Entra nella preview

1. Scegli **Java 1.21.1** oppure **Java 1.21.4**.
2. Inserisci il seed e premi la lente per caricarlo. Oppure seleziona un risultato
   della ricerca. Anche l’opzione **biomi grandi** viene rispettata.
3. Nel pannello **Il primo sguardo**, premi **Anteprima nel mondo**.
4. Al primo utilizzo il servizio scarica il server dal catalogo ufficiale Mojang
   e controlla dimensione e SHA-1 pubblicati. Quindi genera il mondo e riceve i chunk.
5. Trascina nella scena, anche verticalmente, per guardarti intorno. Le **frecce**
   funzionano quando la scena ha il focus. Puoi usare **Schermo intero** o aprire
   la preview in una scheda.
6. **Chiudi mondo** arresta Minecraft e rimuove il mondo temporaneo. Cambiare seed,
   versione o biomi grandi chiude automaticamente la preview precedente.

È una vista panoramica dallo spawn: non sono previsti movimento libero, inventario,
posa/distruzione di blocchi o comandi di gioco. Lo spawn visualizzato è quello
assegnato al primo giocatore dal server; il punto preciso può differire di pochi
blocchi in una nuova partita per la normale dispersione dello spawn. La preview
mostra sempre l’Overworld, anche se sulla mappa stai esplorando Nether o End.

## Fedeltà e limiti

- I blocchi vengono dal **server vanilla della versione selezionata**, non da
  una ricostruzione procedurale inventata.
- Il rendering è di Prismarine Viewer: luce, acqua, trasparenze e alcuni modelli
  possono differire dal client ufficiale. Non include shader, mod o datapack.
- L’ora viene impostata al giorno e il meteo viene mantenuto sereno per leggere
  il paesaggio; il server è in difficoltà pacifica e la generazione delle strutture
  rimane attiva. La preview è pensata per il paesaggio, non per simulare entità o gameplay.
- La zona caricata è di pochi chunk attorno allo spawn. Strutture lontane non saranno
  visibili solo perché presenti nella mappa generale.
- Versioni diverse da **1.21.1 e 1.21.4** non vengono convertite automaticamente:
  il sito chiede di selezionare una versione supportata.
- Una sola preview alla volta. Una sessione senza richieste scade dopo circa
  2 minuti; ogni sessione termina comunque dopo 20 minuti.
- I file del server rimangono in `preview-service/.data/jars` per i riutilizzi.
  I mondi temporanei sono in `.data/worlds` e vengono eliminati alla chiusura normale.
  Dopo un arresto forzato del computer possono rimanere: puoi rimuovere quella
  cartella quando il servizio è completamente fermo.

## Problemi frequenti

**«Servizio locale non raggiungibile»** — controlla che il primo terminale sia
ancora aperto su `npm run preview:start` e che il sito sia su localhost:5173.

**«Java 21 richiesto»** — esegui `java -version`. Se il computer ha più Java,
puoi avviare il servizio con `JAVA_BIN` impostato al percorso dell’eseguibile Java 21.

**«È già aperta una preview»** — chiudi il mondo nell’altra scheda; se l’altra
scheda è stata chiusa bruscamente, attendi la scadenza o riavvia il servizio.

**Download fallito** — verifica Internet/proxy e riprova. Un download incompleto
non viene trattato come un server valido.

**Scena vuota o WebGL non disponibile** — attendi il caricamento iniziale degli
asset. Verifica l’accelerazione grafica del browser e prova una nuova scheda.

Per chiudere tutto, premi **Chiudi mondo**, poi **Ctrl+C** nei due terminali.

## Verifiche tecniche

```bash
npm run test:engine
npm run test:preview
```

I test del servizio verificano seed a 64 bit, versioni, biomi grandi, requisito
EULA, annullamento durante l’avvio, errori Java, durata delle sessioni e restrizioni
HTTP. Non sostituiscono il confronto visivo con Minecraft: la prova completa
con generazione vanilla richiede Java 21 e l’accettazione della licenza sul computer.

## Pubblicazione futura

Il servizio locale non è un backend pubblico pronto alla produzione. Per offrire
questa funzione ai visitatori servono hosting Java, isolamento delle generazioni,
limiti e coda per utenti, HTTPS, un indirizzo del backend configurabile e cache dei
mondi. Lo ZIP prepara il flusso locale; non configura né acquista hosting.
