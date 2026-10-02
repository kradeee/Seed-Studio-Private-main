# Verifica nel gioco

Seed Studio usa Cubiomes, che riproduce la generazione di Minecraft Java, ma nessuno lo ha ancora confrontato con il gioco vero. Questa lista serve a farlo in circa mezz’ora.

## Come fare

1. Crea un mondo **Java**, nella versione indicata (i dati qui sotto sono per la 26.3), **mondo predefinito**, trucchi attivi, senza mod né datapack. Il seed si inserisce in *Crea un nuovo mondo → Mondo*.
2. Per ogni riga usa il comando `/locate` indicato: Minecraft risponde con le coordinate. Confrontale con la colonna *Dove*. Una differenza fino a ~16 blocchi è normale (il gioco indica il chunk, non il centro esatto).
3. Per i dettagli (occhi nel portale, generatori di blaze, tipo di bastione) serve teletrasportarsi: `/tp @s X ~ Z`, poi guardarsi intorno. Nel Nether: `/execute in the_nether run tp @s X 70 Z`.
4. Segna ✓ o ✗ nell’ultima colonna. Se qualcosa non torna, annota versione, seed e cosa hai visto al suo posto.

`/locate` non sempre sceglie la stessa struttura che sceglie il sito, se due sono a distanza simile: in quel caso fai `/tp` alle coordinate della tabella e controlla che la struttura ci sia. `/locate` cerca intorno a **dove ti trovi**: esegui i comandi dell’Overworld stando allo spawn, quelli del Nether stando a 0, 0 nel Nether.

Stessi valori, verificabili anche sul sito: apri il seed, versione giusta, e clicca la struttura (o l’elenco *Strutture più vicine*).

## Risultati del 29 settembre 2026 · Java 26.3 vanilla · seed 12345

Tutto verificato nel gioco, primo seed della tabella sotto:

| Cosa | Sito | Gioco | Esito |
|---|---|---|---|
| Spawn | 96, −32 | 93, −24 | ✓ (lo spawn ha una piccola parte casuale) |
| Villaggio | −144, −832 | −144, −832 | ✓ |
| Città antica | 176, −176 | 176, −176 | ✓ |
| Roccaforte | 1764, 372 | 1760, 368 | ✓, e **1 occhio su 12** nel portale, come previsto |
| Camere della prova | 0, 224 | 0, 224 | ✓ (confermato con `/locate` da lì vicino) |
| Portale in rovina | 16, 0 | 16, 0 | ✓ (con `/locate structure #ruined_portal`) |
| Fortezza del Nether | 96, −512 | 96, −512 | ✓ |
| Bastione | −272, −128 | presente anche 176, −256 | ✓ (entrambi sul sito) |

**Da sapere:** `/locate` non dà sempre la struttura più vicina. Cerca ad anelli di regioni intorno al giocatore e si ferma alla prima che trova. Per questo a volte indica una struttura più lontana di quella mostrata dal sito: le due posizioni sono giuste entrambe. Per verificare una struttura, teletrasportati vicino e ripeti `/locate` da lì. Per i portali in rovina usa `#ruined_portal`, che copre tutte le varianti.


### Seed 12345 · Java 26.3 · mondo predefinito

| Cosa | Dove (X, Z) | Comando | Cosa verificare | OK? |
|---|---|---|---|---|
| Spawn | 96, -32 | — | Si nasce qui vicino | |
| Villaggio | -144, -832 | `/locate structure #village` | Stile: pianura | |
| Portale in rovina | 16, 0 | `/locate structure #ruined_portal` | La struttura c’è | |
| Città antica | 176, -176 | `/locate structure ancient_city` | La struttura c’è | |
| Camere della prova | 0, 224 | `/locate structure trial_chambers` | La struttura c’è | |
| Monumento oceanico | 608, -1840 | `/locate structure monument` | La struttura c’è | |
| Accampamento abbandonato | 624, -448 | `/locate structure ` + Tab (nome esatto da verificare) | La struttura c’è | |
| Roccaforte | 1764, 372 | `/locate structure stronghold` | 1 occhio già nel portale (stanza a 1826, 372) | |
| Fortezza del Nether (Nether) | 96, -512 | `/execute in the_nether run locate structure fortress` | 2 generatori di blaze | |
| Bastione (Nether) | -272, -128 | `/execute in the_nether run locate structure bastion_remnant` | Unità abitative | |

### Seed -4172144997902289642 · Java 26.3 · mondo predefinito

| Cosa | Dove (X, Z) | Comando | Cosa verificare | OK? |
|---|---|---|---|---|
| Spawn | -448, -432 | — | Si nasce qui vicino | |
| Villaggio | -512, -368 | `/locate structure #village` | Stile: savana | |
| Portale in rovina | -272, -320 | `/locate structure #ruined_portal` | La struttura c’è | |
| Città antica | -2080, -1808 | `/locate structure ancient_city` | La struttura c’è | |
| Camere della prova | -304, -512 | `/locate structure trial_chambers` | La struttura c’è | |
| Monumento oceanico | -224, -288 | `/locate structure monument` | La struttura c’è | |
| Accampamento abbandonato | -368, -1376 | `/locate structure ` + Tab (nome esatto da verificare) | La struttura c’è | |
| Roccaforte | -1260, -1852 | `/locate structure stronghold` | nessun occhio già nel portale (stanza a -1266, -1894) | |
| Fortezza del Nether (Nether) | -400, -80 | `/execute in the_nether run locate structure fortress` | 2 generatori di blaze, 2 stanze di verruche | |
| Bastione (Nether) | 224, 0 | `/execute in the_nether run locate structure bastion_remnant` | Ponte | |
