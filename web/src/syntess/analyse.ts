/* Analyse en controles van een aangeleverde Syntess-offerte. */
import { vandaag } from '../lib/utils';
import type { SyntessOfferte } from '../lib/types';
import { heeftMedia, zoek, type LibEntry } from './library';
import { ART_RE, NW, alle, blokNa, bms, bodyVan, hasMedia, kids, nrm, ptekst, vetteRegel, type Stijlen } from './ooxml';

export type StatusCode =
  | 'ok'
  | 'alleen_afbeelding'
  | 'eigen'
  | 'heeft_al_tekst'
  | 'heeft_al_inhoud'
  | 'leeg'
  | 'al_ingevoegd'
  | 'onbekend'
  | 'twijfel';

export interface ArtStatus {
  st: StatusCode;
  e: LibEntry | null;
  info: string;
}

export interface Artikel {
  p: Element;
  regel: string;
  aantal: string;
  product: string;
  blok: Element[];
  txt: boolean;
  med: boolean;
  klaar: boolean;
  s: ArtStatus;
}

export const ST_INFO: Record<StatusCode, [string, string]> = {
  ok: ['Tekst + afbeelding', 'ok'],
  alleen_afbeelding: ['Alleen afbeelding', 'ok'],
  eigen: ['Eigen tekst', 'ai'],
  heeft_al_tekst: ['Eigen tekst blijft', ''],
  heeft_al_inhoud: ['Compleet', ''],
  leeg: ['Niets toevoegen', ''],
  al_ingevoegd: ['Al aangevuld', ''],
  onbekend: ['Niet in bibliotheek', 'today'],
  twijfel: ['Twijfel', 'late'],
};

/** Alle dikgedrukte artikelregels ("2 x …") met het blok dat erbij hoort. */
export function analyse(doc: Document, st: Stijlen): Artikel[] {
  const body = bodyVan(doc);
  const arts: Artikel[] = [];
  for (const p of kids(body, NW, 'p')) {
    const t = ptekst(p).trim();
    const m = t.match(ART_RE);
    if (!m || !vetteRegel(p, st)) continue;
    const blk = blokNa(p, st);
    arts.push({
      p,
      regel: t,
      aantal: m[1],
      product: m[2],
      blok: blk,
      txt: blk.some((x) => !!ptekst(x).trim()),
      med: blk.some(hasMedia),
      klaar: blk.some((x) => bms(x).some((b) => b.startsWith('OT_'))),
      s: { st: 'onbekend', e: null, info: '' },
    });
  }
  return arts;
}

export function statusVan(a: Artikel, i: number, lib: LibEntry[], cur: SyntessOfferte): ArtStatus {
  const k = (cur.keuzes || {})[i] || 'auto';
  if (a.klaar) return { st: 'al_ingevoegd', e: null, info: 'al eerder door de tool ingevoegd' };
  if (k === 'leeg') return { st: 'leeg', e: null, info: 'bewust niets toevoegen' };
  if (k === 'eigen') {
    const t = ((cur.eigen || {})[i] || '').trim();
    return t
      ? {
          st: a.txt ? 'heeft_al_tekst' : 'eigen',
          e: null,
          info: a.txt ? 'er staat al tekst; eigen tekst niet nodig' : 'jouw eigen tekst',
        }
      : { st: 'onbekend', e: null, info: 'eigen tekst nog leeg' };
  }
  let r: { e: LibEntry | null; st: string; info: string } = k.startsWith('lib:')
    ? { e: lib.find((e) => e.name === k.slice(4)) || null, st: 'ok', info: 'handmatig gekozen' }
    : zoek(a.product, lib);
  if (k.startsWith('lib:') && !r.e) r = { e: null, st: 'onbekend', info: 'gekozen artikel bestaat niet meer' };
  if (!r.e) return { st: r.st as StatusCode, e: null, info: r.info };
  if (a.med) return { st: 'heeft_al_inhoud', e: r.e, info: 'tekst en afbeelding staan er al' };
  if (a.txt)
    return heeftMedia(r.e)
      ? { st: 'alleen_afbeelding', e: r.e, info: r.info || 'eigen tekst blijft, afbeelding erbij' }
      : { st: 'heeft_al_tekst', e: r.e, info: 'eigen tekst, bibliotheek heeft geen afbeelding' };
  return { st: 'ok', e: r.e, info: r.info };
}

