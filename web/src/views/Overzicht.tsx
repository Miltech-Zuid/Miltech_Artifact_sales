import { useState } from 'react';
import { Spark, Spin } from '../components/Spark';
import { CONTEXT, FASE, OPEN, SEC } from '../lib/constants';
import { aiFout, sample } from '../lib/claude';
import { bewaarConfig, useData } from '../lib/dataStore';
import { somWaarde, type Kpi } from '../lib/kpi';
import { getMe, useMe } from '../lib/session';
import { toast } from '../lib/toast';
import type { Lead, Prospect } from '../lib/types';
import { gaNaar, openLade } from '../lib/ui';
import { dagenSinds, dagenTot, datumNL, eurK, laatsteContact, mdLite } from '../lib/utils';

export function pipelineVoorClaude(leads: Lead[]) {
  return leads
    .filter((l) => OPEN.includes(l.fase))
    .map((l) => ({
      bedrijf: l.bedrijf,
      fase: FASE[l.fase].n,
      waarde: l.waarde || 0,
      kans: l.kans,
      eigenaar: l.eigenaar || '',
      wat: l.omschrijving || '',
      volgendeActie: l.volgendeActie || '',
      volgendeDatum: l.volgendeDatum || '',
      dagenSindsContact: dagenSinds(laatsteContact(l)),
      laatsteNotitie: (l.log || []).slice(-1)[0]?.t || '',
    }));
}

function dagstartPrompt(leads: Lead[], prospects: Prospect[]): string {
  const me = getMe();
  const pl = pipelineVoorClaude(leads);
  const n = (s: string) => prospects.filter((p) => p.status === s).length;
  return `${CONTEXT}\n\nVandaag is het ${new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}. ${me ? 'Je praat met ' + me + '.' : ''}\n\nOpen dossiers (JSON):\n${JSON.stringify(pl)}\n\nProspects: ${n('nieuw')} nieuw, ${n('te verifiëren')} te verifiëren, ${n('benaderd')} benaderd.${pl.length ? '' : '\nEr zijn nog geen open dossiers; zeg dat eerlijk en verzin er geen.'}\n\nMaak een dagstart:\n1. De 3 tot 5 belangrijkste acties voor vandaag, elk met bedrijfsnaam en waarom (te laat, veel waarde, lang stil).\n2. Welke offertes stil liggen en wat de beste opvolging is.\n3. Eén concrete tip om de pipeline te vullen.\nMaximaal 170 woorden. Gebruik korte bullets die beginnen met "- " en zet bedrijfsnamen in **vet**. Geen inleiding.`;
}

interface TodoItem {
  l: Lead;
  k: string;
  t: string;
  x: string;
}

