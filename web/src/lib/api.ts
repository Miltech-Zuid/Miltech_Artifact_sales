import type { CollectionName, ConfigKey } from './types';

export class ApiFout extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function check(res: Response): Promise<Response> {
  if (res.ok) return res;
  let code = 'http_' + res.status;
  let message = res.statusText || 'Verzoek mislukt';
  try {
    const j = (await res.json()) as { error?: { code?: string; message?: string } };
    if (j.error?.code) code = j.error.code;
    if (j.error?.message) message = j.error.message;
  } catch {
    /* geen JSON-foutbericht */
  }
  throw new ApiFout(code, message);
}

const jsonHeaders = { 'content-type': 'application/json' };

export const api = {
  async status(): Promise<{ claude: boolean; model: string; version: string }> {
    return (await check(await fetch('/api/status'))).json();
  },
  async set(col: CollectionName, id: string, data: unknown): Promise<void> {
    await check(
      await fetch(`/api/db/${col}/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify(data),
      }),
    );
  },
  async del(col: CollectionName, id: string): Promise<void> {
    await check(await fetch(`/api/db/${col}/${encodeURIComponent(id)}`, { method: 'DELETE' }));
  },
  async setConfig(key: ConfigKey, value: unknown): Promise<void> {
    await check(
      await fetch(`/api/config/${key}`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(value) }),
    );
  },
  async upload(blob: Blob): Promise<{ id: string }> {
    const res = await fetch('/api/assets', {
      method: 'POST',
      headers: { 'content-type': blob.type || 'application/octet-stream' },
      body: blob,
    });
    return (await check(res)).json();
  },
  async asset(id: string): Promise<Response> {
    return check(await fetch(`/api/assets/${encodeURIComponent(id)}`));
  },
  async assetJson<T>(id: string): Promise<T> {
    return (await api.asset(id)).json() as Promise<T>;
  },
};
