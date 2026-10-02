/* Artikelbibliotheek: standaardteksten en afbeeldingen uit het project "Offerte Tool". */
import type { Kennis } from '../lib/types';
import { codeTok, nrm } from './ooxml';

/** [tekst, vet, cursief] */
export type Run = [string, boolean, boolean];

export interface RelPart {
  reltype: string;
  ctype: string;
  ext: string;
  b64: string;
}

export interface BlockP {
  type: 'p';
  runs: Run[];
  list?: boolean;
  tabs?: [string, string][];
  ind?: number;
}
export interface BlockImg {
  type: 'img';
  ext: string;
  b64: string;
  cx?: number;
  cy?: number;
}
export interface BlockMedia {
  type: 'media';
  runs_xml: string[];
  parts: Record<string, RelPart>;
}
export interface BlockElement {
  type: 'element';
  xml: string;
  parts: Record<string, RelPart>;
  tekst?: string;
}
export type Block = BlockP | BlockImg | BlockMedia | BlockElement;

export interface LibEntry {
  name: string;
  aliases: string[];
  kind: string;
  exact?: boolean;
  bron?: string;
  omschrijving?: string;
  blocks: Block[];
}

export interface TabelSjabloon {
  tblPr: string;
  tblGrid: string;
  hdr_shd?: string;
  hdr_color?: string;
}

export interface Bibliotheek {
  entries: LibEntry[];
  tabel_sjabloon?: TabelSjabloon;
  __id?: string;
}

/** Standaardteksten.md: "## Artikelnaam", "Zoekwoorden: a, b", daarna de tekst. */
export function mdEntries(md: string | undefined): LibEntry[] {
  const out: LibEntry[] = [];
  let cur: LibEntry | null = null;
  for (const raw of String(md || '').split(/\r?\n/)) {
    const l = raw.replace(/\s+$/, '');
    const h = l.match(/^##\s+(.+)/);
    if (h) {
      cur = { name: h[1].trim(), aliases: [], kind: 'artikel', exact: false, bron: 'Standaardteksten (project)', blocks: [] };
      out.push(cur);
      continue;
    }
    if (!cur || /^#\s/.test(l)) continue;
    const z = l.match(/^\s*zoekwoorden\s*:\s*(.*)$/i);
    if (z) {
      cur.aliases.push(
        ...z[1]
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
      );
      continue;
    }
    const lst = /^\s*[-*]\s+/.test(l);
    const t = l.replace(/^\s*[-*]\s+/, '');
    const runs: Run[] = t
      ? t
          .split(/(\*\*.+?\*\*)/)
          .filter(Boolean)
          .map((x): Run => (/^\*\*.+\*\*$/.test(x) ? [x.slice(2, -2), true, false] : [x, false, false]))
      : [];
    cur.blocks.push({ type: 'p', runs, list: lst });
  }
  const leeg = (b: Block | undefined) => !!b && b.type === 'p' && !b.runs.length;
  for (const e of out) {
    while (e.blocks.length && leeg(e.blocks[0])) e.blocks.shift();
    while (e.blocks.length && leeg(e.blocks[e.blocks.length - 1])) e.blocks.pop();
  }
  return out.filter((e) => e.blocks.length);
}

/** Bibliotheek (met afbeeldingen) samengevoegd met de standaardteksten uit het project. */
export function bibliotheek(bib: Bibliotheek | null, kennis: Kennis | null): LibEntry[] {
  const res: LibEntry[] = (bib?.entries || []).map((e) => e);
  for (const m of mdEntries(kennis?.standaardteksten)) {
    const i = res.findIndex((e) => nrm(e.name) === nrm(m.name));
    if (i >= 0) {
      const med = res[i].blocks.filter((b) => b.type !== 'p');
      res[i] = {
        ...res[i],
        aliases: [...(res[i].aliases || []), ...m.aliases],
        blocks: [...m.blocks, { type: 'p', runs: [] }, ...med],
        bron: m.bron,
      };
    } else res.push(m);
  }
  return res;
}

export type ZoekStatus = 'ok' | 'onbekend' | 'twijfel';

export function zoek(product: string, lib: LibEntry[]): { e: LibEntry | null; st: ZoekStatus; info: string } {
  const np = ' ' + nrm(product) + ' ';
  const toks = codeTok(product);
  const sc: [number, LibEntry][] = [];
  for (const e of lib) {
    if (e.kind === 'media') continue;
    if (e.exact) {
      if ([e.name, ...(e.aliases || [])].some((k) => nrm(k) === nrm(product))) sc.push([1000, e]);
      continue;
    }
    let best = 0;
    for (const k of [e.name, ...(e.aliases || [])]) {
      const n = nrm(k);
      if (n && np.includes(' ' + n + ' ')) best = Math.max(best, 100 + n.length);
    }
    for (const t of [...codeTok(e.name), ...(e.aliases || []).filter((a) => codeTok(a).size).map(nrm)])
      if (toks.has(t)) best = Math.max(best, 50 + t.length);
    if (best) sc.push([best, e]);
  }
  if (!sc.length) return { e: null, st: 'onbekend', info: '' };
  sc.sort((a, b) => b[0] - a[0]);
  if (sc.length > 1 && sc[0][0] === sc[1][0])
    return {
      e: null,
      st: 'twijfel',
      info: sc
        .slice(0, 3)
        .map((x) => x[1].name)
        .join(' / '),
    };
  return { e: sc[0][1], st: 'ok', info: '' };
}

export const heeftMedia = (e: LibEntry) => e.blocks.some((b) => b.type === 'media' || b.type === 'img');
