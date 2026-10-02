import { useEffect, useRef, useState } from 'react';
import { PROSPECT_STATUS, SEC, SECTOREN } from '../lib/constants';
import { bewaar, useData, verwijder } from '../lib/dataStore';
import { isKlant } from '../lib/kpi';
import { getMe } from '../lib/session';
import { toast } from '../lib/toast';
import type { Prospect, ProspectStatus } from '../lib/types';
import { kiesSector, openLade, useUi } from '../lib/ui';
import { nid, vandaag, zonderId } from '../lib/utils';
import { ZekerKnop } from '../components/ZekerKnop';


function NieuweProspect({ sector, klaar }: { sector: string | null; klaar: () => void }) {
  const d = useData();
  const [v, setV] = useState({ b: '', p: '', s: sector || '', u: '', g: '' });
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  async function opslaan() {
    const n = v.b.trim();
    if (!n) {
      toast('Vul een bedrijfsnaam in');
      return;
    }
    const kl = isKlant(n, d.klanten);
    const ok = await bewaar('prospects', nid('p'), {
      bedrijf: n,
      plaats: v.p.trim(),
      sector: v.s,
      bron: v.u.trim(),
      signaal: v.g.trim(),
      status: 'nieuw',
      geverifieerd: !!v.u.trim(),
      toegevoegd: vandaag(),
      signaalDatum: vandaag(),
      door: getMe(),
    });
    if (ok) {
      toast(kl ? 'Bewaard. Let op: ' + kl.naam + ' is al klant' : 'Prospect bewaard');
      klaar();
    }
  }
  return (
    <div className="fields" style={{ padding: 12, borderRadius: 12, background: 'var(--raise)' }}>
      <div>
        <label className="lbl" htmlFor="pa-b">Bedrijf</label>
        <input ref={ref} className="input" id="pa-b" value={v.b} onChange={(e) => setV({ ...v, b: e.target.value })} />
      </div>
      <div>
        <label className="lbl" htmlFor="pa-p">Plaats</label>
        <input className="input" id="pa-p" value={v.p} onChange={(e) => setV({ ...v, p: e.target.value })} />
      </div>
      <div>
        <label className="lbl" htmlFor="pa-s">Sector</label>
        <select className="input" id="pa-s" value={v.s} onChange={(e) => setV({ ...v, s: e.target.value })}>
          <option value="">Nog onbekend</option>
          {SECTOREN.map((s) => (
            <option key={s.id} value={s.id}>{s.n}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="lbl" htmlFor="pa-u">Bron (link)</label>
        <input className="input" id="pa-u" type="url" placeholder="https://" value={v.u} onChange={(e) => setV({ ...v, u: e.target.value })} />
      </div>
      <div className="full">
        <label className="lbl" htmlFor="pa-g">Signaal</label>
        <input
          className="input"
          id="pa-g"
          placeholder="Bijv. nieuwe hal in aanbouw, vacature KAM-coördinator"
          value={v.g}
          onChange={(e) => setV({ ...v, g: e.target.value })}
        />
      </div>
      <div className="full">
        <button className="btn pri" onClick={opslaan}>Bewaar prospect</button>
      </div>
    </div>
  );
}

export function Prospects() {
  const d = useData();
  const { sector } = useUi();
  const [regio, setRegio] = useState('Noord-Brabant');
  const [opdTxt, setOpdTxt] = useState('');
  const [toonForm, setToonForm] = useState(false);
  const detailRef = useRef<HTMLElement>(null);
  const s = sector ? SEC[sector] : null;

  useEffect(() => {
    if (sector) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [sector]);

  const onbekend = d.prospects.filter((p) => !p.sector || !SEC[p.sector]);
  const lijst = d.prospects
    .filter((p) => (s ? p.sector === s.id : true))
    .sort((a, b) => String(b.signaalDatum || '').localeCompare(String(a.signaalDatum || '')));
  const opd = d.opdrachten
    .filter((o) => !s || o.sector === s.id)
    .sort((a, b) => String(b.aangemaakt).localeCompare(String(a.aangemaakt)));

  async function zetOpdracht() {
    const ok = await bewaar('opdrachten', nid('o'), {
      sector: sector,
      regio,
      vraag: opdTxt.trim(),
      status: 'open',
      aangemaakt: new Date().toISOString(),
      door: getMe(),
    });
    if (ok) {
      setOpdTxt('');
      toast('Opdracht klaargezet');
    }
  }

  async function zetStatus(p: Prospect, status: ProspectStatus) {
    await bewaar('prospects', p.id, { ...zonderId(p), status });
  }

  function naarLead(p: Prospect) {
    const me = getMe();
    openLade({
      fase: 'lead',
      bedrijf: p.bedrijf,
      plaats: p.plaats || '',
      sector: p.sector || '',
      bron: 'Prospectie',
      eigenaar: me,
      kans: 10,
      omschrijving: '',
      log: [{ d: vandaag(), t: 'Uit prospectlijst: ' + (p.signaal || ''), w: me }],
      _pid: p.id,
    });
  }

  const q = encodeURIComponent;
  const t0 = s ? s.n.split(' ')[0].toLowerCase() : '';

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="sectors">
        {SECTOREN.map((x) => {
          const np = d.prospects.filter((p) => p.sector === x.id && p.status !== 'afgevallen').length;
          const nk = d.klanten.filter((k) => k.sector === x.id).length;
          return (
            <button key={x.id} className="sec" aria-pressed={sector === x.id} onClick={() => kiesSector(sector === x.id ? null : x.id)}>
              <div className="h">
                <i style={{ background: x.k }} />
                {x.n}
              </div>
              <div className="n">
                <span className="chip">{np} prospect{np === 1 ? '' : 's'}</span>
                <span className="chip">{nk} klant{nk === 1 ? '' : 'en'}</span>
              </div>
            </button>
          );
        })}
      </div>

      {onbekend.length > 0 && !s && (
        <div className="banner" style={{ borderColor: 'rgba(90,160,240,.35)', background: 'rgba(90,160,240,.07)' }}>
          <div>
            <b>
              {onbekend.length} prospect{onbekend.length === 1 ? '' : 's'} zonder sector.
            </b>{' '}
            Ze staan hieronder in de lijst.
          </div>
        </div>
      )}

      {s && (
        <section ref={detailRef} className="card stack" style={{ gap: 16 }}>
          <div className="row between">
            <div>
              <div className="kicker" style={{ color: s.k }}>Sector</div>
              <h2 style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 600, fontSize: 28 }}>{s.n}</h2>
            </div>
            <div className="row">
              <label className="lbl" htmlFor="regio" style={{ margin: 0 }}>Regio</label>
              <input
                className="input"
                id="regio"
                style={{ width: 170 }}
                value={regio}
                onChange={(e) => setRegio(e.target.value)}
                onBlur={() => setRegio((r) => r.trim() || 'Noord-Brabant')}
              />
            </div>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            <div className="lbl">Zelf zoeken</div>
            <div className="links">
              <a target="_blank" rel="noopener" href={`https://www.google.com/search?q=${q(t0 + ' ' + regio + ' (uitbreiding OR nieuwbouw OR investeert)')}`}>
                {s.n} + investering ↗
              </a>
              <a target="_blank" rel="noopener" href={`https://www.google.com/search?q=${q('vergunning bedrijfshal ' + t0 + ' ' + regio)}`}>
                Vergunningen bedrijfshallen ↗
              </a>
              <a target="_blank" rel="noopener" href={`https://www.google.com/search?q=${q('vacature KAM ' + t0 + ' ' + regio)}`}>
                Vacatures KAM/HSE ↗
              </a>
              <a target="_blank" rel="noopener" href={`https://www.linkedin.com/search/results/people/?keywords=${q(t0 + ' ' + regio)}`}>
                LinkedIn ↗
              </a>
            </div>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            <div className="lbl" style={{ margin: 0 }}>Onderzoeksopdracht</div>
            <div className="sub">
              Voor echte, gecontroleerde namen. Zet een opdracht klaar: zoek bedrijven in deze sector en regio met een koopsignaal
              (nieuwbouw, uitbreiding, vergunning, vacature). Resultaten worden als prospect met bron toegevoegd, handmatig of via de API
              (<code>PUT /api/db/prospects/&lt;id&gt;</code>).
            </div>
            <textarea
              className="input"
              rows={2}
              value={opdTxt}
              onChange={(e) => setOpdTxt(e.target.value)}
              placeholder="Bijv. alleen bedrijven met eigen productie, 20+ medewerkers"
            />
            <div>
              <button className="btn" onClick={zetOpdracht}>Zet opdracht klaar</button>
            </div>
            {opd.map((o) => (
              <div key={o.id} className="row" style={{ gap: 8, fontSize: 12.5 }}>
                <span className={'chip ' + (o.status === 'klaar' ? 'ok' : 'today')}>{o.status === 'klaar' ? 'klaar' : 'open'}</span>
                <span className="soft">
                  {o.regio}
                  {o.vraag ? ' · ' + o.vraag : ''}
                </span>
                {o.resultaat && <span className="muted">· {o.resultaat}</span>}
                {o.status !== 'klaar' && (
                  <button className="btn ghost sm" onClick={() => bewaar('opdrachten', o.id, { ...zonderId(o), status: 'klaar' })}>
                    Markeer klaar
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card stack">
        <div className="row between">
          <div>
            <h2>{s ? 'Prospects in ' + s.n : 'Alle prospects en signalen'}</h2>
            <div className="sub">
              {s ? (
                <button className="btn ghost sm" style={{ padding: 0 }} onClick={() => kiesSector(null)}>
                  Toon alle sectoren
                </button>
              ) : (
                'Nieuwste signalen eerst'
              )}
            </div>
          </div>
          <button className="btn" onClick={() => setToonForm(!toonForm)}>+ Prospect</button>
        </div>
        {toonForm && <NieuweProspect sector={sector} klaar={() => setToonForm(false)} />}
        {lijst.length ? (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bedrijf</th>
                  <th>Signaal</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lijst.map((p) => {
                  const kl = isKlant(p.bedrijf, d.klanten);
                  const sec = SEC[p.sector || ''];
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="b">{p.bedrijf}</div>
                        <div className="x">
                          {p.plaats || ''}
                          {sec && !s ? ' · ' + sec.n : ''}
                        </div>
                        <div className="row" style={{ gap: 6, marginTop: 6 }}>
                          {p.geverifieerd ? <span className="chip ok">bron gecontroleerd</span> : <span className="chip ai">te verifiëren</span>}
                          {kl && <span className="chip late">al klant</span>}
                        </div>
                      </td>
                      <td>
                        <div className="x" style={{ margin: 0 }}>{p.signaal || ''}</div>
                        {p.bron && (
                          <a className="x" style={{ display: 'inline-block', marginTop: 4, color: '#9dc4f5' }} href={p.bron} target="_blank" rel="noopener">
                            Bron{p.signaalDatum ? ' · ' + p.signaalDatum : ''} ↗
                          </a>
                        )}
                        {p.notitie && <div className="x muted">{p.notitie}</div>}
                      </td>
                      <td>
                        <select
                          className="input"
                          aria-label="Status"
                          style={{ minWidth: 130 }}
                          value={p.status}
                          onChange={(e) => zetStatus(p, e.target.value as ProspectStatus)}
                        >
                          {PROSPECT_STATUS.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                          <button className="btn sm" onClick={() => naarLead(p)}>→ Lead</button>
                          <ZekerKnop
                            label="Verwijder"
                            onBevestig={async () => {
                              if (await verwijder('prospects', p.id)) toast('Prospect verwijderd');
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">Nog geen prospects in deze sector.</div>
        )}
      </section>
    </div>
  );
}
