import { useState } from 'react';
import { Spark } from '../components/Spark';
import { FASE, FASEN, OPEN, SEC, SECTOREN } from '../lib/constants';
import { useData } from '../lib/dataStore';
import { somWaarde } from '../lib/kpi';
import { getMe } from '../lib/session';
import type { Lead } from '../lib/types';
import { openLade, openPlak } from '../lib/ui';
import { dagenTot, datumNL, eurK, initialen } from '../lib/utils';

function LeadKaart({ l }: { l: Lead }) {
  const d = l.volgendeDatum ? dagenTot(l.volgendeDatum) : null;
  const cls = d == null ? '' : d < 0 ? 'late' : d === 0 ? 'today' : 'ok';
  const dl = d == null ? 'geen actie' : d < 0 ? `${-d}d te laat` : d === 0 ? 'vandaag' : datumNL(l.volgendeDatum);
  const sec = SEC[l.sector || ''];
  return (
    <button className="lc" onClick={() => openLade(l)}>
      <div className="row" style={{ gap: 8 }}>
        <span className="b">{l.bedrijf}</span>
      </div>
      {l.omschrijving && <div className="o">{l.omschrijving}</div>}
      <div className="f">
        <span className={'chip ' + cls}>{dl}</span>
        {sec && (
          <span className="chip">
            <i style={{ background: sec.k }} />
            {sec.n.split(' ')[0]}
          </span>
        )}
        {l.syntessId && (
          <span className="chip" title="Offerte in de offerte-tool">
            Offerte
          </span>
        )}
        <span className="w">{l.waarde ? eurK(l.waarde) : ''}</span>
        {l.eigenaar && (
          <span className="av" title={l.eigenaar}>
            {initialen(l.eigenaar)}
          </span>
        )}
      </div>
    </button>
  );
}

export function Pipeline() {
  const d = useData();
  const [q, setQ] = useState('');
  const [eig, setEig] = useState('');
  const [sec, setSec] = useState('');
  const [closed, setClosed] = useState(false);

  const qq = q.trim().toLowerCase();
  const L = d.leads.filter(
    (l) =>
      (!qq || [l.bedrijf, l.contact, l.omschrijving, l.plaats].join(' ').toLowerCase().includes(qq)) &&
      (!eig || l.eigenaar === eig) &&
      (!sec || l.sector === sec),
  );
  const cols = closed ? FASEN : FASEN.filter((f) => OPEN.includes(f.id));
  const nClosed = d.leads.filter((l) => !OPEN.includes(l.fase)).length;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="toolbar">
        <button className="btn pri" onClick={() => openLade({ fase: 'lead', eigenaar: getMe(), kans: FASE.lead.p, log: [] })}>
          + Nieuwe lead
        </button>
        {d.claude && (
          <button className="btn ai" onClick={openPlak}>
            <Spark />
            Plak mail of notitie
          </button>
        )}
        <input
          className="input grow"
          type="search"
          placeholder="Zoek bedrijf, contact, plaats…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Zoeken"
        />
        <select className="input" value={eig} onChange={(e) => setEig(e.target.value)} aria-label="Eigenaar">
          <option value="">Iedereen</option>
          {d.team.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select className="input" value={sec} onChange={(e) => setSec(e.target.value)} aria-label="Sector">
          <option value="">Alle sectoren</option>
          {SECTOREN.map((s) => (
            <option key={s.id} value={s.id}>
              {s.n}
            </option>
          ))}
        </select>
        <button className="btn ghost sm" onClick={() => setClosed(!closed)}>
          {closed ? 'Verberg afgesloten' : `Toon afgesloten (${nClosed})`}
        </button>
      </div>
      <div className="board-wrap">
        <div className="board">
          {cols.map((f) => {
            const ls = L.filter((l) => l.fase === f.id).sort((a, b) =>
              (a.volgendeDatum || '9').localeCompare(b.volgendeDatum || '9'),
            );
            return (
              <div className="col" key={f.id}>
                <div className="col-h">
                  <i style={{ background: f.k, boxShadow: `0 0 10px ${f.k}` }} />
                  {f.n}
                  <small>
                    {ls.length} · {eurK(somWaarde(ls))}
                  </small>
                </div>
                {ls.length ? (
                  ls.map((l) => <LeadKaart key={l.id} l={l} />)
                ) : (
                  <div className="muted" style={{ fontSize: 12, padding: '6px 4px' }}>
                    Leeg
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
