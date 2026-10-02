/* Hulpfuncties voor WordprocessingML (document.xml uit een .docx). */

export const NW = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
export const NR = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const NWP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
export const NA = 'http://schemas.openxmlformats.org/drawingml/2006/main';
export const NPR = 'http://schemas.openxmlformats.org/package/2006/relationships';
export const NV = 'urn:schemas-microsoft-com:vml';
export const NO = 'urn:schemas-microsoft-com:office:office';
export const NMC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
export const NSY = 'urn:miltech:offertetool';
export const NCT = 'http://schemas.openxmlformats.org/package/2006/content-types';

/** "2 x Afzuigarm XYZ" / "1 st. Ventilator" */
export const ART_RE = /^\s*(\d+(?:[.,]\d+)?)\s*(?:x|×|st\.?|stk\.?|stuks?)\s+(.+?)\s*$/i;
export const SECTIE_RE =
  /^(totaalprijs|niet tot onze levering|onze installatiekosten|condities|leveringsomvang|systeemomschrijving|optie|opties|meerprijs)/;

export const ORDER_PPR = ['pStyle', 'keepNext', 'keepLines', 'pageBreakBefore', 'framePr', 'widowControl', 'numPr', 'suppressLineNumbers', 'pBdr', 'shd', 'tabs', 'suppressAutoHyphens', 'kinsoku', 'wordWrap', 'overflowPunct', 'topLinePunct', 'autoSpaceDE', 'autoSpaceDN', 'bidi', 'adjustRightInd', 'snapToGrid', 'spacing', 'ind', 'contextualSpacing', 'mirrorIndents', 'suppressOverlap', 'jc', 'textDirection', 'textAlignment', 'textboxTightWrap', 'outlineLvl', 'divId', 'cnfStyle', 'rPr', 'sectPr', 'pPrChange'];
export const ORDER_RPR = ['rStyle', 'rFonts', 'b', 'bCs', 'i', 'iCs', 'caps', 'smallCaps', 'strike', 'dstrike', 'outline', 'shadow', 'emboss', 'imprint', 'noProof', 'snapToGrid', 'vanish', 'webHidden', 'color', 'spacing', 'w', 'kern', 'position', 'sz', 'szCs', 'highlight', 'u', 'effect', 'bdr', 'shd', 'fitText', 'vertAlign', 'rtl', 'cs', 'em', 'lang', 'eastAsianLayout', 'specVanish', 'oMath'];

/** Huisstijl-instellingen, gelijk aan offerte_tool.py v2.1. */
export const SYH = {
  LEGE_VOOR_TEKST: true,
  LEGE_VOOR_AFB: true,
  LEGE_NA_BLOK: true,
  BIJ_ELKAAR: true,
  LIJST: '- ',
};

