/* Koppeling offerte-tool -> pipeline: elke offerte loopt mee als dossier. */
import { FASE, OPEN } from '../lib/constants';
import { bewaar, getData } from '../lib/dataStore';
import { getMe } from '../lib/session';
import type { FaseId, Lead, SyntessOfferte } from '../lib/types';
import { eur, kloon, nid, norm, plusDagen, vandaag } from '../lib/utils';
import { alleTeksten } from './analyse';
import { nrm } from './ooxml';

export interface OfferteGegevens {
  klant: string;
  contact: string;
  plaats: string;
  ref: string;
  datum: string;
  betreft: string;
  waarde: number;
  eigenaar: string;
}

export function offerteGegevens(doc: Document): OfferteGegevens {
  const T = alleTeksten(doc);
  const j = T.join(' ');
  const ti = T.findIndex((t) => /^t\.?a\.?v\.?\s/i.test(t));
  const klant = ti > 0 ? T[ti - 1] : '';
  const contact =
    ti >= 0
      ? T[ti]
          .replace(/^t\.?a\.?v\.?\s*/i, '')
          .replace(/^(de heer|mevrouw|dhr\.?|mevr\.?)\s+/i, '')
          .trim()
      : '';
  const pc = ti >= 0 ? T.slice(ti + 1, ti + 4).find((t) => /^\d{4}\s?[A-Z]{2}\b/.test(t)) : '';
  const plaats = pc ? pc.replace(/^\d{4}\s?[A-Z]{2}\s*/, '').trim() : '';
  const ref = (j.match(/TD\d{6}[.-]\d+[A-Z]?/) || [''])[0];
  const dm = j.match(/[A-Z][a-zë-]+,\s*(\d{1,2})-(\d{1,2})-(\d{4})/);
  const datum = dm ? `${dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}` : '';
  const lm = T.findIndex((t) => /levering en montage van;\s*$/.test(t));
  const betreft = lm >= 0 ? T[lm + 1] || '' : '';
  const bedragNa = (re: RegExp): number | null => {
    const i = T.findIndex((t) => re.test(nrm(t)));
    if (i < 0) return null;
    for (const t of T.slice(i, i + 3)) {
      const m = t.replace(/\s+/g, ' ').match(/€\s*([\d.]+),(\d{2}|-)/);
      if (m) return +(m[1].replace(/\./g, '') + (m[2] === '-' ? '' : '.' + m[2]));
    }
    return null;
  };
  const waarde = bedragNa(/^speciale projectprijs/) ?? bedragNa(/^totaalprijs voor het leveren/) ?? bedragNa(/^totale investering/) ?? 0;
  const g = T.findIndex((t) => /^met vriendelijke groet/i.test(t));
  const sig = g >= 0 ? T.slice(g + 1, g + 7) : [];
  const pl = sig.find((t) => !t.includes('@') && !/^(mob|tel|miltech)/i.test(t)) || '';
  const voor = pl.split(/\s+/)[0] || '';
  const eigenaar = getData().team.find((x) => nrm(x) === nrm(voor)) || getMe() || '';
  return { klant, contact, plaats, ref, datum, betreft, waarde, eigenaar };
}

function zoekLeadVoor(g: OfferteGegevens): Lead | null {
  const leads = getData().leads;
  const r = (x?: string) => String(x || '').replace(/^TD/i, '');
  return (
    (g.ref && leads.find((x) => r(x.offertenr) === r(g.ref))) ||
    (g.klant && leads.find((x) => OPEN.includes(x.fase) && norm(x.bedrijf) === norm(g.klant))) ||
    null
  );
}

export type PipelineActie = 'upload' | 'export' | 'verstuurd';

/** Maakt of werkt het dossier bij. Geeft het lead-id terug (of null). */
export async function syPipeline(c: SyntessOfferte, doc: Document, actie: PipelineActie): Promise<string | null> {
  const g = offerteGegevens(doc);
  const leads = getData().leads;
  let l = c.leadId ? leads.find((x) => x.id === c.leadId) || null : null;
  if (!l) l = zoekLeadVoor(g);
  const nu = vandaag();
  const w = getMe();
  const vroeg: FaseId[] = ['lead', 'aanvraag', 'bezoek'];
  let n: Omit<Lead, 'id'>;
  if (l) {
    const k = kloon(l) as Partial<Lead>;
    delete k.id;
    n = k as Omit<Lead, 'id'>;
  } else {
    n = {
      fase: 'aanvraag',
      bedrijf: g.klant || c.naam,
      contact: g.contact,
      plaats: g.plaats,
      email: '',
      tel: '',
      omschrijving: g.betreft,
      sector: '',
      eigenaar: g.eigenaar,
      waarde: 0,
      kans: FASE.aanvraag.p,
      offertenr: '',
      bron: 'Syntess',
      volgendeActie: '',
      volgendeDatum: '',
      aangemaakt: nu,
      log: [{ d: nu, t: `Dossier aangemaakt vanuit offerte ${g.ref || c.bestand} (offerte-tool)`, w }],
    };
  }
  n.log = n.log || [];
  n.syntessId = c.id;
  if (g.ref) n.offertenr = g.ref;
  if (g.waarde) n.waarde = Math.round(g.waarde);
  if (!n.contact && g.contact) n.contact = g.contact;
  if (!n.plaats && g.plaats) n.plaats = g.plaats;
  if (!n.eigenaar && g.eigenaar) n.eigenaar = g.eigenaar;
  if (!n.omschrijving) n.omschrijving = g.betreft;
  if (actie === 'upload') {
    if (vroeg.includes(n.fase)) {
      if (n.fase === 'lead') {
        n.fase = 'aanvraag';
        n.kans = Math.max(+(n.kans ?? 0) || 0, FASE.aanvraag.p);
      }
      n.volgendeActie = 'Offerte afmaken in de offerte-tool';
      n.volgendeDatum = plusDagen(2);
    }
    if (l) n.log.push({ d: nu, t: `Offerte ${g.ref || ''} uit Syntess geüpload in de offerte-tool`, w });
  }
  if (actie === 'export') n.log.push({ d: nu, t: `Offerte ${g.ref || ''} aangevuld in huisstijl, Word gedownload`, w });
  if (actie === 'verstuurd') {
    if (vroeg.includes(n.fase)) n.fase = 'offerte';
    n.kans = Math.max(+(n.kans ?? 0) || 0, FASE.offerte.p);
    n.offerteDatum = g.datum || nu;
    n.log.push({ d: nu, t: `Offerte ${g.ref || ''} verstuurd: ${eur(n.waarde)} excl. btw`, w });
    n.volgendeActie = 'Offerte nabellen';
    n.volgendeDatum = plusDagen(7);
  }
  if (OPEN.includes(n.fase)) delete n.gesloten;
  n.gewijzigd = new Date().toISOString();
  const id = l ? l.id : nid('l');
  return (await bewaar('leads', id, n)) ? id : null;
}
