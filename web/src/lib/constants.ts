import type { FaseId, ViewId } from './types';

export interface Fase {
  id: FaseId;
  n: string;
  k: string;
  p: number;
}

export const FASEN: Fase[] = [
  { id: 'lead', n: 'Lead', k: '#9085e9', p: 10 },
  { id: 'aanvraag', n: 'Aanvraag', k: '#5aa0f0', p: 25 },
  { id: 'bezoek', n: 'Bezoek / inmeten', k: '#2bb6a3', p: 40 },
  { id: 'offerte', n: 'Offerte uit', k: '#fab219', p: 50 },
  { id: 'onderhandeling', n: 'Onderhandeling', k: '#e0773a', p: 70 },
  { id: 'gewonnen', n: 'Gewonnen', k: '#5fd35f', p: 100 },
  { id: 'verloren', n: 'Verloren', k: '#e05252', p: 0 },
];

export const OPEN: FaseId[] = ['lead', 'aanvraag', 'bezoek', 'offerte', 'onderhandeling'];

export const FASE = Object.fromEntries(FASEN.map((f) => [f.id, f])) as Record<FaseId, Fase>;

export function faseVan(id: string | undefined): Fase {
  return (id && FASE[id as FaseId]) || FASE.lead;
}

export interface Sector {
  id: string;
  n: string;
  k: string;
}

export const SECTOREN: Sector[] = [
  { id: 'metaal', n: 'Metaal & lastechniek', k: '#5aa0f0' },
  { id: 'hout', n: 'Hout & meubel', k: '#c9a26b' },
  { id: 'voeding', n: 'Voeding & zuivel', k: '#f0c05a' },
  { id: 'chemie', n: 'Chemie, verf & coatings', k: '#9085e9' },
  { id: 'kunststof', n: 'Kunststof & rubber', k: '#2bb6a3' },
  { id: 'recycling', n: 'Recycling & afval', k: '#7ab35a' },
  { id: 'verpakking', n: 'Verpakking & drukwerk', k: '#d98b5f' },
  { id: 'bouwmat', n: 'Bouwmaterialen & steen', k: '#b5a48a' },
  { id: 'machinebouw', n: 'Machinebouw & OEM', k: '#6fa8dc' },
  { id: 'voertuigen', n: 'Voertuigen & testruimtes', k: '#e0773a' },
  { id: 'farma', n: 'Farma & laboratoria', k: '#c983d9' },
  { id: 'onderwijs', n: 'Onderwijs & praktijklokalen', k: '#8fc3a9' },
];

export const SEC: Record<string, Sector> = Object.fromEntries(SECTOREN.map((s) => [s.id, s]));

export const BRONNEN = ['', 'Telefoon', 'E-mail', 'Website', 'Bestaande klant', 'Beurs', 'Netwerk', 'Prospectie', 'Onderhoud', 'Syntess'];

export const PROSPECT_STATUS = ['nieuw', 'te verifiëren', 'benaderd', 'lead', 'afgevallen'] as const;

export const STANDAARD_TEAM = ['Tycho', 'Tim'];

export const CONTEXT =
  'Je bent de sales-assistent van Miltech Zuid Nederland B.V. Schrijf in het Nederlands, zakelijk en direct. Gebruik alleen de gegevens die je hieronder krijgt. Verzin geen feiten, namen, producten, referenties, prijzen of afspraken.';

export const VIEWS: Record<ViewId, { n: string; k: string; dot: string }> = {
  overzicht: { n: 'Overzicht', k: 'Sales · vandaag', dot: '#3987e5' },
  pipeline: { n: 'Pipeline', k: 'Leads, aanvragen en offertes', dot: '#fab219' },
  prospects: { n: 'Nieuwe klanten', k: 'Prospects per sector', dot: '#2bb6a3' },
  syntess: { n: 'Offerte uit Syntess', k: 'Syntess-export aanvullen in Miltech-huisstijl', dot: '#5fd35f' },
  klanten: { n: 'Klantbestand', k: 'Wie al klant is', dot: '#9085e9' },
};

export const VIEW_IDS = Object.keys(VIEWS) as ViewId[];

export const CONTROL_URL: string = import.meta.env.VITE_CONTROL_URL ?? '';