export const nrm = (s: unknown) =>
  String(s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

export const codeTok = (s: unknown) =>
  new Set(
    nrm(s)
      .split(' ')
      .filter((t) => t.length >= 4 && /\d/.test(t) && /[a-z]/.test(t)),
  );

export function kids(e: Node | null | undefined, ns: string, l?: string | null): Element[] {
  if (!e) return [];
  return [...e.childNodes].filter(
    (n): n is Element => n.nodeType === 1 && (n as Element).namespaceURI === ns && (l == null || (n as Element).localName === l),
  );
}

export function kid(e: Node | null | undefined, ns: string, l: string): Element | null {
  return kids(e, ns, l)[0] || null;
}

export function alle(e: Document | Element | null | undefined, ns: string, l: string): Element[] {
  return e ? [...e.getElementsByTagNameNS(ns, l)] : [];
}

/** Waarde van een w:-attribuut. */
export function wv(e: Element | null | undefined, a: string): string | null {
  return e ? e.getAttributeNS(NW, a) || e.getAttribute('w:' + a) : null;
}

export const wn = (e: Element | null | undefined, a: string): number => +(wv(e, a) || 0);

export function ptekst(e: Element | Document): string {
  return alle(e, NW, 't')
    .map((t) => t.textContent)
    .join('');
}

export function hasMedia(e: Element): boolean {
  return alle(e, NA, 'blip').length > 0 || alle(e, NW, 'object').length > 0 || alle(e, NV, 'imagedata').length > 0;
}

export function bms(e: Element): string[] {
  return alle(e, NW, 'bookmarkStart').map((b) => wv(b, 'name') || '');
}

export function b64ToBytes(b: string): Uint8Array {
  const s = atob(b);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

export function bytesToB64(u: Uint8Array): string {
  let s = '';
  const c = 0x8000;
  for (let i = 0; i < u.length; i += c) s += String.fromCharCode.apply(null, Array.from(u.subarray(i, i + c)));
  return btoa(s);
}

export function hashStr(s: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0;
  for (let i = 0; i < s.length; i += Math.max(1, (s.length / 4096) | 0)) {
    h1 ^= s.charCodeAt(i);
    h1 = Math.imul(h1, 16777619);
    h2 = (h2 + s.charCodeAt(i) * (i + 1)) | 0;
  }
  return ((h1 >>> 0).toString(16) + (h2 >>> 0).toString(16) + s.length.toString(16)).slice(0, 14);
}

/** Voegt een kind in op de plek die het OOXML-schema voorschrijft. */
export function insOrder(parent: Element, node: Element, order: string[]): Element {
  const idx = order.indexOf(node.localName);
  for (const c of [...parent.childNodes]) {
    if (c.nodeType !== 1) continue;
    const j = order.indexOf((c as Element).localName);
    if (j > idx) {
      parent.insertBefore(node, c);
      return node;
    }
  }
  parent.appendChild(node);
  return node;
}

export function wEl(doc: Document, tag: string, attrs?: Record<string, string | number>): Element {
  const e = doc.createElementNS(NW, 'w:' + tag);
  for (const k in attrs || {}) e.setAttributeNS(NW, 'w:' + k, String(attrs![k]));
  return e;
}

export function bodyVan(doc: Document): Element {
  return alle(doc, NW, 'body')[0];
}

export function parseXml(s: string): Document {
  return new DOMParser().parseFromString(s, 'application/xml');
}

export const isAan = (e: Element | null) => !!e && !['0', 'false'].includes(wv(e, 'val') || '');

/* ---------- stijlen (vet via stijl) ---------- */

export interface Stijl {
  bold: boolean | null;
  basedOn: string | null;
  name: string;
  sz: number | null;
  font: string | null;
  isDefault: boolean;
  type: string | null;
}

export interface Stijlen {
  s: Record<string, Stijl>;
  def: { font: string | null; sz: number | null };
}

export function leesStijlen(xml: string): Stijlen {
  const out: Stijlen = { s: {}, def: { font: null, sz: null } };
  if (!xml) return out;
  const d = parseXml(xml);
  for (const s of alle(d, NW, 'style')) {
    const id = wv(s, 'styleId') || '';
    const rp = kid(s, NW, 'rPr');
    const b = rp && kid(rp, NW, 'b');
    const bo = kid(s, NW, 'basedOn');
    const nm = kid(s, NW, 'name');
    const sz = rp && kid(rp, NW, 'sz');
    const rf = rp && kid(rp, NW, 'rFonts');
    out.s[id] = {
      bold: b ? isAan(b) : null,
      basedOn: bo ? wv(bo, 'val') : null,
      name: nm ? wv(nm, 'val') || id : id,
      sz: sz ? wn(sz, 'val') : null,
      font: rf ? wv(rf, 'ascii') : null,
      isDefault: s.getAttributeNS(NW, 'default') === '1' || s.getAttribute('w:default') === '1',
      type: wv(s, 'type'),
    };
  }
  const dd = alle(d, NW, 'rPrDefault')[0];
  if (dd) {
    const f = alle(dd, NW, 'rFonts')[0];
    const z = alle(dd, NW, 'sz')[0];
    out.def = { font: f ? wv(f, 'ascii') : null, sz: z ? wn(z, 'val') : null };
  }
  return out;
}

export function standaardStijl(st: Stijlen): string | undefined {
  return Object.keys(st.s).find((k) => st.s[k].isDefault && st.s[k].type === 'paragraph');
}

function stijlBold(st: Stijlen, id: string | null | undefined): boolean {
  let n = 0;
  while (id && st.s[id] && n++ < 10) {
    if (st.s[id].bold != null) return !!st.s[id].bold;
    id = st.s[id].basedOn;
  }
  return false;
}

function runBold(r: Element, p: Element, st: Stijlen): boolean {
  const rp = kid(r, NW, 'rPr');
  const b = rp && kid(rp, NW, 'b');
  if (b) return isAan(b);
  const rs = rp && kid(rp, NW, 'rStyle');
  if (rs && stijlBold(st, wv(rs, 'val'))) return true;
  const pp = kid(p, NW, 'pPr');
  const ps = pp && kid(pp, NW, 'pStyle');
  return stijlBold(st, ps ? wv(ps, 'val') : standaardStijl(st));
}

/** Runs van een alinea, zonder tekstvakken en fallback-inhoud. */
export function runsVan(p: Element): Element[] {
  return alle(p, NW, 'r').filter((r) => {
    let x = r.parentNode as Element | null;
    while (x && x !== p) {
      if (x.localName === 'txbxContent' || x.localName === 'Fallback') return false;
      x = x.parentNode as Element | null;
    }
    return true;
  });
}

export function vetteRegel(p: Element, st: Stijlen): boolean {
  const rs = runsVan(p).filter((r) => ptekst(r).trim());
  return rs.length > 0 && rs.every((r) => runBold(r, p, st));
}

export function isKop(p: Element, st: Stijlen): boolean {
  const pp = kid(p, NW, 'pPr');
  const ps = pp && kid(pp, NW, 'pStyle');
  if (!ps) return false;
  const id = wv(ps, 'val') || '';
  const nm = st.s[id]?.name || id;
  return /^(heading|kop)\s*\d/i.test(nm) || /^(kop|heading)\d/i.test(id);
}

export function isArtikel(p: Element, st: Stijlen): boolean {
  return p.localName === 'p' && ART_RE.test(ptekst(p).trim()) && vetteRegel(p, st);
}

/** Alinea's/tabellen die bij een artikelregel horen (tot de volgende artikelregel of sectiekop). */
export function blokNa(p: Element, st: Stijlen): Element[] {
  const out: Element[] = [];
  let n = p.nextSibling;
  while (n) {
    if (n.nodeType !== 1) {
      n = n.nextSibling;
      continue;
    }
    const e = n as Element;
    if (e.localName !== 'p' && e.localName !== 'tbl') break;
    if (e.localName === 'p') {
      const t = ptekst(e).trim();
      if (isArtikel(e, st) || isKop(e, st) || (vetteRegel(e, st) && SECTIE_RE.test(nrm(t)))) break;
    }
    out.push(e);
    n = e.nextSibling;
  }
  return out;
}
