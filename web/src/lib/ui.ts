import { useSyncExternalStore } from 'react';
import { VIEW_IDS } from './constants';
import type { Lead, ViewId } from './types';
import { lsGet, lsSet } from './utils';

/** Concept-dossier in de lade: nog zonder id als het een nieuwe lead is. */
export type LeadConcept = Partial<Lead> & Pick<Lead, 'fase' | 'log'> & { _pid?: string };

export type Lade = { soort: 'lead'; lead: LeadConcept; key: number } | { soort: 'plak'; key: number } | null;

interface UiState {
  view: ViewId;
  lade: Lade;
  sector: string | null;
}

function startView(): ViewId {
  let v = (location.hash || '').replace('#', '') || lsGet('ms-view') || 'overzicht';
  if (v === 'calculatie') v = 'syntess';
  return (VIEW_IDS as string[]).includes(v) ? (v as ViewId) : 'overzicht';
}

let ui: UiState = { view: startView(), lade: null, sector: null };
const luisteraars = new Set<() => void>();
let teller = 0;

function zet(p: Partial<UiState>) {
  ui = { ...ui, ...p };
  luisteraars.forEach((l) => l());
}

export function useUi(): UiState {
  return useSyncExternalStore(
    (l) => {
      luisteraars.add(l);
      return () => luisteraars.delete(l);
    },
    () => ui,
  );
}

export function gaNaar(view: ViewId, sector?: string): void {
  lsSet('ms-view', view);
  try {
    history.replaceState(null, '', '#' + view);
  } catch {
    /* geen history */
  }
  zet({ view, ...(sector ? { sector } : {}) });
  window.scrollTo({ top: 0 });
}

export function kiesSector(sector: string | null): void {
  zet({ sector });
}

export function openLade(lead: LeadConcept): void {
  zet({ lade: { soort: 'lead', lead: JSON.parse(JSON.stringify(lead)), key: ++teller } });
}

export function openPlak(): void {
  zet({ lade: { soort: 'plak', key: ++teller } });
}

export function sluitLade(): void {
  zet({ lade: null });
}

window.addEventListener('hashchange', () => {
  const v = startView();
  if (v !== ui.view) zet({ view: v });
});
