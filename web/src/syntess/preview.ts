/* Voorbeeldweergave: benadering van de Word-pagina's in HTML. */
import { esc } from '../lib/utils';
import { NA, NMC, NSY, NV, NW, NWP, alle, b64ToBytes, bodyVan, hasMedia, hashStr, kid, kids, parseXml, ptekst, standaardStijl, wn, wv } from './ooxml';
import type { Basis, NieuweRel, Opbouw, Rels } from './types';

const TW = 15; // twips per px (96 dpi)
const pxEmu = (n: string | null | undefined) => Math.round((+(n || 0) || 0) / 9525);

interface PaginaMaten {
  w: number;
  h: number;
  mt: number;
  mb: number;
  ml: number;
  mr: number;
  hd: number;
  fd: number;
  cw: number;
  titel: boolean;
}

interface Veld {
  instr?: string;
  mode?: string;
  open?: string;
}

/** Tekencontext voor één voorbeeldweergave. */
interface Teken {
  base: Basis;
  pg: PaginaMaten;
}

const extraUrls: Record<string, string> = {};

/** Blob-URL's van nieuw ingevoegde afbeeldingen opruimen (bij een ander document). */
export function ruimVoorbeeldOp(): void {
  for (const k of Object.keys(extraUrls)) {
    URL.revokeObjectURL(extraUrls[k]);
    delete extraUrls[k];
  }
}