export function Overzicht({ K }: { K: Kpi }) {
  const d = useData();
  useMe();
  const [ai, setAi] = useState<{ busy: boolean; text: string } | null>(null);

  async function maakDagstart() {
    if (!d.claude) return;
    setAi({ busy: true, text: '' });
    try {
      const r = await sample(dagstartPrompt(d.leads, d.prospects), {
        onText: (u) => setAi({ busy: true, text: u.text }),
      });
      const me = getMe();
      await bewaarConfig('dagstart', { text: r.text, at: new Date().toISOString(), door: me ? 'voor ' + me : '' });
    } catch (e) {
      toast(aiFout(e));
    }
    setAi(null);
  }

  const tiles = [
    { l: 'Open pipeline', v: eurK(K.waarde), s: K.open.length + ' lopende dossiers', k: '#3987e5', sk: '' },
    { l: 'Gewogen verwachting', v: eurK(K.gewogen), s: 'waarde × kans per dossier', k: '#9085e9', sk: '' },
    {
      l: 'Offertes uit',
      v: String(K.off.length),
      s: K.stil.length ? K.stil.length + ' al 10+ dagen stil' : 'geen stille offertes',
      k: '#fab219',
      sk: K.stil.length ? '#ffd27a' : '',
    },
    {
      l: 'Opvolgen',
      v: String(K.laat.length + K.nu.length),
      s: K.laat.length + ' te laat · ' + K.nu.length + ' vandaag',
      k: K.laat.length ? '#e05252' : '#5fd35f',
      sk: K.laat.length ? '#ff9c9c' : '#9be59b',
    },
  ];

  const perFase = OPEN.map((f) => {
    const ls = K.open.filter((l) => l.fase === f);
    return { f, n: ls.length, w: somWaarde(ls) };
  });
  const maxW = Math.max(1, ...perFase.map((x) => x.w));

  const items: TodoItem[] = [];
  K.laat.forEach((l) =>
    items.push({
      l,
      k: '#e05252',
      t: `${l.volgendeActie || 'Opvolgen'} · ${l.bedrijf}`,
      x: `${-(dagenTot(l.volgendeDatum) ?? 0)} dag(en) te laat · ${FASE[l.fase].n} · ${eurK(l.waarde)}`,
    }),
  );
  K.nu.forEach((l) =>
    items.push({ l, k: '#fab219', t: `${l.volgendeActie || 'Opvolgen'} · ${l.bedrijf}`, x: `Vandaag · ${FASE[l.fase].n} · ${eurK(l.waarde)}` }),
  );
  K.stil
    .filter((l) => !K.laat.includes(l) && !K.nu.includes(l))
    .forEach((l) =>
      items.push({
        l,
        k: '#e0773a',
        t: `Offerte ligt stil · ${l.bedrijf}`,
        x: `${dagenSinds(laatsteContact(l))} dagen geen contact · ${eurK(l.waarde)}`,
      }),
    );
  K.open
    .filter((l) => {
      const n = dagenTot(l.volgendeDatum);
      return n != null && n > 0 && n <= 7;
    })
    .sort((a, b) => String(a.volgendeDatum).localeCompare(String(b.volgendeDatum)))
    .forEach((l) =>
      items.push({ l, k: '#5aa0f0', t: `${l.volgendeActie || 'Opvolgen'} · ${l.bedrijf}`, x: `${datumNL(l.volgendeDatum)} · ${FASE[l.fase].n}` }),
    );
  K.zonder.forEach((l) =>
    items.push({ l, k: '#898781', t: `Geen volgende stap · ${l.bedrijf}`, x: `${FASE[l.fase].n} · plan een actie zodat dit dossier niet wegzakt` }),
  );

  const ds = d.dagstart;
  const nieuwePros = d.prospects.filter((p) => p.status === 'nieuw' || p.status === 'te verifiëren').slice(0, 4);

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="tiles">
        {tiles.map((t) => (
          <button key={t.l} className="tile" onClick={() => gaNaar('pipeline')}>
            <div className="l">{t.l}</div>
            <div className="v">{t.v}</div>
            <div className="s" style={t.sk ? { color: t.sk } : undefined}>
              {t.s}
            </div>
            <div className="orb" style={{ background: `radial-gradient(circle,${t.k}55,transparent 70%)` }} />
          </button>
        ))}
      </div>

      <div className="grid2">
        <section className="card">
          <div className="row between">
            <div>
              <h2>Dagstart met Claude</h2>
              <div className="sub">Wat moet er vandaag gebeuren</div>
            </div>
            {d.claude && (
              <button className="btn ai" onClick={maakDagstart} disabled={!!ai?.busy}>
                <Spark />
                {ds?.text ? 'Vernieuw' : 'Maak dagstart'}
              </button>
            )}
          </div>
          <div style={{ marginTop: 12 }}>
            {ai?.busy ? (
              ai.text ? (
                <div className="ai-out" dangerouslySetInnerHTML={{ __html: mdLite(ai.text) }} />
              ) : (
                <div className="ai-out">
                  <Spin /> Claude leest je pipeline…
                </div>
              )
            ) : ds?.text ? (
              <>
                <div className="ai-out" dangerouslySetInnerHTML={{ __html: mdLite(ds.text) }} />
                <div className="sub">
                  Gemaakt {ds.door || ''}{' '}
                  {ds.at
                    ? 'op ' +
                      new Date(ds.at).toLocaleString('nl-NL', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : ''}
                </div>
              </>
            ) : (
              <div className="sub">
                Claude leest alle open dossiers en zet de belangrijkste acties voor vandaag op een rij, inclusief offertes die stil liggen.
              </div>
            )}
          </div>
          {!d.claude && (
            <div className="sub" style={{ marginTop: 8 }}>
              Claude is niet ingesteld op de server. Zet ANTHROPIC_API_KEY in de .env om de dagstart te gebruiken.
            </div>
          )}
        </section>

        <section className="card stack">
          <div>
            <h2>Opvolgen</h2>
            <div className="sub">Te laat, vandaag, stille offertes en deze week</div>
          </div>
          {items.length ? (
            items.slice(0, 9).map((i, n) => (
              <button key={i.l.id + '-' + n} className="todo" onClick={() => openLade(i.l)}>
                <span className="d" style={{ background: i.k, boxShadow: `0 0 12px ${i.k}` }} />
                <span>
                  <span className="t">{i.t}</span>
                  <span className="x" style={{ display: 'block' }}>
                    {i.x}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <div className="empty">Niets op te volgen. Tijd om prospects te benaderen.</div>
          )}
        </section>
      </div>

      <div className="grid2">
        <section className="card">
          <h2>Pipeline per fase</h2>
          <div className="sub">Aantal dossiers en totale waarde van wat open staat</div>
          <div className="funnel">
            {perFase.map(({ f, n, w }) => (
              <div className="fn" key={f}>
                <div className="n">{FASE[f].n}</div>
                <div className="bar">
                  <div
                    style={{
                      width: `${Math.max(w ? 4 : 0, (w / maxW) * 100)}%`,
                      background: `linear-gradient(90deg,${FASE[f].k}cc,${FASE[f].k}55)`,
                    }}
                  />
                  <span>{n}</span>
                </div>
                <div className="e">{eurK(w)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="card stack">
          <div className="row between">
            <div>
              <h2>Nieuwe klanten zoeken</h2>
              <div className="sub">Prospects die nog niet in het klantbestand zitten</div>
            </div>
            <button className="btn sm" onClick={() => gaNaar('prospects')}>
              Open →
            </button>
          </div>
          {nieuwePros.length ? (
            nieuwePros.map((p) => (
              <button key={p.id} className="todo" onClick={() => gaNaar('prospects', p.sector || undefined)}>
                <span className="d" style={{ background: SEC[p.sector || '']?.k || '#898781' }} />
                <span>
                  <span className="t">{p.bedrijf}</span>
                  <span className="x" style={{ display: 'block' }}>
                    {p.signaal || ''}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <div className="empty">Nog geen prospects. Voeg ze toe of zet een onderzoeksopdracht klaar.</div>
          )}
        </section>
      </div>
    </div>
  );
}
