import { CONTROL_URL, VIEWS, VIEW_IDS } from '../lib/constants';
import { useData } from '../lib/dataStore';
import type { Kpi } from '../lib/kpi';
import { setMe, useMe } from '../lib/session';
import { gaNaar, useUi } from '../lib/ui';

export function TopBar({ K }: { K: Kpi }) {
  const d = useData();
  const me = useMe();
  const { view } = useUi();
  const counts: Record<string, number | ''> = {
    overzicht: K.laat.length + K.nu.length || '',
    pipeline: K.open.length || '',
    prospects: d.prospects.filter((p) => !['lead', 'afgevallen'].includes(p.status)).length || '',
    syntess: d.syntess.filter((c) => c.status === 'concept').length || '',
    klanten: d.klanten.length || '',
  };
  const live = d.conn === 'live';
  return (
    <header className="topbar">
      <div className="topbar-in">
        <div className="brand">
          <div className="logo">M</div>
          <div>
            <b>Miltech Sales</b>
            <small>Zuid Nederland B.V.</small>
          </div>
        </div>
        <nav className="nav" aria-label="Onderdelen">
          {VIEW_IDS.map((id) => {
            const v = VIEWS[id];
            return (
              <button key={id} onClick={() => gaNaar(id)} aria-current={view === id ? 'page' : undefined}>
                <span className="dot" style={{ background: v.dot, boxShadow: `0 0 10px ${v.dot}` }} />
                {v.n}
                <span className="cnt">{counts[id]}</span>
              </button>
            );
          })}
        </nav>
        <div className="tools">
          <label className="sr" htmlFor="me-sel">
            Ik ben
          </label>
          <select className="input" id="me-sel" aria-label="Ik ben" value={me} onChange={(e) => setMe(e.target.value)}>
            <option value="">Kies je naam</option>
            {d.team.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          {CONTROL_URL && (
            <a href={CONTROL_URL} target="_blank" rel="noopener">
              Miltech Control ↗
            </a>
          )}
          <span className="side-foot" title="Verbindingsstatus">
            <span className={'live' + (live ? '' : ' off')} />
            <span id="live-txt">{live ? 'Live · gedeeld' : d.conn === 'offline' ? 'Geen verbinding' : 'Verbinden…'}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
