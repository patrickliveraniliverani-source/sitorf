# Modulo contatti — `api/contatti.js`

Il modulo di `contatti.html` manda i campi in JSON a `/api/contatti`, una
funzione serverless di Vercel che li ricontrolla e spedisce una mail tramite
l'SMTP di Hostinger (il dominio resinaforlivese.it ha MX e SPF su Hostinger,
quindi le mail partono "in regola" e non finiscono nello spam).

Il resto del sito resta statico: nessun framework, nessun build.

## Variabili d'ambiente da impostare su Vercel

Progetto **sitorf** → Settings → Environment Variables. Spuntare
**Production** (e **Preview** se si vuole provare il modulo anche sulle
anteprime dei branch).

| Variabile   | Obbligatoria | Valore                                                                 |
|-------------|--------------|------------------------------------------------------------------------|
| `SMTP_USER` | sì           | Casella Hostinger che spedisce, es. `sito@resinaforlivese.it`. È anche il mittente della mail. |
| `SMTP_PASS` | sì           | Password di quella casella. Solo qui, mai nel codice o nel repo.       |
| `MAIL_TO`   | no           | Dove arrivano le richieste. Consigliato: `info@resinaforlivese.it`. Più indirizzi separati da virgola. Se manca, arriva a `SMTP_USER`. |
| `SMTP_HOST` | no           | Default `smtp.hostinger.com`.                                          |
| `SMTP_PORT` | no           | Default `465` (SSL). Con `587` si passa a STARTTLS.                    |

**Dopo aver aggiunto o cambiato una variabile serve un nuovo deploy**
(Deployments → ultimo deploy → Redeploy, oppure un push qualsiasi): la
funzione legge le variabili solo all'avvio del deploy.

Se `SMTP_USER` o `SMTP_PASS` mancano, la funzione risponde `503` e il
modulo mostra a chi scrive l'email e il telefono dell'azienda. Nei log di
Vercel compare `configurazione SMTP incompleta` (la password non viene mai
stampata, solo se c'è o no).

### Quale casella usare come mittente

Meglio una casella dedicata (es. `sito@resinaforlivese.it`) creata nel
pannello Hostinger solo per questo: se la password finisse in mani sbagliate
non espone la posta vera dell'azienda, e cambiarla non disturba nessuno. Il
mittente deve essere una casella del dominio su Hostinger, altrimenti SPF e
DMARC bocciano la mail.

## Cosa fa la funzione

- Accetta solo `POST` (`405` sugli altri metodi), con corpo JSON o
  `application/x-www-form-urlencoded`, al massimo 32 KB.
- Campi letti (i `name` di `contatti.html`): `nome`, `azienda`, `email`,
  `telefono`, `tipo_richiesta`, `messaggio`, `consenso_privacy`, `sito_web`.
- Obbligatori: nome, email valida, tipo di richiesta (uno dei valori della
  tendina), messaggio, consenso privacy. Lunghezze massime: nome 100,
  azienda 150, email 254, telefono 40, messaggio 5000.
- **Honeypot**: se `sito_web` (il campo invisibile) arriva compilato,
  risponde `200 { ok: true }` ma non spedisce niente.
- **Anti-abuso**: più di 3 link nel messaggio → rifiutato; più di 5 invii in
  10 minuti dallo stesso IP → `429` (contatore in memoria, per singola
  istanza: è un freno, non un muro).
- La mail arriva con oggetto `Richiesta dal sito · <tipo> · <nome>`, corpo in
  testo e HTML con tutti i campi, e `Reply-To` impostato su chi ha scritto:
  basta premere "Rispondi".

Risposte, sempre JSON:

| Status | Corpo                             | Quando                                   |
|--------|-----------------------------------|------------------------------------------|
| 200    | `{ "ok": true }`                  | inviata (o honeypot)                     |
| 400    | `{ "ok": false, "errore": "…" }`  | campo mancante o non valido, troppi link |
| 405    | idem                              | metodo diverso da POST                   |
| 413 / 415 | idem                           | corpo troppo grande / formato sbagliato  |
| 429    | idem                              | troppi invii dallo stesso IP             |
| 502    | idem                              | l'SMTP ha rifiutato o non risponde       |
| 503    | idem                              | variabili SMTP mancanti                  |

Il modulo mostra i messaggi dei `4xx` così come arrivano; per `5xx` ed errori
di rete mostra un messaggio generico con email e telefono in alternativa.

## Perché `package.json` e `vercel.json` non cambiano il deploy statico

- `package.json` contiene solo la dipendenza `nodemailer` e **nessuno
  script `build`**: il progetto Vercel è impostato su framework "Other", che
  senza script di build non costruisce niente e pubblica la radice del repo
  così com'è, come prima. Vercel esegue solo `npm install` per preparare la
  funzione.
- `vercel.json` dice solo quanto può durare la funzione (20 secondi, per
  dare margine alla connessione SMTP). Non tocca rotte, redirect né
  intestazioni delle pagine.
- `node_modules/` è già in `.gitignore`; `package-lock.json` va committato
  (fissa la versione di nodemailer usata da Vercel).

Attenzione a non aggiungere in futuro uno script `"build"` a `package.json`:
Vercel lo eseguirebbe a ogni deploy.

## Provarla

`npx serve` (il server locale sulla porta 4400) serve solo file statici e
**non esegue** la funzione: in locale il modulo finisce sempre nel messaggio
d'errore. Per provarla davvero:

- su Vercel, dopo aver impostato le variabili, compilando il modulo sul sito;
- in locale con `npx vercel dev` (richiede `vercel link` al progetto e le
  variabili in un file `.env`, già escluso da git).
