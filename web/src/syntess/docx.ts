/* Inlezen en wegschrijven van .docx-bestanden (JSZip). */
import JSZip from 'jszip';
import { NCT, NPR, NR, NW, alle, b64ToBytes, bodyVan, kids, parseXml, leesStijlen, wv } from './ooxml';
import type { Basis, Deel, Opbouw, Rels } from './types';

let baseUrls: string[] = [];

async function relsVan(zip: JSZip, p: string): Promise<Rels> {
  const f = zip.file(p);
  const m: Rels = {};
  if (!f) return m;
  const d = parseXml(await f.async('string'));
  for (const r of alle(d, NPR, 'Relationship'))
    m[r.getAttribute('Id') || ''] = {
      target: r.getAttribute('Target') || '',
      type: r.getAttribute('Type') || '',
      ext: r.getAttribute('TargetMode') === 'External',
    };
  return m;
}

/** Leest een Syntess-export in: document, stijlen, relaties, media, kop- en voetteksten. */
export async function leesBasis(buf: ArrayBuffer, naam: string): Promise<Basis> {
  const zip = await JSZip.loadAsync(buf);
  const docFile = zip.file('word/document.xml');
  if (!docFile) throw new Error('Geen word/document.xml in dit bestand');
  const xml = await docFile.async('string');
  const stFile = zip.file('word/styles.xml');
  const st = leesStijlen(stFile ? await stFile.async('string') : '');
  const rels = await relsVan(zip, 'word/_rels/document.xml.rels');

  // media als blob-URL's voor de voorbeeldweergave
  for (const u of baseUrls) URL.revokeObjectURL(u);
  baseUrls = [];
  const media: Record<string, string> = {};
  for (const f of Object.keys(zip.files).filter((p) => /^word\/media\//.test(p))) {
    const ext = (f.split('.').pop() || '').toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg'].includes(ext)) continue;
    const b = await zip.file(f)!.async('blob');
    const u = URL.createObjectURL(ext === 'svg' ? new Blob([b], { type: 'image/svg+xml' }) : b);
    baseUrls.push(u);
    media[f] = u;
  }

  const d = parseXml(xml);
  const sp = alle(d, NW, 'sectPr').pop();
  const kv = async (type: 'header' | 'footer'): Promise<Record<string, Deel>> => {
    const out: Record<string, Deel> = {};
    if (!sp) return out;
    for (const r of kids(sp, NW, type + 'Reference')) {
      const t = rels[r.getAttributeNS(NR, 'id') || ''];
      if (!t) continue;
      const p = 'word/' + t.target;
      const f = zip.file(p);
      if (!f) continue;
      out[wv(r, 'type') || 'default'] = {
        xml: await f.async('string'),
        rels: await relsVan(zip, 'word/_rels/' + t.target.split('/').pop() + '.rels'),
      };
    }
    return out;
  };
  return { naam, xml, st, rels, media, hdr: await kv('header'), ftr: await kv('footer') };
}

export class ExportFout extends Error {}

/**
 * Schrijft het aangevulde document weg. Controleert eerst dat alle originele
 * onderdelen ongewijzigd en in dezelfde volgorde in het resultaat staan.
 */
export async function maakDocx(buf: ArrayBuffer, origXml: string, res: Opbouw): Promise<{ blob: Blob; onderdelen: number }> {
  const zip = await JSZip.loadAsync(buf);
  const ser = new XMLSerializer();
  const org = parseXml(origXml);
  const A = kids(bodyVan(org), NW, null).map((n) => ser.serializeToString(n));
  const Bn = kids(bodyVan(res.doc), NW, null).map((n) => ser.serializeToString(n));
  let k = 0;
  let mis = 0;
  for (const x of A) {
    const j = Bn.indexOf(x, k);
    if (j < 0) mis++;
    else k = j + 1;
  }
  if (mis) throw new ExportFout(`Gestopt: ${mis} originele onderdelen zouden wijzigen`);

  zip.file('word/document.xml', ser.serializeToString(res.doc));
  const relP = 'word/_rels/document.xml.rels';
  const rd = parseXml(await zip.file(relP)!.async('string'));
  const ctP = '[Content_Types].xml';
  const cd = parseXml(await zip.file(ctP)!.async('string'));
  const defs = new Set(alle(cd, NCT, 'Default').map((d) => (d.getAttribute('Extension') || '').toLowerCase()));
  for (const [id, r] of Object.entries(res.nieuweRels)) {
    zip.file('word/' + r.pad, b64ToBytes(r.b64));
    const e = rd.createElementNS(NPR, 'Relationship');
    e.setAttribute('Id', id);
    e.setAttribute('Type', r.reltype);
    e.setAttribute('Target', r.pad);
    rd.documentElement.appendChild(e);
    const ext = r.ext.toLowerCase();
    if (/^image\//.test(r.ctype) && !defs.has(ext)) {
      const d = cd.createElementNS(NCT, 'Default');
      d.setAttribute('Extension', ext);
      d.setAttribute('ContentType', r.ctype);
      cd.documentElement.insertBefore(d, cd.documentElement.firstChild);
      defs.add(ext);
    } else if (!/^image\//.test(r.ctype)) {
      const o = cd.createElementNS(NCT, 'Override');
      o.setAttribute('PartName', '/word/' + r.pad);
      o.setAttribute('ContentType', r.ctype);
      cd.documentElement.appendChild(o);
    }
  }
  zip.file(relP, ser.serializeToString(rd));
  zip.file(ctP, ser.serializeToString(cd));
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });
  return { blob, onderdelen: A.length };
}