/* ---------- controles (alleen melden) ---------- */

const ABBR = new Set(['excl', 'incl', 'fabr', 'ca', 'nr', 'bijv', 'min', 'max', 'tel', 'mob', 'art', 'st', 'stk', 'evt', 'o', 'a']);
const TYPO: Record<string, string> = { verhoofd: 'verhoogd', verlichtte: 'verlichte', úit: 'uit' };

export function lint(t: string): string[] {
  const h: string[] = [];
  if (/\S {2,}\S/.test(t)) h.push('dubbele spatie');
  const m = t.match(/\b([A-Za-zÀ-ÿ]{2,}) \1\b/i);
  if (m) h.push(`woord dubbel: '${m[0]}'`);
  if (/\w [,.;!?](\s|$)/.test(t)) h.push('spatie vóór leesteken');
  for (const x of t.matchAll(/(?:^|[^.\w])([A-Za-zÀ-ÿ]{2,})\. ([a-zà-ÿ])/g))
    if (!ABBR.has(x[1].toLowerCase())) h.push(`kleine letter na punt: '${x[1]}. ${x[2]}'`);
  if (/\d+(?:,\d+)?\s?W\b/.test(t) && !/\d\s?kW/.test(t)) h.push('vermogen in W – bedoeld kW?');
  for (const k in TYPO) if (t.includes(k)) h.push(`'${k}' → '${TYPO[k]}'`);
  return h;
}

export function alleTeksten(doc: Document): string[] {
  const body = bodyVan(doc);
  const out = kids(body, NW, 'p').map((p) => ptekst(p).trim());
  for (const t of alle(body, NW, 'tbl')) for (const p of alle(t, NW, 'p')) out.push(ptekst(p).trim());
  for (const x of alle(doc, NW, 'txbxContent')) for (const p of alle(x, NW, 'p')) out.push(ptekst(p).trim());
  return out.filter(Boolean);
}

export type Controle = [string, string, string];

