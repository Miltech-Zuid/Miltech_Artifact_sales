/* Toestand en acties van "Offerte uit Syntess". */
import { useSyncExternalStore } from 'react';
import { api } from '../lib/api';
import { aiFout, sampleJson, type Turn } from '../lib/claude';
import { CONTEXT } from '../lib/constants';
import { abonneer, bewaar, bewaarConfig, bijUpdate, getData } from '../lib/dataStore';
import { getMe } from '../lib/session';
import { toast } from '../lib/toast';
import type { BibliotheekMeta, Kennis, SyntessOfferte } from '../lib/types';
import { downloadBlob, kloon, nid } from '../lib/utils';
import { alleTeksten, controlePunten, gegevens } from './analyse';
import { bouw } from './build';
import { ExportFout, leesBasis, maakDocx } from './docx';
import { bibliotheek, type Bibliotheek, type LibEntry } from './library';
import { NW, bodyVan, kids, nrm, ptekst } from './ooxml';
import { syPipeline, type PipelineActie } from './pipelineLink';
import { ruimVoorbeeldOp } from './preview';
import type { Basis, Opbouw } from './types';

export type SyMenu = 'vragen' | 'artikelen' | 'inleiding' | 'controle';

export interface SyState {
  bib: Bibliotheek | null;
  bibBusy: boolean;
  bibErr: string;
  cur: SyntessOfferte | null;
  buf: ArrayBuffer | null;
  base: Basis | null;
  res: Opbouw | null;
  busy: boolean;
  chatBusy: boolean;
  marks: boolean;
  zoom: number;
  fout: string;
  expBusy: boolean;
  sel: string | null;
  menu: SyMenu;
  versie: number;
}

let SY: SyState = {
  bib: null,
  bibBusy: false,
  bibErr: '',
  cur: null,
  buf: null,
  base: null,
  res: null,
  busy: false,
  chatBusy: false,
  marks: true,
  zoom: 0.72,
  fout: '',
  expBusy: false,
  sel: null,
  menu: 'vragen',
  versie: 0,
};

const luisteraars = new Set<() => void>();

/** Past de toestand aan en tekent opnieuw. */
export function zetSy(p: Partial<SyState>): void {
  SY = { ...SY, ...p, versie: SY.versie + 1 };
  luisteraars.forEach((l) => l());
}

export function getSy(): SyState {
  return SY;
}

export function useSy(): SyState {
  return useSyncExternalStore(
    (l) => {
      luisteraars.add(l);
      return () => luisteraars.delete(l);
    },
    () => SY,
  );
}

export function lib(): LibEntry[] {
  return bibliotheek(SY.bib, getData().kennis);
}

/** Bouwt het voorbeelddocument opnieuw op (met markeringen). */
export function herbouw(): void {
  const res = SY.cur && SY.base ? bouw(SY.base, SY.cur, lib(), SY.bib, true) : null;
  zetSy({ res });
}

function nieuweSy(naam: string, assetId: string): SyntessOfferte {
  const nu = new Date().toISOString();
  return {
    id: nid('sy'),
    naam,
    bestand: naam,
    assetId: assetId || '',
    keuzes: {},
    eigen: {},
    inleiding: '',
    chat: [],
    opties: [],
    gezien: {},
    status: 'concept',
    door: getMe(),
    aangemaakt: nu,
    gewijzigd: nu,
  };
}

let syTimer: ReturnType<typeof setTimeout> | undefined;

/** Markeert de huidige offerte als gewijzigd en bewaart na 0,8 s. */
export function syGewijzigd(): void {
  const c = SY.cur;
  if (!c) return;
  c.gewijzigd = new Date().toISOString();
  clearTimeout(syTimer);
  syTimer = setTimeout(() => void syBewaar(), 800);
  zetSy({});
}

export async function syBewaar(): Promise<void> {
  const c = SY.cur;
  clearTimeout(syTimer);
  if (!c) return;
  const d = kloon(c) as Partial<SyntessOfferte>;
  d.chat = (d.chat || []).slice(-50);
  if (SY.res) {
    const g = gegevens(SY.res.doc, c.bestand);
    d.samenvatting = {
      artikelen: SY.res.arts.length,
      aangevuld: SY.res.rap.ingevoegd.length,
      ref: (g.find((x) => x[1] === 'Ref. Nr.') || [])[2] || '',
      klant: ((g.find((x) => x[1] === 'Klant') || [])[2] || '').split(' · ')[0],
    };
    c.samenvatting = d.samenvatting;
  }
  delete d.id;
  await bewaar('syntess', c.id, d);
}

