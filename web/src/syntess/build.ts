/* Opbouw: aangeleverde offerte + keuzes -> nieuw document (zelfde regels als offerte_tool.py). */
import type { SyntessOfferte } from '../lib/types';
import { ST_INFO, analyse, statusVan } from './analyse';
import type { Bibliotheek, Block, BlockElement, BlockImg, BlockMedia, LibEntry, RelPart, Run } from './library';
import {
  NA,
  NO,
  NR,
  NV,
  NW,
  NWP,
  NSY,
  ORDER_PPR,
  ORDER_RPR,
  SYH,
  alle,
  bodyVan,
  hasMedia,
  hashStr,
  insOrder,
  kid,
  kids,
  nrm,
  parseXml,
  ptekst,
  runsVan,
  wEl,
  wv,
} from './ooxml';
import type { Basis, NieuweRel, Opbouw } from './types';

interface Fmt {
  doc: Document;
  pPr: Element;
  rPr: Element | null;
  left: number;
}

interface Ctx {
  doc: Document;
  mark: boolean;
  lib: Bibliotheek | null;
  nid: () => number;
  rel: (info: RelPart) => string;
}

/** Opmaak van een referentie-alinea overnemen (zonder nummering, vet, enz.). */
function fmtVan(doc: Document, ref: Element): Fmt {
  const p0 = kid(ref, NW, 'pPr');
  const pPr = p0 ? (p0.cloneNode(true) as Element) : wEl(doc, 'pPr');
  for (const t of ['numPr', 'keepNext', 'pageBreakBefore', 'outlineLvl', 'rPr', 'jc', 'sectPr', 'pPrChange'])
    kids(pPr, NW, t).forEach((x) => pPr.removeChild(x));
  const ind = kid(pPr, NW, 'ind');
  let left = 0;
  if (ind) {
    left = +(wv(ind, 'left') || wv(ind, 'start') || 0);
    for (const a of ['firstLine', 'hanging', 'start', 'end']) {
      ind.removeAttributeNS(NW, a);
      ind.removeAttribute('w:' + a);
    }
  }
  const r0 = runsVan(ref).find((r) => ptekst(r).trim());
  const rp0 = r0 && kid(r0, NW, 'rPr');
  const rPr = rp0 ? (rp0.cloneNode(true) as Element) : null;
  if (rPr) for (const t of ['b', 'bCs', 'i', 'iCs', 'u', 'highlight', 'caps']) kids(rPr, NW, t).forEach((x) => rPr.removeChild(x));
  return { doc, pPr, rPr, left };
}

function nieuwePPr(f: Fmt, extra: number, keep: boolean, tabs?: [string, string][] | null): Element {
  const p = f.pPr.cloneNode(true) as Element;
  if (tabs && tabs.length) {
    kids(p, NW, 'tabs').forEach((x) => p.removeChild(x));
    const tt = wEl(f.doc, 'tabs');
    for (const [v, pos] of tabs) tt.appendChild(wEl(f.doc, 'tab', { val: v, pos }));
    insOrder(p, tt, ORDER_PPR);
  }
  if (keep) insOrder(p, wEl(f.doc, 'keepNext'), ORDER_PPR);
  let ind = kid(p, NW, 'ind');
  if (!ind) ind = insOrder(p, wEl(f.doc, 'ind'), ORDER_PPR);
  ind.setAttributeNS(NW, 'w:left', String(f.left + (extra || 0)));
  if (f.rPr) insOrder(p, f.rPr.cloneNode(true) as Element, ORDER_PPR);
  return p;
}

function maakRun(f: Fmt, tekst: string, b: boolean, i: boolean, kleur?: string | null): Element {
  const d = f.doc;
  const r = wEl(d, 'r');
  const rp = f.rPr ? (f.rPr.cloneNode(true) as Element) : wEl(d, 'rPr');
  if (b) {
    insOrder(rp, wEl(d, 'b'), ORDER_RPR);
    insOrder(rp, wEl(d, 'bCs'), ORDER_RPR);
  }
  if (i) insOrder(rp, wEl(d, 'i'), ORDER_RPR);
  if (kleur) {
    kids(rp, NW, 'color').forEach((x) => rp.removeChild(x));
    insOrder(rp, wEl(d, 'color', { val: kleur }), ORDER_RPR);
  }
  if (rp.childNodes.length) r.appendChild(rp);
  String(tekst)
    .replace(/\n/g, '')
    .split('\t')
    .forEach((s, k) => {
      if (k) r.appendChild(wEl(d, 'tab'));
      if (s) {
        const t = wEl(d, 't');
        t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
        t.textContent = s;
        r.appendChild(t);
      }
    });
  return r;
}