/** Klant, aanhef, datum, referentie, projectleider, adres en huisstijl-onderdelen. */
export function gegevens(doc: Document, naam: string | undefined): Controle[] {
  const T = alleTeksten(doc);
  const out: Controle[] = [];
  const j = T.join(' ');
  const ti = T.findIndex((t) => /^t\.?a\.?v\.?\s/i.test(t));
  const tav = ti >= 0 ? T[ti] : null;
  const klant = ti > 0 ? T[ti - 1] : null;
  const aan = T.find((t) => /^geachte\s/i.test(t));
  out.push(['INFO', 'Klant', `${klant || '?'} · ${tav || 'T.a.v. niet gevonden'}`]);
  if (tav && aan) {
    const m1 = tav.match(/(heer|mevrouw|mevr\.?|dhr\.?)\s+(?:[A-Z]\.\s*)*([\w'\- ]+?)\s*$/i);
    const m2 = aan.match(/geachte\s+(heer|mevrouw)\s+([\w'\- ]+?)\s*,?\s*$/i);
    if (m1 && m2) {
      const g1 = /^(heer|dhr)/i.test(m1[1]) ? 'heer' : 'mevrouw';
      const ok = nrm(m1[2]) === nrm(m2[2]) && g1 === m2[1].toLowerCase();
      out.push([ok ? 'OK' : 'LET OP', 'Aanhef', `'${aan}' ${ok ? 'past bij' : 'past NIET bij'} '${tav}'`]);
    } else out.push(['INFO', 'Aanhef', aan]);
  } else if (!aan) out.push(['LET OP', 'Aanhef', 'geen “Geachte …” gevonden']);

  const d = j.match(/[A-Z][a-zë-]+,\s*(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (d) {
    const dt = new Date(+d[3], +d[2] - 1, +d[1]);
    const diff = Math.round((new Date(vandaag() + 'T00:00:00').getTime() - dt.getTime()) / 864e5);
    out.push([
      diff >= -14 && diff <= 30 ? 'OK' : 'LET OP',
      'Datum',
      `${d[0]} (${diff >= 0 ? diff + ' dagen geleden' : 'over ' + -diff + ' dagen'})`,
    ]);
  } else out.push(['LET OP', 'Datum', '“Plaats, dd-mm-jjjj” niet gevonden']);

  const r = j.match(/TD(\d{6}-\d+[A-Z]?)/);
  if (r) {
    const fn = String(naam || '').match(/(\d{6}-\d+[A-Z]?)/);
    const af = !!fn && fn[1] !== r[1];
    out.push([af ? 'LET OP' : 'OK', 'Ref. Nr.', `TD${r[1]}${af ? ' – bestandsnaam heeft ' + fn![1] : ''}`]);
  }

  const g = T.findIndex((t) => /^met vriendelijke groet/i.test(t));
  if (g >= 0) {
    const sig = T.slice(g + 1, g + 7);
    const mail = (sig.find((t) => t.includes('@')) || '').match(/[\w.-]+@[\w.-]+/);
    const mob = sig.find((t) => /^(mob|tel)/i.test(t));
    const nm = sig.find((t) => !t.includes('@') && !/^(mob|tel|miltech)/i.test(t));
    let ok = !!(nm && mail && mob);
    let x = '';
    if (nm && mail) {
      const last = nrm(nm).split(' ').pop();
      if (last && !nrm(mail[0].split('@')[0]).replace(/ /g, '').includes(last)) {
        ok = false;
        x = ' (e-mail past niet bij naam)';
      }
      if (!/@miltech\.nl$/i.test(mail[0])) ok = false;
    }
    out.push([ok ? 'OK' : 'LET OP', 'Projectleider', `${nm || '?'}${x} · ${mail ? mail[0] : 'geen e-mail'} · ${mob || 'geen mobiel'}`]);
  } else out.push(['LET OP', 'Projectleider', 'ondertekening niet gevonden']);

  const adr = ti >= 0 ? T[ti + 1] : null;
  const lev = T.find((t) => nrm(t).startsWith('afleveradres'));
  if (adr && lev) {
    const w = nrm(adr).split(' ').slice(0, 2);
    const ok = w.every((x) => nrm(lev).includes(x));
    out.push([ok ? 'OK' : 'LET OP', 'Afleveradres', `${ok ? 'gelijk aan' : 'wijkt af van'} klantadres (${adr})`]);
  }

  const lm = T.findIndex((t) => /levering en montage van;\s*$/.test(t));
  if (lm >= 0 && T[lm + 1]) {
    const n = T.filter((t) => nrm(t) === nrm(T[lm + 1])).length;
    out.push([n >= 2 ? 'OK' : 'LET OP', 'Projecttitel', `'${T[lm + 1]}' ${n >= 2 ? 'staat ook op voorblad' : 'niet gelijk aan voorblad'}`]);
  }

  const HS: [string, boolean][] = [
    ['Kop OFFERTE', T.some((t) => t === 'OFFERTE')],
    ['Kop Systeemomschrijving', T.some((t) => nrm(t).startsWith('systeemomschrijving'))],
    ['Leveringsomvang-kop', T.some((t) => nrm(t).includes('leveringsomvang omschrijvingen prijzen en condities'))],
    ['Totaalprijs', T.some((t) => nrm(t).includes('totaalprijs voor het leveren'))],
    ['Bedrag € … excl. BTW', /€\s?\d{1,3}(\.\d{3})*,\d{2}\s+excl\.\s?BTW/.test(j.replace(/ /g, ' '))],
    ['Niet tot onze levering behoren', T.some((t) => nrm(t).includes('niet tot onze levering behoren'))],
    ['Condities', T.some((t) => nrm(t) === 'condities')],
    ['ALIB 2024', T.some((t) => nrm(t).includes('alib 2024'))],
  ];
  for (const [n, ok] of HS) if (!ok) out.push(['LET OP', 'Huisstijl', `ontbreekt: ${n}`]);
  return out;
}

export function controlePunten(doc: Document | null | undefined, bestand: string | undefined): Controle[] {
  if (!doc) return [];
  const g = gegevens(doc, bestand);
  const L: Controle[] = [];
  for (const n of kids(bodyVan(doc), NW, 'p')) {
    const t = ptekst(n);
    for (const h of lint(t)) L.push(['TEKST', h, t.trim().slice(0, 80)]);
  }
  return [...g, ...L.slice(0, 40)];
}
