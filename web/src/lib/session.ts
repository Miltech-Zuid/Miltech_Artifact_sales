import { useSyncExternalStore } from 'react';
import { lsGet, lsSet } from './utils';

/** Wie achter deze browser zit (gekozen uit het team, bewaard per browser). */
let me = lsGet('ms-me') || '';
const luisteraars = new Set<() => void>();

export function getMe(): string {
  return me;
}

export function setMe(naam: string): void {
  me = naam;
  lsSet('ms-me', naam);
  luisteraars.forEach((l) => l());
}

export function useMe(): string {
  return useSyncExternalStore(
    (l) => {
      luisteraars.add(l);
      return () => luisteraars.delete(l);
    },
    () => me,
  );
}
