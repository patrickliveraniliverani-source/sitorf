/* ==========================================================================
   /api/contatti — invio del modulo di contatti.html via SMTP Hostinger
   ==========================================================================

   Funzione serverless Vercel (runtime Node.js, CommonJS). Riceve la POST del
   modulo, controlla i campi e spedisce una mail a chi in azienda deve
   rispondere. Il resto del sito resta statico: questa è l'unica parte
   "viva".

   VARIABILI D'AMBIENTE — da impostare su Vercel, progetto "sitorf":
   Settings → Environment Variables (ambiente Production, e Preview se si
   vuole provare il modulo anche sulle anteprime). Dopo averle aggiunte o
   cambiate serve un nuovo deploy perché la funzione le veda.

     SMTP_USER  casella Hostinger che spedisce, es. sito@resinaforlivese.it
                (è anche il mittente "From" della mail)
     SMTP_PASS  password di quella casella (mai nel codice, mai nel repo)
     MAIL_TO    dove arrivano le richieste, es. info@resinaforlivese.it
                (più indirizzi separati da virgola). Facoltativa: se manca
                si usa SMTP_USER.

   Facoltative, per casi particolari:
     SMTP_HOST  default smtp.hostinger.com
     SMTP_PORT  default 465 (SSL implicito)

   Se SMTP_USER o SMTP_PASS mancano la funzione risponde 503 e il modulo
   mostra a chi scrive email e telefono da usare in alternativa.
   Istruzioni complete: api/README.md
   ========================================================================== */

'use strict';

const nodemailer = require('nodemailer');

// --- Regole del modulo ------------------------------------------------------

// Stessi value delle <option> di contatti.html, con l'etichetta da mettere
// nella mail. Un valore che non è qui viene rifiutato.
const TIPI_RICHIESTA = {
    preventivo: 'Richiesta preventivo',
    info: 'Informazioni prodotti',
    campionatura: 'Campionatura',
    visita: 'Visita stabilimento',
    collaborazione: 'Proposta di collaborazione',
    altro: 'Altro',
};

const LUNGHEZZE_MASSIME = {
    nome: 100,
    azienda: 150,
    email: 254,
    telefono: 40,
    messaggio: 5000,
};

const MAX_LINK_NEL_MESSAGGIO = 3;       // oltre, è quasi sempre spam
const MAX_BYTE_CORPO = 32 * 1024;       // il modulo ne manda al massimo ~6 KB
const FINESTRA_LIMITE_MS = 10 * 60 * 1000;
const MAX_INVII_PER_FINESTRA = 5;       // per indirizzo IP, per istanza

const RE_EMAIL = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]{2,}$/;
const RE_TELEFONO = /^[0-9+().\/\s-]{5,40}$/;
const RE_LINK = /(https?:\/\/|www\.)/gi;

// --- Risposte ---------------------------------------------------------------

function rispondi(res, status, dati) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(dati));
}

const ok = (res) => rispondi(res, 200, { ok: true });
const ko = (res, status, errore) => rispondi(res, status, { ok: false, errore });

// --- Lettura del corpo ------------------------------------------------------

// Su Vercel req.body è già interpretato (JSON o form-urlencoded) e la
// lettura può lanciare se il JSON è rotto. Fuori da Vercel (o con un
// content-type che Vercel non interpreta) il corpo arriva grezzo: lo leggiamo
// noi dallo stream, con un tetto di dimensione.
async function leggiCorpo(req) {
    const tipo = String(req.headers['content-type'] || '').toLowerCase();

    let corpo;
    try {
        corpo = req.body;
    } catch (_) {
        throw new ErroreRichiesta(400, 'Il contenuto inviato non è leggibile.');
    }

    if (corpo === undefined) corpo = await leggiStream(req);

    if (Buffer.isBuffer(corpo)) corpo = corpo.toString('utf8');

    if (typeof corpo === 'string') {
        if (Buffer.byteLength(corpo) > MAX_BYTE_CORPO) {
            throw new ErroreRichiesta(413, 'Il messaggio è troppo lungo.');
        }
        if (tipo.includes('application/json')) {
            try {
                corpo = JSON.parse(corpo || '{}');
            } catch (_) {
                throw new ErroreRichiesta(400, 'Il contenuto inviato non è leggibile.');
            }
        } else if (tipo.includes('application/x-www-form-urlencoded')) {
            corpo = Object.fromEntries(new URLSearchParams(corpo));
        } else {
            throw new ErroreRichiesta(415, 'Formato della richiesta non supportato.');
        }
    }

    if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
        throw new ErroreRichiesta(400, 'Il contenuto inviato non è leggibile.');
    }
    return corpo;
}