/** **vet** en *cursief* naar runs. */
export function markup(l: string): Run[] {
  return String(l)
    .split(/(\*\*.+?\*\*|(?<!\*)\*[^*]+?\*(?!\*))/)
    .filter(Boolean)
    .map((x): Run =>
      /^\*\*.+\*\*$/.test(x) ? [x.slice(2, -2), true, false] : /^\*[^*].*\*$/.test(x) ? [x.slice(1, -1), false, true] : [x, false, false],
    );
}

function zetKeep(p: Element | null) {
  if (!p || p.localName !== 'p') return;
  let pp = kid(p, NW, 'pPr');
  if (!pp) {
    pp = wEl(p.ownerDocument, 'pPr');
    p.insertBefore(pp, p.firstChild);
  }
  if (!kid(pp, NW, 'keepNext')) insOrder(pp, wEl(p.ownerDocument, 'keepNext'), ORDER_PPR);
}

function isLegeP(n: Element | null): boolean {
  return !!n && n.nodeType === 1 && n.localName === 'p' && !ptekst(n).trim() && !hasMedia(n);
}

function volgend(n: Node): Element | null {
  let x = n.nextSibling;
  while (x && x.nodeType !== 1) x = x.nextSibling;
  return x as Element | null;
}

function vorig(n: Node): Element | null {
  let x = n.previousSibling;
  while (x && x.nodeType !== 1) x = x.previousSibling;
  return x as Element | null;
}

function zetRelaties(n: Element, parts: Record<string, RelPart>, ctx: Ctx) {
  const map: Record<string, string> = {};
  for (const e of [n, ...n.getElementsByTagName('*')])
    for (const at of [...e.attributes])
      if (at.namespaceURI === NR && parts[at.value]) {
        if (!map[at.value]) map[at.value] = ctx.rel(parts[at.value]);
        e.setAttributeNS(NR, at.name, map[at.value]);
      }
}

class Invoeger {
  ctx: Ctx;
  d: Document;
  last: Element;
  f: Fmt;
  first: Element | null = null;
  keep = false;
  soort: string;
  sleutel: string;

  constructor(ctx: Ctx, anker: Element, f: Fmt, soort: string, sleutel: string) {
    this.ctx = ctx;
    this.d = ctx.doc;
    this.last = anker;
    this.f = f;
    this.soort = soort;
    this.sleutel = sleutel;
  }

  private _p(extra?: number, tabs?: [string, string][] | null): Element {
    const p = wEl(this.d, 'p');
    p.appendChild(nieuwePPr(this.f, extra || 0, this.keep, tabs));
    this.zet(p);
    return p;
  }

  zet(n: Element) {
    if (this.ctx.mark) {
      n.setAttributeNS(NSY, 'sy:k', this.sleutel);
      n.setAttributeNS(NSY, 'sy:s', this.soort);
    }
    this.last.parentNode!.insertBefore(n, this.last.nextSibling);
    this.last = n;
    if (!this.first) this.first = n;
  }

  leeg() {
    return this._p();
  }

  tekst(runs: Run[], lijst?: boolean, tabs?: [string, string][] | null, ind?: number, lineKey?: number | null) {
    const p = this._p((lijst ? 709 : 0) + (ind || 0), tabs);
    if (lineKey != null && this.ctx.mark) p.setAttributeNS(NSY, 'sy:l', String(lineKey));
    const rr: Run[] = lijst ? [[SYH.LIJST, false, false], ...runs] : runs;
    for (const [t, b, i] of rr.length ? rr : [['', false, false] as Run]) p.appendChild(maakRun(this.f, t, b, i));
    return p;
  }

  pagina() {
    const p = this._p();
    const r = wEl(this.d, 'r');
    r.appendChild(wEl(this.d, 'br', { type: 'page' }));
    p.appendChild(r);
    return p;
  }

