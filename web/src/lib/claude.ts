import { ApiFout } from './api';

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

export type ClaudeInput = string | Turn[];

function berichten(input: ClaudeInput): Turn[] {
  return typeof input === 'string' ? [{ role: 'user', content: input }] : input;
}

async function fout(res: Response): Promise<never> {
  let code = 'upstream_error';
  let msg = 'Claude gaf geen antwoord';
  try {
    const j = (await res.json()) as { error?: { code?: string; message?: string } };
    code = j.error?.code || code;
    msg = j.error?.message || msg;
  } catch {
    /* geen JSON */
  }
  if (res.status === 503) code = 'not_configured';
  throw new ApiFout(code, msg);
}

/** Gestreamd antwoord; onText krijgt telkens de tekst tot nu toe. */
export async function sample(
  input: ClaudeInput,
  opts: { onText?: (t: { text: string }) => void; maxTokens?: number } = {},
): Promise<{ text: string }> {
  const res = await fetch('/api/claude/stream', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: berichten(input), max_tokens: opts.maxTokens }),
  });
  if (!res.ok || !res.body) return fout(res);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n')) >= 0) {
      const regel = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!regel) continue;
      const j = JSON.parse(regel) as { t?: string; done?: boolean; text?: string; error?: { code: string; message: string } };
      if (j.error) throw new ApiFout(j.error.code, j.error.message);
      if (typeof j.t === 'string') {
        text += j.t;
        opts.onText?.({ text });
      }
      if (j.done && typeof j.text === 'string') text = j.text;
    }
  }
  return { text };
}

/** Haalt het eerste JSON-object uit een antwoord (ook als er toch tekst omheen staat). */
export function parseJson<T>(text: string): T {
  const t = text.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '');
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new ApiFout('bad_json', 'Geen JSON in het antwoord');
  return JSON.parse(t.slice(a, b + 1)) as T;
}

/** Antwoord als JSON-object. */
export async function sampleJson<T = Record<string, unknown>>(input: ClaudeInput, maxTokens?: number): Promise<T> {
  const res = await fetch('/api/claude/complete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: berichten(input), json: true, max_tokens: maxTokens }),
  });
  if (!res.ok) return fout(res);
  const j = (await res.json()) as { text: string };
  return parseJson<T>(j.text);
}

export function aiFout(e: unknown): string {
  const c = e instanceof ApiFout ? e.code : '';
  if (c === 'not_configured' || c === 'not_granted') return 'Claude is niet ingesteld op de server (ANTHROPIC_API_KEY).';
  if (c === 'rate_limited') return 'Even te veel vragen achter elkaar. Probeer het over een minuut opnieuw.';
  if (c === 'prompt_too_large') return 'Te veel gegevens voor één vraag.';
  return 'Claude gaf geen antwoord. Probeer het opnieuw.';
}
