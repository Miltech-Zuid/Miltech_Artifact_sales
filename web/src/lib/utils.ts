import type { Lead } from './types';

const pad = (n: number) => String(n).padStart(2, '0');
const isoVan = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function vandaag(): string {
  return isoVan(new Date());
}

export function plusDagen(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return isoVan(d);
}

export function dagenTot(iso?: string | null): number | null {
  if (!iso) return null;
  const a = new Date(vandaag() + 'T00:00:00');
  const b = new Date(iso + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / 864e5);
}

export function dagenSinds(iso?: string | null): number | null {
  const n = dagenTot(iso);
  return n == null ? null : -n;
}

export const eur = (n?: number | null) => '€ ' + Math.round(n || 0).toLocaleString('nl-NL');

export const eurK = (n?: number | null) => {
  const v = n || 0;
  if (v >= 1e6) return '€ ' + (v / 1e6).toLocaleString('nl-NL', { maximumFractionDigits: 2 }) + ' mln';
  if (v >= 1e4) return '€ ' + Math.round(v / 1e3).toLocaleString('nl-NL') + 'k';
  return eur(v);
};

export const esc = (s: unknown) =>
  String(s == null ? '' : s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

export const datumNL = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
};

export const nid = (p: string) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const norm = (s: unknown) =>
  String(s || '')
    .toLowerCase()
    .replace(/\b(b\.?v\.?|n\.?v\.?|bv|nv|holding|nederland|netherlands|europe|international)\b/g, '')
    .replace(/[^a-z0-9]/g, '');

export function lsGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

export function lsSet(k: string, v: string): void {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* opslag niet beschikbaar: negeren */
  }
}

export function laatsteContact(l: Lead): string | null {
  const ds = (l.log || []).map((x) => x.d).filter(Boolean).sort();
  return ds.length ? ds[ds.length - 1] : l.aangemaakt || null;
}

export function initialen(n?: string): string {
  return (
    String(n || '?')
      .trim()
      .split(/\s+/)
      .map((x) => x[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  );
}

/** Zeer beperkte markdown (vet + opsommingen) naar veilige HTML. */
export function mdLite(t: string): string {
  const lines = esc(t)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .split(/\n/);
  let out = '';
  let inList = false;
  for (const raw of lines) {
    const l = raw.trim();
    if (/^([-•*]|\d+[.)])\s+/.test(l)) {
      if (!inList) {
        out += '<ul>';
        inList = true;
      }
      out += '<li>' + l.replace(/^([-•*]|\d+[.)])\s+/, '') + '</li>';
    } else {
      if (inList) {
        out += '</ul>';
        inList = false;
      }
      if (l) out += '<p>' + l.replace(/^#+\s*/, '') + '</p>';
    }
  }
  if (inList) out += '</ul>';
  return out;
}

export function zonderId<T extends { id: string }>(o: T): Omit<T, 'id'> {
  const c: Partial<T> = { ...o };
  delete c.id;
  return c as Omit<T, 'id'>;
}

export function kloon<T>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}

export function begroeting(me: string): string {
  const h = new Date().getHours();
  const g = h < 12 ? 'Goedemorgen' : h < 18 ? 'Goedemiddag' : 'Goedenavond';
  return g + (me ? ', ' + me : '');
}

export function downloadBlob(naam: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = naam;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
