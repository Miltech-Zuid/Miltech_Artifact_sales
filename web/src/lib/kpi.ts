import { FASE, OPEN } from './constants';
import type { Klant, Lead } from './types';
import { dagenSinds, dagenTot, laatsteContact, norm } from './utils';

export interface Kpi {
  L: Lead[];
  open: Lead[];
  waarde: number;
  gewogen: number;
  off: Lead[];
  laat: Lead[];
  nu: Lead[];
  zonder: Lead[];
  stil: Lead[];
  won: Lead[];
  lost: Lead[];
  wonW: number;
  hit: number | null;
}

export function kpi(L: Lead[]): Kpi {
  const open = L.filter((l) => OPEN.includes(l.fase));
  const waarde = open.reduce((a, l) => a + (+(l.waarde ?? 0) || 0), 0);
  const gewogen = open.reduce(
    (a, l) => a + (+(l.waarde ?? 0) || 0) * ((l.kans != null ? +l.kans : FASE[l.fase].p) / 100),
    0,
  );
  const off = open.filter((l) => l.fase === 'offerte' || l.fase === 'onderhandeling');
  const laat = open.filter((l) => l.volgendeDatum && (dagenTot(l.volgendeDatum) ?? 0) < 0);
  const nu = open.filter((l) => l.volgendeDatum && dagenTot(l.volgendeDatum) === 0);
  const zonder = open.filter((l) => !l.volgendeDatum);
  const stil = off.filter((l) => {
    const s = dagenSinds(laatsteContact(l));
    return s != null && s >= 10;
  });
  const jaar = String(new Date().getFullYear());
  const won = L.filter((l) => l.fase === 'gewonnen' && String(l.gesloten || '').startsWith(jaar));
  const lost = L.filter((l) => l.fase === 'verloren' && String(l.gesloten || '').startsWith(jaar));
  return {
    L,
    open,
    waarde,
    gewogen,
    off,
    laat,
    nu,
    zonder,
    stil,
    won,
    lost,
    wonW: won.reduce((a, l) => a + (+(l.waarde ?? 0) || 0), 0),
    hit: won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : null,
  };
}

export function isKlant(naam: string, klanten: Klant[]): Klant | null {
  const n = norm(naam);
  if (!n) return null;
  return (
    klanten.find((k) => {
      const m = norm(k.naam);
      return m && (m === n || (m.length > 4 && n.includes(m)) || (n.length > 4 && m.includes(n)));
    }) || null
  );
}

export function somWaarde(L: Lead[]): number {
  return L.reduce((a, l) => a + (+(l.waarde ?? 0) || 0), 0);
}
