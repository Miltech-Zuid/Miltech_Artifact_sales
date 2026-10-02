export type FaseId = 'lead' | 'aanvraag' | 'bezoek' | 'offerte' | 'onderhandeling' | 'gewonnen' | 'verloren';

export type ViewId = 'overzicht' | 'pipeline' | 'prospects' | 'syntess' | 'klanten';

export type CollectionName = 'leads' | 'prospects' | 'klanten' | 'opdrachten' | 'syntess';

export type ConfigKey = 'team' | 'dagstart' | 'kennis' | 'bibliotheek';

export interface LogItem {
  d: string;
  t: string;
  w?: string;
}

export interface Lead {
  id: string;
  fase: FaseId;
  bedrijf: string;
  contact?: string;
  plaats?: string;
  email?: string;
  tel?: string;
  omschrijving?: string;
  sector?: string;
  eigenaar?: string;
  waarde?: number;
  kans?: number;
  offertenr?: string;
  bron?: string;
  volgendeActie?: string;
  volgendeDatum?: string;
  aangemaakt?: string;
  gewijzigd?: string;
  gesloten?: string;
  offerteDatum?: string;
  syntessId?: string;
  log: LogItem[];
}

export type ProspectStatus = 'nieuw' | 'te verifiëren' | 'benaderd' | 'lead' | 'afgevallen';

export interface Prospect {
  id: string;
  bedrijf: string;
  plaats?: string;
  sector?: string;
  bron?: string;
  signaal?: string;
  signaalDatum?: string;
  notitie?: string;
  status: ProspectStatus;
  geverifieerd?: boolean;
  toegevoegd?: string;
  door?: string;
}

export interface Klant {
  id: string;
  naam: string;
  plaats?: string;
  sector?: string;
}

export interface Opdracht {
  id: string;
  sector: string | null;
  regio: string;
  vraag: string;
  status: 'open' | 'klaar';
  resultaat?: string;
  aangemaakt: string;
  door?: string;
}

export interface ChatMsg {
  r: 'u' | 'c';
  t: string;
  wijz?: string;
}

export interface SyntessSamenvatting {
  artikelen: number;
  aangevuld: number;
  ref: string;
  klant: string;
}

export interface SyntessOfferte {
  id: string;
  naam: string;
  bestand: string;
  assetId: string;
  keuzes: Record<string, string>;
  eigen: Record<string, string>;
  inleiding: string;
  chat: ChatMsg[];
  opties: string[];
  gezien: Record<string, boolean>;
  status: 'concept' | 'klaar' | 'verstuurd';
  door: string;
  aangemaakt: string;
  gewijzigd: string;
  leadId?: string;
  samenvatting?: SyntessSamenvatting;
}

export interface Dagstart {
  text: string;
  at: string;
  door: string;
}

export interface Kennis {
  beschrijving?: string;
  instructies?: string;
  huisstijl?: string;
  werkwijze?: string;
  extra?: string;
  standaardteksten?: string;
  gesynchroniseerd?: string;
}

export interface BibliotheekMeta {
  assetId: string;
  kernId?: string;
  mediaIds?: string[];
  naam?: string;
  geimporteerd?: string;
}

export interface TeamConfig {
  namen: string[];
}

export interface DataState {
  leads: Lead[];
  prospects: Prospect[];
  klanten: Klant[];
  opdrachten: Opdracht[];
  syntess: SyntessOfferte[];
  team: string[];
  dagstart: Dagstart | null;
  kennis: Kennis | null;
  bibliotheek: BibliotheekMeta | null;
  conn: 'wacht' | 'live' | 'offline';
  claude: boolean;
}
