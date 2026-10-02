import type { Artikel } from './analyse';
import type { RelPart } from './library';
import type { Stijlen } from './ooxml';

export interface Rel {
  target: string;
  type: string;
  ext: boolean;
}

export type Rels = Record<string, Rel>;

export interface Deel {
  xml: string;
  rels: Rels;
}

/** Ingelezen Syntess-export. */
export interface Basis {
  naam: string;
  xml: string;
  st: Stijlen;
  rels: Rels;
  media: Record<string, string>;
  hdr: Record<string, Deel>;
  ftr: Record<string, Deel>;
}

export interface NieuweRel extends RelPart {
  pad: string;
}

export interface Rapport {
  ingevoegd: string[];
  overgeslagen: string[];
  inleiding: string;
}

/** Resultaat van de opbouw: nieuw document + rapport + nieuwe relaties (afbeeldingen). */
export interface Opbouw {
  doc: Document;
  arts: Artikel[];
  rap: Rapport;
  nieuweRels: Record<string, NieuweRel>;
}