function mediaUrl(T: Teken, rid: string | null, rels: Rels | null, extra: Record<string, NieuweRel> | null): string | null {
  if (!rid) return null;
  if (extra && extra[rid]) {
    const r = extra[rid];
    if (!/^(png|jpe?g|gif)$/i.test(r.ext)) return null;
    const k = 'nr:' + rid + ':' + hashStr(r.b64);
    if (!extraUrls[k]) extraUrls[k] = URL.createObjectURL(new Blob([b64ToBytes(r.b64)], { type: r.ctype }));
    return extraUrls[k];
  }
  const r = rels && rels[rid];
  if (!r) return null;
  const m = T.base.media;
  return m['word/' + r.target.replace(/^\.\.\//, '').replace(/^\//, '')] || m['word/' + r.target] || null;
}

function runCss(rp: Element | null): string {
  let s = '';
  if (!rp) return s;
  const b = kid(rp, NW, 'b');
  const i = kid(rp, NW, 'i');
  const u = kid(rp, NW, 'u');
  const sz = kid(rp, NW, 'sz');
  const c = kid(rp, NW, 'color');
  const f = kid(rp, NW, 'rFonts');
  if (b && !['0', 'false'].includes(wv(b, 'val') || '')) s += 'font-weight:700;';
  if (i && !['0', 'false'].includes(wv(i, 'val') || '')) s += 'font-style:italic;';
  if (u && wv(u, 'val') !== 'none') s += 'text-decoration:underline;';
  if (sz) s += `font-size:${wn(sz, 'val') / 2}pt;`;
  if (c && /^[0-9A-Fa-f]{6}$/.test(wv(c, 'val') || '')) s += `color:#${wv(c, 'val')};`;
  if (f && wv(f, 'ascii')) s += `font-family:'${esc(wv(f, 'ascii'))}',Arial,sans-serif;`;
  return s;
}

function tekenRunInhoud(T: Teken, r: Element, rels: Rels, extra: Record<string, NieuweRel> | null, veld: Veld): string {
  let h = '';
  const css = runCss(kid(r, NW, 'rPr'));
  for (const c of r.childNodes) {
    if (c.nodeType !== 1) continue;
    const e = c as Element;
    const ln = e.localName;
    if (e.namespaceURI === NW && ln === 'fldChar') {
      const t = wv(e, 'fldCharType');
      if (t === 'begin') veld.instr = '';
      if (t === 'separate') veld.mode = /NUMPAGES/.test(veld.instr || '') ? 'pgs' : /\bPAGE\b/.test(veld.instr || '') ? 'pg' : '';
      if (t === 'end') {
        veld.mode = '';
        if (veld.open) {
          h += veld.open;
          veld.open = '';
        }
      }
      continue;
    }
    if (e.namespaceURI === NW && ln === 'instrText') {
      veld.instr = (veld.instr || '') + e.textContent;
      continue;
    }
    if (e.namespaceURI === NW && ln === 't') {
      if (veld.mode) {
        if (!veld.open) veld.open = `<span class="${veld.mode}" style="${css}"></span>`;
        continue;
      }
      h += `<span style="${css}">${esc(e.textContent)}</span>`;
    } else if (e.namespaceURI === NW && ln === 'tab') h += '<span class="tb"></span>';
    else if (e.namespaceURI === NW && ln === 'br') h += wv(e, 'type') === 'page' ? '<span class="pbrk"></span>' : '<br>';
    else if (e.namespaceURI === NW && (ln === 'drawing' || ln === 'pict' || ln === 'object')) h += tekenObject(T, e, rels, extra);
    else if (e.namespaceURI === NMC && ln === 'AlternateContent') {
      const ch = kid(e, NMC, 'Choice');
      if (ch)
        for (const x of ch.childNodes)
          if (x.nodeType === 1 && (x as Element).localName === 'drawing') h += tekenObject(T, x as Element, rels, extra);
    }
  }
  return h;
}

function binnenTekst(T: Teken, box: Element, rels: Rels, extra: Record<string, NieuweRel> | null): string {
  const tx = alle(box, NW, 'txbxContent')[0];
  if (!tx) return '';
  return kids(tx, NW, 'p')
    .map((p) => tekenP(T, p, rels, extra, {}))
    .join('');
}

function tekenObject(T: Teken, o: Element, rels: Rels, extra: Record<string, NieuweRel> | null): string {
  const pg = T.pg;
  if (o.localName === 'drawing') {
    const a = kid(o, NWP, 'anchor') || kid(o, NWP, 'inline');
    if (!a) return '';
    const ex = kid(a, NWP, 'extent');
    const w = pxEmu(ex && ex.getAttribute('cx'));
    const h = pxEmu(ex && ex.getAttribute('cy'));
    const blip = alle(a, NA, 'blip')[0];
    let fill = '';
    const sf = alle(a, NA, 'srgbClr')[0];
    if (!blip && sf) fill = `background:#${sf.getAttribute('val')};`;
    let inner = '';
    if (blip) {
      const u = mediaUrl(T, blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed'), rels, extra);
      inner = u
        ? `<img src="${u}" alt="" style="width:${w}px;height:${h}px;display:block">`
        : `<div class="ph" style="width:${w}px;height:${h}px">afbeelding (in Word zichtbaar)</div>`;
    }
    inner += binnenTekst(T, a, rels, extra);
    if (a.localName === 'anchor') {
      const ph = kid(a, NWP, 'positionH');
      const pv = kid(a, NWP, 'positionV');
      const off = (x: Element | null) => {
        const po = x && kid(x, NWP, 'posOffset');
        return po ? pxEmu(po.textContent) : 0;
      };
      const rf = ph && ph.getAttribute('relativeFrom');
      let L = off(ph);
      if (rf === 'page') L -= pg.ml;
      const al = ph && kid(ph, NWP, 'align');
      if (al && al.textContent === 'right') L = pg.cw - w;
      if (al && al.textContent === 'center') L = (pg.cw - w) / 2;
      let Tp: number | null = off(pv);
      const rv = pv && pv.getAttribute('relativeFrom');
      if (rv === 'page' || rv === 'margin') Tp = null;
      const beh = a.getAttribute('behindDoc') === '1';
      return `<span class="anc" style="left:${L}px;${Tp == null ? 'top:0' : 'top:' + Tp + 'px'};width:${w}px;height:${h}px;${fill}${beh ? 'z-index:0' : 'z-index:2'}" ${Tp == null ? `data-pt="${off(pv) - (rv === 'page' ? pg.mt : 0)}"` : ''}>${inner}</span>`;
    }
    return `<span class="inl" style="width:${w}px;min-height:${h}px;${fill}">${inner}</span>`;
  }
  // VML (pict / object)
  const sh = alle(o, NV, 'shape')[0] || alle(o, NV, 'rect')[0] || alle(o, NV, 'roundrect')[0];
  if (!sh) return '';
  const stl: Record<string, string> = {};
  String(sh.getAttribute('style') || '')
    .split(';')
    .forEach((kv) => {
      const [k, v] = kv.split(':');
      if (k && v) stl[k.trim()] = v.trim();
    });
  const pt = (v?: string) =>
    v
      ? /pt$/.test(v)
        ? (parseFloat(v) * 96) / 72
        : /in$/.test(v)
          ? parseFloat(v) * 96
          : /cm$/.test(v)
            ? (parseFloat(v) * 96) / 2.54
            : /mm$/.test(v)
              ? (parseFloat(v) * 96) / 25.4
              : parseFloat(v)
      : 0;
  const w = pt(stl.width);
  const h = pt(stl.height);
  const im = alle(sh, NV, 'imagedata')[0];
  let inner = '';
  if (im) {
    const u = mediaUrl(T, im.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'), rels, extra);
    inner = u
      ? `<img src="${u}" alt="" style="width:${w}px;height:${h}px;display:block">`
      : `<div class="ph" style="width:${w}px;height:${h}px">${o.localName === 'object' ? 'Visio-tekening / object – wordt in Word getoond' : 'afbeelding (in Word zichtbaar)'}</div>`;
  }
  inner += binnenTekst(T, sh, rels, extra);
  const fc = sh.getAttribute('fillcolor');
  const fill = fc && sh.getAttribute('filled') !== 'f' && !im ? `background:${esc(fc.split(' ')[0])};` : '';
  if (stl.position === 'absolute') {
    let L = pt(stl['margin-left']);
    if (stl['mso-position-horizontal-relative'] === 'page') L -= pg.ml;
    return `<span class="anc" style="left:${L}px;top:${pt(stl['margin-top'])}px;width:${w}px;height:${h}px;${fill}">${inner}</span>`;
  }
  return `<span class="inl" style="width:${w}px;min-height:${h}px;${fill}">${inner}</span>`;
}

function tekenP(T: Teken, p: Element, rels: Rels, extra: Record<string, NieuweRel> | null, veld: Veld): string {
  const pp = kid(p, NW, 'pPr');
  let css = '';
  let fs = '';
  const jc = pp && kid(pp, NW, 'jc');
  const sp = pp && kid(pp, NW, 'spacing');
  const ind = pp && kid(pp, NW, 'ind');
  const bd = pp && kid(pp, NW, 'pBdr');
  if (jc) {
    const v = wv(jc, 'val');
    css += `text-align:${v === 'both' ? 'justify' : v === 'center' ? 'center' : v === 'right' || v === 'end' ? 'right' : 'left'};`;
  }
  if (sp) {
    if (wv(sp, 'before')) css += `margin-top:${wn(sp, 'before') / TW}px;`;
    if (wv(sp, 'after')) css += `margin-bottom:${wn(sp, 'after') / TW}px;`;
    if (wv(sp, 'line') && (wv(sp, 'lineRule') || 'auto') === 'auto') css += `line-height:${((wn(sp, 'line') / 240) * 1.15).toFixed(3)};`;
  }
  if (ind) {
    const l = +(wv(ind, 'left') || wv(ind, 'start') || 0);
    const fl = wn(ind, 'firstLine') - wn(ind, 'hanging');
    if (l) css += `padding-left:${l / TW}px;`;
    if (fl) css += `text-indent:${fl / TW}px;`;
  }
  if (bd) css += 'border:1px solid #000;padding:4px 6px;';
  const mr = pp && kid(pp, NW, 'rPr');
  const msz = mr && kid(mr, NW, 'sz');
  if (msz) fs = `font-size:${wn(msz, 'val') / 2}pt;`;
  let h = '';
  const walk = (n: Element) => {
    for (const c of n.childNodes) {
      if (c.nodeType !== 1) continue;
      const e = c as Element;
      if (e.namespaceURI === NW && e.localName === 'r') h += tekenRunInhoud(T, e, rels, extra, veld);
      else if (e.namespaceURI === NW && ['hyperlink', 'ins', 'smartTag', 'sdt', 'sdtContent', 'customXml', 'fldSimple'].includes(e.localName))
        walk(e);
    }
  };
  walk(p);
  const sk = p.getAttributeNS(NSY, 'k');
  const ss = p.getAttributeNS(NSY, 's');
  const sl = p.getAttributeNS(NSY, 'l');
  const leeg = !ptekst(p).trim() && !hasMedia(p);
  const ed = ss === 'claude' && sl !== '' && sl != null && !hasMedia(p);
  return `<div class="wp${sk ? ' syi syi-' + ss : ''}" style="${css}${fs}"${sk ? ` data-syk="${esc(sk)}"` : ''}${ed ? ` contenteditable="true" data-syl="${esc(sl)}" spellcheck="true"` : ''}>${h || (leeg ? '&#8203;' : '')}</div>`;
}

function tekenTbl(T: Teken, t: Element, rels: Rels, extra: Record<string, NieuweRel> | null): string {
  const grid = kids(kid(t, NW, 'tblGrid'), NW, 'gridCol').map((g) => wn(g, 'w') / TW);
  const sk = t.getAttributeNS(NSY, 'k');
  const ss = t.getAttributeNS(NSY, 's');
  const rows = kids(t, NW, 'tr')
    .map(
      (tr) =>
        '<tr>' +
        kids(tr, NW, 'tc')
          .map((tc, j) => {
            const tp = kid(tc, NW, 'tcPr');
            const sh = tp && kid(tp, NW, 'shd');
            const f = sh && wv(sh, 'fill');
            const gs = tp && kid(tp, NW, 'gridSpan');
            return `<td ${gs ? `colspan="${esc(wv(gs, 'val'))}"` : ''} style="${f && f !== 'auto' ? 'background:#' + esc(f) + ';' : ''}${grid[j] ? 'width:' + grid[j] + 'px;' : ''}">${kids(tc, NW, 'p')
              .map((p) => tekenP(T, p, rels, extra, {}))
              .join('')}</td>`;
          })
          .join('') +
        '</tr>',
    )
    .join('');
  const bd =
    alle(t, NW, 'tblBorders').some((b) => alle(b, NW, 'top').some((x) => wv(x, 'val') && wv(x, 'val') !== 'none')) ||
    alle(t, NW, 'tcBorders').length > 0;
  return `<table class="wt${bd ? ' bd' : ''}${sk ? ' syi syi-' + ss : ''}"${sk ? ` data-syk="${esc(sk)}"` : ''}>${rows}</table>`;
}

function tekenDeel(T: Teken, part: { xml: string; rels: Rels } | undefined | null): string {
  if (!part) return '';
  const root = parseXml(part.xml).documentElement;
  const veld: Veld = {};
  return [...root.childNodes]
    .filter((n): n is Element => n.nodeType === 1)
    .map((n) => (n.localName === 'p' ? tekenP(T, n, part.rels, null, veld) : n.localName === 'tbl' ? tekenTbl(T, n, part.rels, null) : ''))
    .join('');
}

function paginaMaten(doc: Document): PaginaMaten {
  const sp = alle(doc, NW, 'sectPr').pop();
  const sz = sp && kid(sp, NW, 'pgSz');
  const mg = sp && kid(sp, NW, 'pgMar');
  const W_ = sz ? wn(sz, 'w') / TW : 794;
  const H_ = sz ? wn(sz, 'h') / TW : 1123;
  const g = (k: string) => (mg ? wn(mg, k) / TW : 72);
  return {
    w: W_,
    h: H_,
    mt: g('top'),
    mb: g('bottom'),
    ml: g('left'),
    mr: g('right'),
    hd: g('header'),
    fd: g('footer'),
    cw: W_ - g('left') - g('right'),
    titel: !!(sp && kid(sp, NW, 'titlePg')),
  };
}

/** Tekent alle pagina's in `host`. */
export function tekenVoorbeeld(host: HTMLElement, res: Opbouw, base: Basis, opts: { marks: boolean; sel: string | null }): void {
  const doc = res.doc;
  const pg = paginaMaten(doc);
  const T: Teken = { base, pg };
  const blokken: string[] = [];
  const body = bodyVan(doc);
  for (const n of body.childNodes) {
    if (n.nodeType !== 1) continue;
    const e = n as Element;
    if (e.localName === 'p') blokken.push(tekenP(T, e, base.rels, res.nieuweRels, {}));
    else if (e.localName === 'tbl') blokken.push(tekenTbl(T, e, base.rels, res.nieuweRels));
    else if (e.localName === 'sdt') {
      const c = kid(e, NW, 'sdtContent');
      if (c)
        for (const x of c.childNodes)
          if (x.nodeType === 1 && (x as Element).localName === 'p') blokken.push(tekenP(T, x as Element, base.rels, res.nieuweRels, {}));
    }
  }
  const st = base.st;
  const nid0 = standaardStijl(st);
  const bf = (nid0 && st.s[nid0].font) || st.def.font || 'Calibri';
  const bs = ((nid0 && st.s[nid0].sz) || st.def.sz || 22) / 2;
  host.style.setProperty('--syf', `'${bf}'`);
  host.style.setProperty('--sys', bs + 'pt');

  // meten
  const meet = document.createElement('div');
  meet.className = 'sy-doc';
  meet.style.cssText = `position:absolute;visibility:hidden;left:-99999px;top:0;width:${pg.cw}px;--syf:'${bf}';--sys:${bs}pt`;
  meet.innerHTML = blokken.join('');
  document.body.appendChild(meet);
  const els = [...meet.children] as HTMLElement[];
  const pagina: string[][] = [[]];
  let y = 0;
  const H = pg.h - pg.mt - pg.mb - 6;
  for (const e of els) {
    const eerste = e.firstElementChild;
    const breekVoor = !!eerste && eerste.classList.contains('pbrk') && !(e.textContent || '').replace(/​/g, '').trim();
    const cs = getComputedStyle(e);
    const hgt = e.offsetHeight + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
    if (breekVoor && pagina[pagina.length - 1].length) {
      pagina.push([]);
      y = 0;
    }
    if (y + hgt > H && pagina[pagina.length - 1].length) {
      pagina.push([]);
      y = 0;
    }
    pagina[pagina.length - 1].push(e.outerHTML);
    y += hgt;
    if (!breekVoor && e.querySelector('.pbrk')) {
      pagina.push([]);
      y = 0;
    }
  }
  meet.remove();
  const kop = (k: string) => tekenDeel(T, (k === 'first' && pg.titel ? base.hdr.first : null) || base.hdr.default);
  const voet = (k: string) => tekenDeel(T, (k === 'first' && pg.titel ? base.ftr.first : null) || base.ftr.default);
  const N = pagina.length;
  host.innerHTML = pagina
    .map(
      (inh, i) =>
        `<div class="sy-page" style="width:${pg.w}px;height:${pg.h}px"><div class="sy-hdr" style="top:${pg.hd}px;left:${pg.ml}px;width:${pg.cw}px">${kop(i ? 'default' : 'first')}</div><div class="sy-doc sy-body" style="top:${pg.mt}px;left:${pg.ml}px;width:${pg.cw}px;height:${H}px">${inh.join('')}</div><div class="sy-ftr" style="bottom:${pg.fd}px;left:${pg.ml}px;width:${pg.cw}px">${voet(i ? 'default' : 'first')}</div><div class="sy-pnr">${i + 1} / ${N}</div></div>`,
    )
    .join('');
  host.querySelectorAll('.sy-page').forEach((p, i) => {
    p.querySelectorAll('.pg').forEach((x) => (x.textContent = String(i + 1)));
    p.querySelectorAll('.pgs').forEach((x) => (x.textContent = String(N)));
  });
  host.querySelectorAll<HTMLElement>('.anc[data-pt]').forEach((a) => {
    const pr = a.closest<HTMLElement>('.wp');
    a.style.top = +(a.dataset.pt || 0) - (pr ? pr.offsetTop : 0) + 'px';
  });
  host.classList.toggle('nomark', !opts.marks);
  if (opts.sel) host.querySelector(`[data-syk="${CSS.escape(opts.sel)}"]`)?.classList.add('sel');
}

