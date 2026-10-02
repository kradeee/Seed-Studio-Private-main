# Stato della verifica — preview in prima persona

## Verificato

- Avvio del sito e risposta HTTP 200: titolo e pannello «Il primo sguardo» presenti nell’HTML.
- 14 test del motore Cubiomes esistente: superati.
- 9 test del servizio preview: superati.
- TypeScript del progetto: nessun errore.
- ESLint del nuovo componente MinecraftPreview: nessun errore.
- Flusso HTTP/Socket.IO: versione, chunk e posizione in prima persona ricevuti;
  orientamento della camera aggiornato; chiusura e riapertura senza perdita
  del server HTTP. Questo test usa un chunk sintetico, non un mondo Minecraft.
- Nessun avvio Minecraft senza accettazione esplicita della EULA.

## Ancora da collaudare sul computer

- Generazione completa con il server ufficiale Java 21 e un seed scelto.
- Confronto del paesaggio con il client Minecraft della stessa versione.
- Resa WebGL, texture e comandi nell’interfaccia desktop e mobile.

La prova visiva automatizzata non è stata completata: Chromium è terminato con
SIGSEGV nell’ambiente di esecuzione. La prova del server vanilla non è stata
eseguita: nell’ambiente era disponibile Java 17 e la EULA non è stata accettata
per conto dell’utente. Nessuna immagine di test viene presentata come un mondo
reale. Il codice e la guida sono pronti per il collaudo locale, ma non si dichiara
una verifica end-to-end completa né un deployment pubblico.