function leggiStream(req) {
    return new Promise((resolve, reject) => {
        const pezzi = [];
        let totale = 0;
        req.on('data', (pezzo) => {
            totale += pezzo.length;
            if (totale > MAX_BYTE_CORPO) {
                reject(new ErroreRichiesta(413, 'Il messaggio è troppo lungo.'));
                req.destroy();
                return;
            }
            pezzi.push(pezzo);
        });
        req.on('end', () => resolve(Buffer.concat(pezzi)));
        req.on('error', reject);
    });
}

class ErroreRichiesta extends Error {
    constructor(status, messaggio) {
        super(messaggio);
        this.status = status;
    }
}

// --- Validazione ------------------------------------------------------------

// Testo su una riga sola: niente a capo né caratteri di controllo (servono
// anche a evitare che qualcuno infili intestazioni nell'oggetto della mail).
function unaRiga(valore) {
    return String(valore == null ? '' : valore)
        .replace(/[\u0000-\u001f\u007f]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function testoLungo(valore) {
    return String(valore == null ? '' : valore)
        .replace(/\r\n?/g, '\n')
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
        .trim();
}

function consensoDato(valore) {
    return valore === true || ['si', 'sì', 'on', 'true', '1', 'yes'].includes(
        String(valore == null ? '' : valore).trim().toLowerCase());
}

// Restituisce { dati } se è tutto a posto, { errore } al primo problema.
function valida(corpo) {
    const dati = {
        nome: unaRiga(corpo.nome),
        azienda: unaRiga(corpo.azienda),
        email: unaRiga(corpo.email).toLowerCase(),
        telefono: unaRiga(corpo.telefono),
        tipo: unaRiga(corpo.tipo_richiesta).toLowerCase(),
        messaggio: testoLungo(corpo.messaggio),
    };

    if (!dati.nome) return { errore: 'Inserisci il tuo nome.' };
    if (!dati.email) return { errore: 'Inserisci la tua email.' };
    if (!RE_EMAIL.test(dati.email)) return { errore: 'Questa email non sembra valida.' };
    if (!dati.tipo) return { errore: 'Scegli il tipo di richiesta.' };
    if (!TIPI_RICHIESTA[dati.tipo]) return { errore: 'Tipo di richiesta non valido.' };
    if (!dati.messaggio) return { errore: 'Scrivi il tuo messaggio.' };
    if (dati.telefono && !RE_TELEFONO.test(dati.telefono)) {
        return { errore: 'Questo numero di telefono non sembra valido.' };
    }

    const nomiCampi = {
        nome: 'Il nome', azienda: 'Il nome dell\'azienda', email: 'L\'email',
        telefono: 'Il telefono', messaggio: 'Il messaggio',
    };
    for (const [campo, max] of Object.entries(LUNGHEZZE_MASSIME)) {
        if (dati[campo].length > max) {
            return { errore: `${nomiCampi[campo]} è troppo lungo (massimo ${max} caratteri).` };
        }
    }

    const link = (dati.messaggio.match(RE_LINK) || []).length;
    if (link > MAX_LINK_NEL_MESSAGGIO) {
        return { errore: `Il messaggio contiene troppi link (massimo ${MAX_LINK_NEL_MESSAGGIO}).` };
    }

    if (!consensoDato(corpo.consenso_privacy)) {
        return { errore: 'Serve il consenso al trattamento dei dati per poterti rispondere.' };
    }

    dati.tipoEtichetta = TIPI_RICHIESTA[dati.tipo];
    return { dati };
}

// --- Limite per IP ----------------------------------------------------------

// Contatore in memoria: vale per la singola istanza della funzione e si
// azzera quando Vercel la ricicla. Non è una difesa perfetta, ma ferma chi
// martella il modulo dallo stesso indirizzo senza bisogno di un database.
const inviiPerIp = new Map();

function troppiInvii(ip) {
    const adesso = Date.now();
    for (const [chiave, tempi] of inviiPerIp) {
        const recenti = tempi.filter((t) => adesso - t < FINESTRA_LIMITE_MS);
        if (recenti.length) inviiPerIp.set(chiave, recenti);
        else inviiPerIp.delete(chiave);
    }
    const tempi = inviiPerIp.get(ip) || [];
    if (tempi.length >= MAX_INVII_PER_FINESTRA) return true;
    tempi.push(adesso);
    inviiPerIp.set(ip, tempi);
    return false;
}

function ipDi(req) {
    const inoltrato = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    return inoltrato || String(req.headers['x-real-ip'] || '') ||
        (req.socket && req.socket.remoteAddress) || 'sconosciuto';
}

// --- Composizione della mail ------------------------------------------------

function escapeHtml(testo) {
    return String(testo)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function componiMail(dati, { da, a, quando }) {
    const oggetto = `Richiesta dal sito · ${dati.tipoEtichetta} · ${dati.nome}`;

    const righe = [
        ['Tipo di richiesta', dati.tipoEtichetta],
        ['Nome', dati.nome],
        ['Azienda', dati.azienda || '—'],
        ['Email', dati.email],
        ['Telefono', dati.telefono || '—'],
        ['Consenso privacy', 'sì'],
        ['Ricevuta il', quando],
    ];

    const text = [
        'Nuova richiesta dal modulo contatti del sito resinaforlivese.it',
        '',
        ...righe.map(([k, v]) => `${k}: ${v}`),
        '',
        'Messaggio:',
        dati.messaggio,
        '',
        '—',
        'Per rispondere basta usare "Rispondi": la risposta va a chi ha scritto.',
    ].join('\n');

    const html = `<!doctype html>
<html lang="it"><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.5">
<p style="margin:0 0 16px">Nuova richiesta dal modulo contatti del sito <strong>resinaforlivese.it</strong></p>
<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;margin-bottom:16px">
${righe.map(([k, v]) => `<tr><td style="color:#666;vertical-align:top;padding-right:16px">${escapeHtml(k)}</td><td><strong>${
        k === 'Email' ? `<a href="mailto:${escapeHtml(v)}">${escapeHtml(v)}</a>` : escapeHtml(v)
    }</strong></td></tr>`).join('\n')}
</table>
<p style="margin:0 0 6px;color:#666">Messaggio</p>
<div style="white-space:pre-wrap;border-left:3px solid #1d4f91;padding:8px 12px;background:#f6f7f9">${escapeHtml(dati.messaggio)}</div>
<p style="margin-top:20px;font-size:12px;color:#888">Per rispondere basta usare “Rispondi”: la risposta va a chi ha scritto.</p>
</body></html>`;

    return {
        from: { name: 'Sito R.F. Resina Forlivese', address: da },
        to: a,
        replyTo: { name: dati.nome, address: dati.email },
        subject: oggetto,
        text,
        html,
    };
}

function dataOraItaliana(data) {
    return new Intl.DateTimeFormat('it-IT', {
        timeZone: 'Europe/Rome',
        dateStyle: 'long',
        timeStyle: 'short',
    }).format(data);
}

// --- Handler ----------------------------------------------------------------

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return ko(res, 405, 'Metodo non consentito.');
    }

    let corpo;
    try {
        corpo = await leggiCorpo(req);
    } catch (err) {
        if (err instanceof ErroreRichiesta) return ko(res, err.status, err.message);
        console.error('[contatti] lettura della richiesta fallita:', err && err.message);
        return ko(res, 400, 'Il contenuto inviato non è leggibile.');
    }

    // Trappola per i bot: il campo nascosto è compilato. Rispondiamo come se
    // fosse andata bene, così il bot non impara niente, ma non spediamo.
    if (unaRiga(corpo.sito_web)) {
        console.info('[contatti] honeypot compilato: richiesta scartata in silenzio.');
        return ok(res);
    }

    const { dati, errore } = valida(corpo);
    if (errore) return ko(res, 400, errore);

    const utente = process.env.SMTP_USER;
    const password = process.env.SMTP_PASS;
    if (!utente || !password) {
        // Mai la password nel log: solo se c'è o no.
        console.error('[contatti] configurazione SMTP incompleta: SMTP_USER %s, SMTP_PASS %s.',
            utente ? 'presente' : 'MANCANTE', password ? 'presente' : 'MANCANTE');
        return ko(res, 503,
            'Il servizio di invio non è configurato. Scrivici a rf@resinaforlivese.it o chiamaci allo 0543 700047.');
    }

    if (troppiInvii(ipDi(req))) {
        return ko(res, 429, 'Hai inviato troppe richieste in poco tempo. Riprova tra qualche minuto.');
    }

    const destinatari = (process.env.MAIL_TO || utente)
        .split(',').map((s) => s.trim()).filter(Boolean);

    const porta = Number(process.env.SMTP_PORT) || 465;
    const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.hostinger.com',
        port: porta,
        secure: porta === 465,          // 465 = SSL dall'inizio; 587 = STARTTLS
        auth: { user: utente, pass: password },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
    });

    const mail = componiMail(dati, {
        da: utente,
        a: destinatari,
        quando: dataOraItaliana(new Date()),
    });

    try {
        const info = await transport.sendMail(mail);
        console.info('[contatti] richiesta inviata (%s), messageId %s.', dati.tipo, info && info.messageId);
        return ok(res);
    } catch (err) {
        // err.message di nodemailer non contiene la password; il codice
        // (EAUTH, ETIMEDOUT, …) basta a capire cosa non va.
        console.error('[contatti] invio SMTP fallito: %s %s', err && err.code, err && err.message);
        return ko(res, 502,
            'Non siamo riusciti a inviare la richiesta. Riprova, oppure scrivici a rf@resinaforlivese.it.');
    }
};
