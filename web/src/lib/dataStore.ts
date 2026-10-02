import { useSyncExternalStore } from 'react';
import { api, ApiFout } from './api';
import { STANDAARD_TEAM } from './constants';
import { toast } from './toast';
import type { CollectionName, ConfigKey, DataState } from './types';

/**
 * Gedeelde gegevens. De server stuurt via Server-Sent Events bij elke wijziging
 * de volledige collectie; lokale wijzigingen worden direct (optimistisch) getoond.
 */
let state: DataState = {
  leads: [],
  prospects: [],
  klanten: [],
  opdrachten: [],
  syntess: [],
  team: STANDAARD_TEAM,
  dagstart: null,
  kennis: null,
  bibliotheek: null,
  conn: 'wacht',
  claude: false,
};

const luisteraars = new Set<() => void>();
const naCollectie = new Map<string, Set<() => void>>();

function zet(patch: Partial<DataState>) {
  state = { ...state, ...patch };
  luisteraars.forEach((l) => l());
}

export function getData(): DataState {
  return state;
}

export function useData(): DataState {
  return useSyncExternalStore(
    (l) => {
      luisteraars.add(l);
      return () => luisteraars.delete(l);
    },
    () => state,
  );
}

/** Luistert naar elke wijziging in de gegevens (buiten React). */
export function abonneer(cb: () => void): () => void {
  luisteraars.add(cb);
  return () => luisteraars.delete(cb);
}

/** Callback na elke update van een collectie vanaf de server. */
export function bijUpdate(col: CollectionName, cb: () => void): () => void {
  if (!naCollectie.has(col)) naCollectie.set(col, new Set());
  naCollectie.get(col)!.add(cb);
  return () => naCollectie.get(col)!.delete(cb);
}

type ServerEvent =
  | { type: 'collection'; name: CollectionName; docs: unknown[] }
  | { type: 'config'; key: ConfigKey; value: Record<string, unknown> };

function verwerk(ev: ServerEvent) {
  if (ev.type === 'collection') {
    zet({ [ev.name]: ev.docs } as Partial<DataState>);
    naCollectie.get(ev.name)?.forEach((cb) => cb());
    return;
  }
  const v = ev.value;
  if (!v) return;
  if (ev.key === 'team') {
    const namen = (v as { namen?: unknown }).namen;
    if (Array.isArray(namen) && namen.length) zet({ team: namen.map(String) });
  } else if (ev.key === 'dagstart') {
    if ((v as { text?: string }).text) zet({ dagstart: v as unknown as DataState['dagstart'] });
  } else if (ev.key === 'kennis') {
    zet({ kennis: v as DataState['kennis'] });
  } else if (ev.key === 'bibliotheek') {
    zet({ bibliotheek: v as unknown as DataState['bibliotheek'] });
  }
}

let bron: EventSource | null = null;

export function verbind(): void {
  if (bron) return;
  api
    .status()
    .then((s) => zet({ claude: !!s.claude }))
    .catch(() => zet({ claude: false }));
  bron = new EventSource('/api/events');
  bron.onopen = () => zet({ conn: 'live' });
  bron.onerror = () => zet({ conn: 'offline' });
  bron.onmessage = (m) => {
    try {
      verwerk(JSON.parse(m.data) as ServerEvent);
      if (state.conn !== 'live') zet({ conn: 'live' });
    } catch {
      /* onbekend bericht negeren */
    }
  };
}

function foutTekst(e: unknown): string {
  if (e instanceof ApiFout && e.code === 'invalid_argument') return 'Opslaan geweigerd: ' + e.message;
  return 'Opslaan mislukt, probeer het opnieuw';
}

/** Document opslaan (vervangt het geheel). Geeft true bij succes. */
export async function bewaar(col: CollectionName, id: string, data: object): Promise<boolean> {
  const vorige = state[col] as unknown as Array<{ id: string }>;
  const obj = { ...(data as Record<string, unknown>), id };
  const i = vorige.findIndex((x) => x.id === id);
  const nieuw = i >= 0 ? vorige.map((x, j) => (j === i ? obj : x)) : [...vorige, obj];
  zet({ [col]: nieuw } as Partial<DataState>);
  try {
    await api.set(col, id, data);
    return true;
  } catch (e) {
    zet({ [col]: vorige } as Partial<DataState>);
    toast(foutTekst(e));
    return false;
  }
}

export async function verwijder(col: CollectionName, id: string): Promise<boolean> {
  const vorige = state[col] as unknown as Array<{ id: string }>;
  zet({ [col]: vorige.filter((x) => x.id !== id) } as Partial<DataState>);
  try {
    await api.del(col, id);
    return true;
  } catch {
    zet({ [col]: vorige } as Partial<DataState>);
    toast('Verwijderen mislukt');
    return false;
  }
}

export async function bewaarConfig(key: ConfigKey, value: object): Promise<boolean> {
  try {
    await api.setConfig(key, value);
    verwerk({ type: 'config', key, value: value as Record<string, unknown> });
    return true;
  } catch (e) {
    toast(foutTekst(e));
    return false;
  }
}