async function koppel(c: SyntessOfferte, actie: PipelineActie): Promise<string | null> {
  if (!SY.res) return null;
  const id = await syPipeline(c, SY.res.doc, actie);
  if (id) {
    c.leadId = id;
    syGewijzigd();
  }
  return id;
}

export async function syUpload(file: File | undefined, bestaand: boolean): Promise<void> {
  if (!file) return;
  if (!/\.docx$/i.test(file.name)) {
    toast('Kies een .docx-bestand');
    return;
  }
  zetSy({ busy: true, fout: '' });
  try {
    const buf = await file.arrayBuffer();
    ruimVoorbeeldOp();
    const base = await leesBasis(buf, file.name);
    let assetId = '';
    try {
      const r = await api.upload(
        new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
      );
      assetId = r.id;
    } catch {
      toast('Word-bestand alleen in deze weergave (opslaan op de server lukte niet)');
    }
    let cur: SyntessOfferte;
    if (bestaand && SY.cur) {
      cur = SY.cur;
      cur.assetId = assetId || cur.assetId;
      cur.bestand = file.name;
    } else {
      cur = nieuweSy(file.name.replace(/\.docx$/i, ''), assetId);
      cur.bestand = file.name;
    }
    zetSy({ buf, base, cur, menu: bestaand ? SY.menu : 'vragen', sel: null });
    herbouw();
    await syBewaar();
    if (!bestaand) {
      const id = await koppel(cur, 'upload');
      if (id) toast('Offerte staat in de pipeline');
    }
  } catch {
    zetSy({ fout: 'Dit Word-bestand kon niet worden gelezen', cur: bestaand ? SY.cur : null });
  }
  zetSy({ busy: false });
  window.scrollTo({ top: 0 });
}

export async function syOpen(x: SyntessOfferte): Promise<void> {
  const cur = kloon(x);
  cur.keuzes = cur.keuzes || {};
  cur.eigen = cur.eigen || {};
  cur.chat = cur.chat || [];
  cur.opties = cur.opties || [];
  cur.gezien = cur.gezien || {};
  zetSy({ cur, base: null, res: null, buf: null, menu: 'vragen', sel: null, fout: '' });
  if (!x.assetId) return;
  zetSy({ busy: true });
  try {
    const buf = await (await api.asset(x.assetId)).arrayBuffer();
    ruimVoorbeeldOp();
    const base = await leesBasis(buf, x.bestand);
    zetSy({ buf, base });
    herbouw();
  } catch {
    toast('Word-bestand kon niet worden opgehaald');
  }
  zetSy({ busy: false });
}

export async function openSyntessOfferte(id: string): Promise<void> {
  const x = getData().syntess.find((y) => y.id === id);
  if (x) await syOpen(x);
}

export async function sySluit(): Promise<void> {
  await syBewaar();
  ruimVoorbeeldOp();
  zetSy({ cur: null, base: null, res: null, buf: null, sel: null });
}

export async function syKoppel(): Promise<void> {
  if (SY.cur && (await koppel(SY.cur, 'upload'))) toast('Offerte staat in de pipeline');
}

export async function syZetStatus(status: SyntessOfferte['status']): Promise<void> {
  const c = SY.cur;
  if (!c) return;
  c.status = status;
  syGewijzigd();
  if (status === 'verstuurd' && (await koppel(c, 'verstuurd'))) toast('Pipeline bijgewerkt: offerte uit');
}

/* ---------- export naar Word ---------- */