  media(blk: BlockImg | BlockMedia) {
    const p = this._p();
    if (blk.type === 'img') {
      const rid = this.ctx.rel({
        reltype: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
        ctype: 'image/' + (blk.ext === 'jpg' ? 'jpeg' : blk.ext),
        ext: blk.ext,
        b64: blk.b64,
      });
      const id = this.ctx.nid();
      const cx = blk.cx || 3600000;
      const cy = blk.cy || 2400000;
      const x = `<w:r xmlns:w="${NW}"><w:drawing><wp:inline xmlns:wp="${NWP}" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Afbeelding ${id}"/><a:graphic xmlns:a="${NA}"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="Afbeelding ${id}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="${NR}" r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
      p.appendChild(this.d.importNode(parseXml(x).documentElement, true));
      return p;
    }
    for (const xml of blk.runs_xml) {
      const n = this.d.importNode(parseXml(xml).documentElement, true) as Element;
      zetRelaties(n, blk.parts, this.ctx);
      for (const dp of alle(n, NWP, 'docPr')) dp.setAttribute('id', String(this.ctx.nid()));
      for (const sh of alle(n, NV, 'shape')) {
        const old = sh.getAttribute('id');
        const nw = '_x0000_i' + this.ctx.nid();
        sh.setAttribute('id', nw);
        for (const o of alle(n, NO, 'OLEObject'))
          if (o.getAttribute('ShapeID') === old) {
            o.setAttribute('ShapeID', nw);
            o.setAttribute('ObjectID', '_' + (1700000000 + this.ctx.nid()));
          }
      }
      p.appendChild(n);
    }
    return p;
  }

  element(blk: BlockElement) {
    const n = this.d.importNode(parseXml(blk.xml).documentElement, true) as Element;
    zetRelaties(n, blk.parts, this.ctx);
    for (const dp of alle(n, NWP, 'docPr')) dp.setAttribute('id', String(this.ctx.nid()));
    this.zet(n);
    return n;
  }

  tabel(rows: string[][]) {
    const d = this.d;
    const tpl = this.ctx.lib?.tabel_sjabloon;
    const bestaand = kids(bodyVan(d), NW, 'tbl')[0];
    const nc = Math.max(...rows.map((r) => r.length));
    let tblPr: Element;
    let grid: Element | null;
    let shd: Element | null = null;
    let kleur: string | null = null;
    const P = (s: string) => d.importNode(parseXml(s).documentElement, true) as Element;
    if (bestaand) {
      tblPr = kid(bestaand, NW, 'tblPr')!.cloneNode(true) as Element;
      const g0 = kid(bestaand, NW, 'tblGrid');
      grid = g0 ? (g0.cloneNode(true) as Element) : null;
      const tc0 = alle(bestaand, NW, 'tc')[0];
      const s0 = tc0 && alle(tc0, NW, 'shd')[0];
      shd = s0 ? (s0.cloneNode(true) as Element) : null;
      const c = tc0 && alle(tc0, NW, 'color')[0];
      kleur = c ? wv(c, 'val') : null;
    } else if (tpl) {
      tblPr = P(tpl.tblPr);
      grid = P(tpl.tblGrid);
      shd = tpl.hdr_shd ? P(tpl.hdr_shd) : null;
      kleur = tpl.hdr_color || null;
    } else {
      tblPr = wEl(d, 'tblPr');
      tblPr.appendChild(wEl(d, 'tblW', { w: 0, type: 'auto' }));
      const bd = wEl(d, 'tblBorders');
      for (const s of ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'])
        bd.appendChild(wEl(d, s, { val: 'single', sz: 4, space: 0, color: '000000' }));
      tblPr.appendChild(bd);
      grid = null;
    }
    const cols = grid ? kids(grid, NW, 'gridCol') : [];
    const ws = cols.length === nc ? cols.map((g) => wv(g, 'w') || '0') : Array<string>(nc).fill(String(Math.round(9600 / nc)));
    if (!grid || cols.length !== nc) {
      grid = wEl(d, 'tblGrid');
      ws.forEach((w) => grid!.appendChild(wEl(d, 'gridCol', { w })));
    }
    const tbl = wEl(d, 'tbl');
    tbl.appendChild(tblPr);
    tbl.appendChild(grid);
    rows.forEach((row, i) => {
      const tr = wEl(d, 'tr');
      for (let j = 0; j < nc; j++) {
        const tc = wEl(d, 'tc');
        const tp = wEl(d, 'tcPr');
        tp.appendChild(wEl(d, 'tcW', { w: ws[j], type: 'dxa' }));
        if (i === 0 && shd) tp.appendChild(shd.cloneNode(true));
        tc.appendChild(tp);
        const p = wEl(d, 'p');
        for (const [t, b, it] of markup(row[j] || '')) p.appendChild(maakRun(this.f, t, b || i === 0, it, i === 0 ? kleur : null));
        tc.appendChild(p);
        tr.appendChild(tc);
      }
      tbl.appendChild(tr);
    });
    this.zet(tbl);
    return tbl;
  }

  bladwijzer(naam: string) {
    if (!this.first || this.first.localName !== 'p') return;
    const id = this.ctx.nid();
    const s = wEl(this.d, 'bookmarkStart', { id, name: naam.slice(0, 40) });
    const e = wEl(this.d, 'bookmarkEnd', { id });
    const pp = kid(this.first, NW, 'pPr');
    this.first.insertBefore(s, pp ? pp.nextSibling : this.first.firstChild);
    this.first.appendChild(e);
  }
}

const tekstVan = (b: Block) => (b.type === 'p' ? b.runs.map((r) => r[0]).join('').trim() : '');

function voegArtikelIn(ins: Invoeger, e: LibEntry): number {
  let n = 0;
  let prev: 'p' | 'blank' | 'img' | null = null;
  ins.keep = SYH.BIJ_ELKAAR;
  if (SYH.LEGE_VOOR_TEKST) ins.leeg();
  ins.keep = false;
  for (const b of e.blocks) {
    if (b.type === 'p') {
      ins.tekst(b.runs, b.list, b.tabs, b.ind);
      prev = tekstVan(b) ? 'p' : 'blank';
    } else if (b.type === 'element') {
      ins.element(b);
      prev = 'p';
    } else {
      if (prev === 'p' && SYH.LEGE_VOOR_AFB && !e.exact) {
        if (SYH.BIJ_ELKAAR) zetKeep(ins.last);
        ins.leeg();
      }
      if (SYH.BIJ_ELKAAR && ins.first && (prev === 'p' || prev === 'blank')) {
        zetKeep(ins.last);
        const pv = vorig(ins.last);
        if (prev === 'blank' && pv && pv !== vorig(ins.first)) zetKeep(pv);
      }
      ins.media(b);
      n++;
      prev = 'img';
    }
  }
  if (SYH.LEGE_NA_BLOK && !isLegeP(volgend(ins.last))) ins.leeg();
  return n;
}

function voegAfbeeldingIn(ins: Invoeger, e: LibEntry): number {
  const bl = e.blocks;
  const k = bl.findIndex((b) => b.type !== 'p');
  const voor = k > 0 ? bl[k - 1] : null;
  const lb = !!voor && voor.type === 'p' && !tekstVan(voor);
  if (e.exact ? lb : SYH.LEGE_VOOR_AFB) {
    ins.leeg();
    if (SYH.BIJ_ELKAAR) zetKeep(ins.last);
  }
  let n = 0;
  for (const b of bl)
    if (b.type === 'img' || b.type === 'media') {
      ins.media(b);
      n++;
    }
  if (SYH.LEGE_NA_BLOK && !isLegeP(volgend(ins.last))) ins.leeg();
  return n;
}

/** Bouwt het aangevulde document. `mark` voegt markeringen toe voor de voorbeeldweergave. */
export function bouw(B: Basis, cur: SyntessOfferte, lib: LibEntry[], bib: Bibliotheek | null, mark: boolean): Opbouw {
  const doc = parseXml(B.xml);
  let teller = 90000;
  let relN = 0;
  const nieuweRels: Record<string, NieuweRel> = {};
  const perHash: Record<string, string> = {};
  const ctx: Ctx = {
    doc,
    mark,
    lib: bib,
    nid: () => ++teller,
    rel: (info) => {
      const h = hashStr(info.b64);
      if (perHash[h]) return perHash[h];
      const id = 'rIdOT' + ++relN;
      nieuweRels[id] = {
        ...info,
        pad: (/package|oleObject/.test(info.ctype) ? 'embeddings/' : 'media/') + 'ot_' + h + '.' + info.ext,
      };
      perHash[h] = id;
      return id;
    },
  };
  const arts = analyse(doc, B.st);
  const rap = { ingevoegd: [] as string[], overgeslagen: [] as string[], inleiding: '' };

  arts.forEach((a, i) => {
    const s = statusVan(a, i, lib, cur);
    a.s = s;
    const key = 'a' + i;
    if (s.st === 'alleen_afbeelding' && s.e) {
      const inh = a.blok.filter((x) => ptekst(x).trim());
      const ins = new Invoeger(ctx, inh[inh.length - 1], fmtVan(doc, a.p), 'bib', key);
      const n = voegAfbeeldingIn(ins, s.e);
      ins.bladwijzer('OT_img_' + i);
      rap.ingevoegd.push(`${a.regel} → alleen afbeelding (${n}), eigen tekst ongewijzigd`);
    } else if (s.st === 'ok' && s.e) {
      const ins = new Invoeger(ctx, a.p, fmtVan(doc, a.p), 'bib', key);
      const n = voegArtikelIn(ins, s.e);
      ins.bladwijzer('OT_art_' + i);
      rap.ingevoegd.push(`${a.regel} → ${s.e.name} (${n} afb.)`);
    } else if (s.st === 'eigen') {
      const ins = new Invoeger(ctx, a.p, fmtVan(doc, a.p), 'eigen', key);
      if (SYH.LEGE_VOOR_TEKST) ins.leeg();
      for (const l of (cur.eigen[i] || '').split('\n')) ins.tekst(markup(l.replace(/^- /, '')), /^- /.test(l));
      if (!isLegeP(volgend(ins.last))) ins.leeg();
      ins.bladwijzer('OT_art_' + i);
      rap.ingevoegd.push(`${a.regel} → eigen tekst`);
    } else rap.overgeslagen.push(`${a.regel} → ${ST_INFO[s.st] ? ST_INFO[s.st][0] : s.st}${s.info ? ' (' + s.info + ')' : ''}`);
  });

  // inleiding onder Systeemomschrijving
  const inl = String(cur.inleiding || '');
  if (inl.trim()) {
    const so = kids(bodyVan(doc), NW, 'p').find((p) => nrm(ptekst(p)).startsWith('systeemomschrijving') && ptekst(p).trim().length < 120);
    if (!so) rap.inleiding = 'NIET geplaatst: kop Systeemomschrijving niet gevonden';
    else if (alle(doc, NW, 'bookmarkStart').some((b) => wv(b, 'name') === 'OT_inleiding')) rap.inleiding = 'staat er al';
    else {
      const ins = new Invoeger(ctx, so, fmtVan(doc, so), 'claude', 'inl');
      ins.leeg();
      ins.bladwijzer('OT_inleiding');
      const L = inl.replace(/\s+$/, '').split('\n');
      let k = 0;
      const mis: string[] = [];
      while (k < L.length) {
        const l = L[k].trim();
        if (l.startsWith('|')) {
          const tl: string[] = [];
          while (k < L.length && L[k].trim().startsWith('|')) tl.push(L[k++].trim());
          ins.tabel(
            tl
              .filter((x) => !/^\|?\s*:?-{2,}/.test(x))
              .map((x) =>
                x
                  .replace(/^\||\|$/g, '')
                  .split('|')
                  .map((c) => c.trim()),
              ),
          );
          continue;
        }
        if (!l) ins.leeg();
        else if (/^-{3}\s*pagina\s*-{3}$/i.test(l)) ins.pagina();
        else if (/^\[\[(.+)\]\]$/.test(l)) {
          const e = lib.find((x) => nrm(x.name) === nrm(l.slice(2, -2)));
          if (!e) mis.push(l);
          else
            for (const b of e.blocks) {
              if (b.type === 'p') ins.tekst(b.runs, false, b.tabs, 0, k);
              else if (b.type === 'img' || b.type === 'media') ins.media(b);
              else ins.element(b);
            }
        } else if (l.startsWith('- ')) ins.tekst(markup(l.slice(2)), true, null, 0, k);
        else ins.tekst(markup(l), false, null, 0, k);
        k++;
      }
      rap.inleiding = 'geplaatst onder Systeemomschrijving' + (mis.length ? ' – niet gevonden: ' + mis.join(', ') : '');
    }
  }
  return { doc, arts, rap, nieuweRels };
}
