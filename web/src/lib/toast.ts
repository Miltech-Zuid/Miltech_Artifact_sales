import { useSyncExternalStore } from 'react';

let bericht: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const luisteraars = new Set<() => void>();

function meld() {
  luisteraars.forEach((l) => l());
}

/** Toont kort een melding onderin het scherm. */
export function toast(msg: string): void {
  bericht = msg;
  clearTimeout(timer);
  timer = setTimeout(() => {
    bericht = null;
    meld();
  }, 2600);
  meld();
}

export function useToast(): string | null {
  return useSyncExternalStore(
    (l) => {
      luisteraars.add(l);
      return () => luisteraars.delete(l);
    },
    () => bericht,
  );
}