export async function syExport(): Promise<void> {
  const c = SY.cur;
  if (!c || !SY.buf || !SY.base) return;
  zetSy({ expBusy: true });
  try {
    const res = bouw(SY.base, c, lib(), SY.bib, false);
    const { blob, onderdelen } = await maakDocx(SY.buf, SY.base.xml, res);
    const naam =
      String(c.bestand || 'offerte.docx')
        .replace(/\.docx$/i, '')
        .replace(/\s*input document uit calculatie/i, '') + ' (aangevuld).docx';
    downloadBlob(naam, blob);
    toast(`Word bewaard · ${onderdelen}/${onderdelen} originele onderdelen ongewijzigd`);
    if (c.status === 'concept') {
      c.status = 'klaar';
      syGewijzigd();
    }
    await koppel(c, 'export');
  } catch (e) {
    toast(e instanceof ExportFout ? e.message : 'Word maken lukte niet: ' + (e instanceof Error ? e.message : String(e)));
  }
  zetSy({ expBusy: false });
}

/* ---------- Claude-assistent ---------- */

function kennisTekst(): string {
  const K: Kennis = getData().kennis || {};
  const cut = (s: string | undefined, n: number) => String(s || '').slice(0, n);
  return `KENNIS UIT PROJECT "OFFERTE TOOL" (leidend):\nProject: ${cut(K.beschrijving, 600)}\n${K.instructies ? 'Instructies: ' + cut(K.instructies, 2000) + '\n' : ''}\n--- HUISSTIJL ---\n${cut(K.huisstijl, 9000)}\n\n--- WERKWIJZE ---\n${cut(K.werkwijze, 5000)}\n${K.extra ? '\n--- OVERIGE PROJECTDOCUMENTEN ---\n' + cut(K.extra, 6000) : ''}`;
}

function staatVoorClaude() {
  const c = SY.cur!;
  const res = SY.res;
  const L = lib();
  const so = res ? kids(bodyVan(res.doc), NW, 'p').findIndex((p) => nrm(ptekst(p)).startsWith('systeemomschrijving')) : -1;
  const T = res ? alleTeksten(res.doc) : [];
  return {
    bestand: c.bestand,
    begin_offerte: T.slice(0, 40).join(' | ').slice(0, 2500),
    artikelen: res
      ? res.arts.map((a, i) => ({
          nr: i,
          regel: a.regel,
          status: a.s.st,
          bibliotheek: a.s.e ? a.s.e.name : null,
          info: a.s.info,
          eigenTekstInSyntess: a.txt
            ? a.blok
                .map((x) => ptekst(x).trim())
                .filter(Boolean)
                .join(' / ')
                .slice(0, 300)
            : '',
        }))
      : [],
    bibliotheek_artikelen: L.filter((e) => e.kind !== 'media').map((e) => e.name),
    bibliotheek_afbeeldingen: L.filter((e) => e.kind === 'media').map((e) => e.name + ': ' + (e.omschrijving || '')),
    systeemomschrijving_gevonden: so >= 0,
    inleiding_nu: c.inleiding || '',
    controle: controlePunten(res?.doc, c.bestand)
      .map((x) => x.join(' · '))
      .slice(0, 40),
  };
}

const SY_INSTR = `Je helpt een verkoper van Miltech een offerte af te maken die als Word-export uit het calculatieprogramma Syntess komt. Je werkt in een interactief menu naast een voorbeeldweergave.
Harde regels:
- Wat Syntess aanlevert (klant, adres, datum, Ref. Nr., projectleider, prijzen, condities, artikelregels en bestaande teksten) wordt NIET gewijzigd. Fouten daarin meld je alleen.
- Productteksten verzin je nooit. Artikelen vul je alleen aan door een bibliotheekartikel te kiezen (exacte naam uit bibliotheek_artikelen) of "leeg". Past niets, zeg dat dan en vraag of de verkoper zelf tekst wil typen.
- Alleen de inleiding onder Systeemomschrijving schrijf jij, in de opbouw van de huisstijl (intro-zin "In deze offerte treft u een ... aan t.b.v. onderstaande posities:", positietabel, capaciteit, opstelling, besturing, eventueel [[Systeemomschrijving N]] voor een afbeelding). Gebruik alleen gegevens uit de offerte en uit wat de verkoper zegt. Onbekend = **[gegeven]**; keuzes = **optie A / optie B**.
- Inleiding-syntax: elke regel een alinea, lege regel = witregel, tabel als | a | b | regels met kopregel en |---| scheidingsregel, **vet**, *cursief*, [[naam]] afbeelding, ---pagina--- nieuwe pagina.
- Stel per bericht één of twee korte concrete vragen en geef 2 tot 5 antwoordopties. Controleer jezelf op onjuistheden (eenheden, kW/W, tegenstrijdige typenummers, aantallen die niet kloppen met de positietabel).
Antwoord uitsluitend als JSON: {"bericht":"tekst aan de verkoper","opties":["..."],"inleiding":"VOLLEDIGE nieuwe inleiding of null als die niet verandert","keuzes":{"<artikelnr>":"leeg" | "auto" | "lib:<exacte bibliotheeknaam>"} of null,"menu":"vragen"|"artikelen"|"inleiding"|"controle"|null}`;

interface ChatAntwoord {
  bericht?: string;
  opties?: unknown[];
  inleiding?: string | null;
  keuzes?: Record<string, string> | null;
  menu?: string | null;
}

export async function syChat(tekst: string): Promise<void> {
  const c = SY.cur;
  if (!c || !getData().claude || SY.chatBusy) return;
  if (tekst) c.chat.push({ r: 'u', t: tekst });
  c.opties = [];
  zetSy({ chatBusy: true, menu: 'vragen' });
  const turns: Turn[] = [{ role: 'user', content: `${CONTEXT}\n\n${SY_INSTR}\n\n${kennisTekst()}\n\nBegin of ga verder met het gesprek.` }];
  for (const m of c.chat) {
    if (m.r === 'c') turns.push({ role: 'assistant', content: m.t });
    else if (turns[turns.length - 1].role === 'user') turns[turns.length - 1].content += '\n\nVerkoper: ' + m.t;
    else turns.push({ role: 'user', content: 'Verkoper: ' + m.t });
  }
  if (turns[turns.length - 1].role !== 'user') turns.push({ role: 'user', content: 'Ga verder.' });
  turns[turns.length - 1].content += `\n\n[Huidige stand van de offerte: ${JSON.stringify(staatVoorClaude())}]\nAntwoord als JSON volgens het schema.`;
  try {
    const j = await sampleJson<ChatAntwoord>(turns);
    if (SY.cur && SY.cur.id === c.id) {
      const w: string[] = [];
      if (j && typeof j.inleiding === 'string' && j.inleiding.trim() && j.inleiding !== c.inleiding) {
        c.inleiding = j.inleiding.replace(/\r/g, '');
        w.push('Systeemomschrijving bijgewerkt');
      }
      if (j && j.keuzes && typeof j.keuzes === 'object') {
        const L = lib();
        let n = 0;
        for (const [k, v] of Object.entries(j.keuzes)) {
          const i = +k;
          if (!SY.res || !SY.res.arts[i]) continue;
          const val = String(v);
          if (val === 'leeg' || val === 'auto' || (val.startsWith('lib:') && L.some((e) => e.name === val.slice(4)))) {
            c.keuzes[i] = val;
            n++;
          }
        }
        if (n) w.push(n + ' artikelkeuze' + (n === 1 ? '' : 's') + ' aangepast');
      }
      c.chat.push({ r: 'c', t: String(j?.bericht || 'Wat wil je nog aanvullen?'), wijz: w.join(' · ') });
      c.opties = Array.isArray(j?.opties) ? j.opties.map(String).slice(0, 5) : [];
    }
  } catch (e) {
    c.chat.push({ r: 'c', t: aiFout(e) });
  }
  zetSy({ chatBusy: false });
  herbouw();
  syGewijzigd();
}

/* ---------- kennis en bibliotheek ---------- */

let geladenBib = '';

export async function laadBibliotheek(m: BibliotheekMeta | null): Promise<void> {
  if (!m || !m.assetId || SY.bibBusy || geladenBib === m.assetId) return;
  zetSy({ bibBusy: true, bibErr: '' });
  try {
    let kern: Bibliotheek;
    if (m.kernId) {
      const [k, ...shards] = await Promise.all([
        api.assetJson<Bibliotheek>(m.kernId),
        ...(m.mediaIds || []).map((id) => api.assetJson<Record<string, string>>(id)),
      ]);
      const media: Record<string, string> = Object.assign({}, ...shards);
      const fix = (o: Record<string, unknown>, key: string) => {
        const v = o[key];
        if (typeof v === 'string' && v.startsWith('@m:')) o[key] = media[v.slice(3)] || '';
      };
      for (const e of k.entries)
        for (const b of e.blocks) {
          if (b.type === 'img') fix(b as unknown as Record<string, unknown>, 'b64');
          if (b.type === 'media' || b.type === 'element')
            for (const p of Object.values(b.parts || {})) fix(p as unknown as Record<string, unknown>, 'b64');
        }
      kern = k;
    } else kern = await api.assetJson<Bibliotheek>(m.assetId);
    if (!Array.isArray(kern.entries)) throw new Error('geen entries');
    kern.__id = m.assetId;
    geladenBib = m.assetId;
    zetSy({ bib: kern });
  } catch {
    zetSy({ bibErr: 'Bibliotheek niet geladen' });
  }
  zetSy({ bibBusy: false });
  if (SY.cur) herbouw();
}

/** Importeert kennis (JSON) of standaardteksten (Markdown) uit het project Offerte Tool. */
export async function importeerKennis(file: File | undefined): Promise<void> {
  if (!file) return;
  try {
    const tekst = await file.text();
    const nu = new Date().toISOString();
    let k: Kennis;
    if (/\.md$/i.test(file.name)) {
      k = { ...(getData().kennis || {}), standaardteksten: tekst, gesynchroniseerd: nu };
    } else {
      const j = JSON.parse(tekst) as Kennis;
      if (!j || typeof j !== 'object') throw new Error('ongeldig');
      const toegestaan: (keyof Kennis)[] = ['beschrijving', 'instructies', 'huisstijl', 'werkwijze', 'extra', 'standaardteksten'];
      k = { gesynchroniseerd: nu };
      for (const key of toegestaan) if (typeof j[key] === 'string') k[key] = j[key];
    }
    if (await bewaarConfig('kennis', k)) {
      toast('Kennis geïmporteerd');
      if (SY.cur) herbouw();
    }
  } catch {
    toast('Dit kennisbestand kon niet worden gelezen');
  }
}

/** Importeert de artikelbibliotheek (JSON met entries) en zet hem in de gedeelde opslag. */
export async function importeerBibliotheek(file: File | undefined): Promise<void> {
  if (!file) return;
  try {
    const tekst = await file.text();
    const j = JSON.parse(tekst) as Bibliotheek;
    if (!j || !Array.isArray(j.entries)) throw new Error('geen entries');
    const r = await api.upload(new Blob([tekst], { type: 'application/json' }));
    if (await bewaarConfig('bibliotheek', { assetId: r.id, naam: file.name, geimporteerd: new Date().toISOString() })) {
      toast(`Bibliotheek geïmporteerd · ${j.entries.length} items`);
    }
  } catch {
    toast('Dit bibliotheekbestand kon niet worden gelezen (verwacht JSON met "entries")');
  }
}

/* ---------- koppeling met de gedeelde gegevens ---------- */

function sySnapshot() {
  if (!SY.cur) return;
  const r = getData().syntess.find((x) => x.id === SY.cur!.id);
  const ae = document.activeElement;
  const bezigMetTypen = !!ae && !!ae.closest('#sy-pages,#sy-inl,textarea');
  if (r && String(r.gewijzigd) > String(SY.cur.gewijzigd) && !SY.chatBusy && !bezigMetTypen) {
    const cur = kloon(r);
    cur.keuzes = cur.keuzes || {};
    cur.eigen = cur.eigen || {};
    cur.chat = cur.chat || [];
    cur.opties = cur.opties || [];
    cur.gezien = cur.gezien || {};
    zetSy({ cur });
    herbouw();
  }
}

let gestart = false;

export function startSyntessKoppeling(): void {
  if (gestart) return;
  gestart = true;
  let bibMeta = getData().bibliotheek;
  let kennis = getData().kennis;
  abonneer(() => {
    const d = getData();
    if (d.bibliotheek !== bibMeta) {
      bibMeta = d.bibliotheek;
      void laadBibliotheek(bibMeta);
    }
    if (d.kennis !== kennis) {
      kennis = d.kennis;
      if (SY.cur) herbouw();
    }
  });
  bijUpdate('syntess', sySnapshot);
}
